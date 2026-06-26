import { spawn } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync, unlinkSync } from 'fs'

/**
 * macOS TTS 语音播报模块
 *
 * 流式片段 → 缓冲 + 100ms 扫描切句 → say -o 生成 aiff → afplay 顺序播放
 *
 * 使用：
 *   import { tts } from './tts'
 *   tts.feed('你好')
 *   tts.flush()
 *   tts.stop()
 */

const TEMP_DIR = join(tmpdir(), 'yoji-tts')
mkdirSync(TEMP_DIR, { recursive: true })

// ---- 播报队列（预生成 + 播放交叠，减少句间间隙） ----
type QueueItem = { text: string; file: string; ready: boolean }
const playQueue: QueueItem[] = []
let playing = false
let generating = false
let seq = 0

function nextFile(): string {
  return join(TEMP_DIR, `${Date.now()}-${seq++}.aiff`)
}

/** 后台生成下一句的音频文件（不阻塞播放） */
function preGenerate(): void {
  if (generating) return
  // 找第一个还没生成的队列项
  const item = playQueue.find(i => !i.ready)
  if (!item) return
  generating = true
  const p = spawn('say', ['-o', item.file, '--', item.text])
  p.on('close', () => { item.ready = true; generating = false; preGenerate(); playIfReady() })
  p.on('error', () => { generating = false; preGenerate() })
}

/** 队列里第一个已生成的就播，播的同时后台预生成下一个 */
function playIfReady(): void {
  if (playing) return
  const item = playQueue[0]
  if (!item?.ready) return
  playing = true

  const p = spawn('afplay', [item.file])
  p.on('close', () => {
    playing = false
    try { unlinkSync(item.file) } catch (_) { /* ignore */ }
    playQueue.shift()
    playIfReady()
  })
  p.on('error', () => { playing = false; playQueue.shift(); playIfReady() })

  preGenerate()  // 播的同时生成下一句
}

// ---- 句子缓冲 + 定时扫描 ----
let sentenceBuffer = ''
let timer: ReturnType<typeof setInterval> | null = null
const SENTENCE_RE = /^([\s\S]*?[。！？\n])\s*/

function cleanSentence(text: string): string {
  return text
    .replace(/[（(][^）)]*[）)]/g, '')   // 去掉括号及其内容
    .replace(/\s+/g, '，')                // 空格/换行 → 逗号停顿
}

function ensureTimer(): void {
  if (timer) return
  timer = setInterval(() => {
    let m: RegExpMatchArray | null
    while ((m = sentenceBuffer.match(SENTENCE_RE))) {
      const raw = m[1].trim()
      sentenceBuffer = sentenceBuffer.slice(m[0].length)
      if (raw) {
        const sentence = cleanSentence(raw)
        const file = nextFile()
        playQueue.push({ text: sentence, file, ready: false })
        preGenerate()
      }
    }
    if (!sentenceBuffer) {
      clearInterval(timer!)
      timer = null
    }
  }, 100)
}

function feed(chunk: string): void {
  const text = chunk
    .replace(/[\*\_\~\`\#\[\]]/g, ' ')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{200D}\u{FE0F}]/gu, '')
  if (!text.trim()) return
  sentenceBuffer += text
  ensureTimer()
}


function flush(): void {
  if (timer) { clearInterval(timer); timer = null }
  const rest = sentenceBuffer.trim()
  sentenceBuffer = ''
  if (rest) {
    const file = nextFile()
    playQueue.push({ text: rest, file, ready: false })
    preGenerate()
  }
}

function stop(): void {
  if (timer) { clearInterval(timer); timer = null }
  sentenceBuffer = ''
  playing = false
  generating = false
  for (const item of playQueue) {
    try { unlinkSync(item.file) } catch (_) { /* ignore */ }
  }
  playQueue.length = 0
}

function isSpeaking(): boolean {
  return playing || generating
}

function pendingCount(): number {
  return playQueue.length + (playing ? 1 : 0)
}

export const tts = { feed, flush, stop, isSpeaking, pendingCount }
