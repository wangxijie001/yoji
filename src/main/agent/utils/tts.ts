import { spawn, type ChildProcess } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync, unlinkSync, readdirSync } from 'fs'
import { broadcast } from '../../ipc/broadcast'

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
 *   tts.setEnabled(false)  // 关闭语音合成
 */

// macOS only — say / afplay 均为 macOS 专属命令
const isMac = process.platform === 'darwin'

const TEMP_DIR = join(tmpdir(), 'yoji-tts')
if (isMac) mkdirSync(TEMP_DIR, { recursive: true })

// 启动时清理残留音频文件
function cleanupOrphanFiles(): void {
  try {
    const files = readdirSync(TEMP_DIR)
    for (const file of files) {
      if (file.endsWith('.aiff')) {
        try { unlinkSync(join(TEMP_DIR, file)) } catch (_) { /* ignore */ }
      }
    }
  } catch (_) { /* ignore */ }
}
cleanupOrphanFiles()

// ---- TTS 参数 ----
const TTS_RATE = 180            // 语速（词/分钟）

// ---- 播报状态通知（渲染进程用于 Live2D 口型同步）----
function notifySpeaking(): void {
  try { broadcast('tts:speakingChanged', playing) } catch (_) { /* ignore */ }
}

// ---- TTS 开关 ----

// ---- TTS 开关 ----
let _enabled = false

// ---- 播报队列（预生成 + 播放交叠，减少句间间隙） ----
type QueueItem = { text: string; file: string; ready: boolean }
const playQueue: QueueItem[] = []
let playing = false
let generating = false
let seq = 0

/** 当前正在播放的 afplay 进程引用，用于即时停止 */
let currentPlayer: ChildProcess | null = null

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
  const p = spawn('say', ['-r', String(TTS_RATE), '-o', item.file, '--', item.text])
  p.on('close', () => { item.ready = true; generating = false; preGenerate(); playIfReady() })
  p.on('error', () => { generating = false; preGenerate() })
}

/** 队列里第一个已生成的就播，播的同时后台预生成下一个 */
function playIfReady(): void {
  if (playing) return
  const item = playQueue[0]
  if (!item?.ready) return
  playing = true
  notifySpeaking()

  const p = spawn('afplay', [item.file])
  currentPlayer = p
  p.on('close', () => {
    playing = false
    notifySpeaking()
    currentPlayer = null
    try { unlinkSync(item.file) } catch (_) { /* ignore */ }
    playQueue.shift()
    playIfReady()
  })
  p.on('error', () => {
    playing = false
    notifySpeaking()
    currentPlayer = null
    playQueue.shift()
    playIfReady()
  })

  preGenerate()  // 播的同时生成下一句
}

// ---- 句子缓冲 + 定时扫描 ----
let sentenceBuffer = ''
let timer: ReturnType<typeof setInterval> | null = null
const SENTENCE_RE = /^([\s\S]*?[。！？\n])\s*/

/** 句子级清洗：完整句子 → 适合朗读的纯文本 */
function cleanSentence(text: string): string {
  const cleaned = text
    // 斜体 *text* → 保留 text
    .replace(/\*([^*]+)\*/g, '$1')
    // 斜体 _text_ → 保留 text
    .replace(/_([^_]+)_/g, '$1')
    // 删除线 ~~text~~ → 保留 text
    .replace(/~~([^~]+)~~/g, '$1')
    // 行内代码 `code` → 保留 code（AI 回复中的工具名/文件名有用）
    .replace(/`([^`]+)`/g, ' $1 ')
    // 链接 [text](url) → 保留 text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 图片 ![](url) → 丢弃
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // 加粗 **text** → 保留 text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // 残留符号 → 空格
    .replace(/[\*\_\~\`\#\[\]]/g, ' ')
    // 空白字符 → 逗号停顿
    .replace(/\s+/g, '，')

  return cleaned
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
  if (!isMac || !_enabled) return
  const text = chunk
    // 省略号 → 句号，充当分句符
    .replace(/\.{3,}/g, '。')
    .replace(/…{2,}/g, '。')
    // 流式 chunk 只做单字符级清洗，配对标记留给 cleanSentence
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{200D}\u{FE0F}]/gu, '')
  if (!text.trim()) return
  sentenceBuffer += text
  ensureTimer()
}


function flush(): void {
  if (timer) { clearInterval(timer); timer = null }
  const rest = sentenceBuffer.trim()
  sentenceBuffer = ''
  if (rest && _enabled) {
    const file = nextFile()
    playQueue.push({ text: rest, file, ready: false })
    preGenerate()
  }
}

function stop(): void {
  // 立即杀掉正在播放的 afplay 进程
  if (currentPlayer) {
    currentPlayer.kill()
    currentPlayer = null
  }
  if (timer) { clearInterval(timer); timer = null }
  sentenceBuffer = ''
  playing = false
  notifySpeaking()
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

function isEnabled(): boolean {
  return _enabled
}

function setEnabled(v: boolean): void {
  if (!isMac) return
  _enabled = v
  if (!v) stop()  // 关闭时立即停止当前播放
}

export const tts = { feed, flush, stop, isSpeaking, pendingCount, isEnabled, setEnabled }
