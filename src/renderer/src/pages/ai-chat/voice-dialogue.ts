import { useState, useRef, useCallback, useEffect } from 'react'

// 语音交互状态
export type VoiceStatus =
  | 'idle' // 未启动，麦克风关闭
  | 'listening' // 持续监听中，等待唤醒词
  | 'woken' // 已唤醒，正在采集用户说的话
  | 'speaking' // （预留）AI 正在 TTS 播报中，暂停收音

interface UseVoiceDialogueOptions {
  /** 唤醒词，默认 "小优" */
  wakeWord?: string
  /** 语言，默认中文 */
  lang?: string
  /** 唤醒回调 */
  onWake?: () => void
  /** 语音实时转文字*/
  onMessage?: (text: string) => void
  /** 2 秒没文字变化视为说完了，返回完整文字 */
  onMessageFinal?: (text: string) => void
  /** 错误回调 */
  onError?: (error: string) => void
}

interface UseVoiceDialogueReturn {
  /** 是否正在监听 */
  isListening: boolean
  /** 是否正在录音 */
  recordingVoice: boolean
  /** 开始持续监听 */
  startListening: () => void
  /** 停止监听 */
  stopListening: () => void
  /** macOS 原生语音识别是否可用 */
  isSupported: boolean
}

/**
 * 语音对话 Hook — 基于 macOS 原生 SFSpeechRecognizer
 *
 * 流程：idle → 点麦克风 → listening → 听到唤醒词 → woken → 说完 2s 停顿 → idle → onMessage
 */
export function useVoiceDialogue(options: UseVoiceDialogueOptions = {}): UseVoiceDialogueReturn {
  const { wakeWord = '小优', lang = 'zh-CN', onWake, onMessage, onMessageFinal, onError } = options

  const [isListening, setIsListening] = useState<boolean>(false)
  const [recordingVoice, setRecordingVoice] = useState<boolean>(false)
  // 仅 macOS 可用（electron-native-speech 通过 preload 暴露 window.electronSpeech）
  const [isSupported] = useState(() => !!(window as any).electronSpeech?.createSpeechSession)

  const sessionRef = useRef<any>(null)
  const statusRef = useRef<VoiceStatus>('idle')
  const offResultRef = useRef<(() => void) | null>(null)
  const offErrorRef = useRef<(() => void) | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messageBufferRef = useRef('')

  // ---- 唤醒词匹配 + 消息采集 ----
  // 注意：macOS 原生识别在 continuous 模式下不给 isFinal=true，
  // 所以用 interim 做唤醒词检测 + 静默计时判断说完了
  const handleSpeechResult = (text: string) => {
    const lower = text.toLowerCase().trim()
 
    // 等待唤醒词
    if (statusRef.current === 'listening') {
      const VoiceStartIndex = lower.indexOf(wakeWord)
      if (VoiceStartIndex >= 0) {
        statusRef.current = 'woken'
        setRecordingVoice(true)
        onWake?.()
        // 唤醒词后面的内容作为用户消息
        const after = lower.slice(VoiceStartIndex + wakeWord.length).trim()
        messageBufferRef.current = after
        if (after) onMessage?.(after)
      }
    }
    // 已唤醒，采集用户消息
    else if (statusRef.current === 'woken') {
      // 剥离可能的残留唤醒词
      const VoiceStartIndex = lower.indexOf(wakeWord)
      let msg = lower.slice(VoiceStartIndex + wakeWord.length).trim()
      messageBufferRef.current = msg
      onMessage?.(msg)

      // 2 秒没文字变化视为说完了
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        const final = messageBufferRef.current
        if (final) {
          console.log('[voice] done:', final)
          setRecordingVoice(false)
          statusRef.current = 'idle'
          sessionRef.current?.stop?.()
          onMessageFinal?.(final)
          startListening()
        }
      }, 2000)
    }
  }

  // ---- 开始监听 ----
  const startListening = async () => {
    const electronSpeech = (window as any).electronSpeech
    console.log('[voice] startListening:', electronSpeech)
    if (!electronSpeech) return

    // 防止重复启动：先停掉旧 session
    if (sessionRef.current) {
      offResultRef.current?.()
      offErrorRef.current?.()
      try {
        await sessionRef.current.stop()
      } catch {}
      try {
        await sessionRef.current.dispose()
      } catch {}
      sessionRef.current = null
    }
    
    try {
      const session = await electronSpeech.createSpeechSession()
      console.log('[voice] startListening session:', session)
      sessionRef.current = session

      offResultRef.current = session.on('result', (r: any) => handleSpeechResult(r.text))
      offErrorRef.current = session.on('error', (e: any) => {
        if (e.code === 'no-speech-detected') return
        // 权限类错误无法恢复，重置状态
        if (
          e.code === 'permission-denied' ||
          e.code === 'unsupported-locale' ||
          e.code === 'unavailable'
        ) {
          setIsListening(false)
          sessionRef.current?.stop?.()
        }
        onError?.(e.message)
      })
      console.log('[voice] startListening session start:', session)
      await session.start({ locale: lang, interimResults: true, continuous: true })
      setIsListening(true)
      statusRef.current = 'listening'
      messageBufferRef.current = ''
    } catch (err: any) {
      onError?.(err.message)
      console.error('[voice] startListening error:', err)
    }
  }

  // ---- 停止监听 ----
  const stopListening = useCallback(async () => {
    setIsListening(false)
    statusRef.current = 'idle'
    messageBufferRef.current = ''
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    offResultRef.current?.()
    offErrorRef.current?.()
    setIsListening(false)
    setRecordingVoice(false)

    if (sessionRef.current) {
      try {
        await sessionRef.current.stop()
      } catch {}
      try {
        await sessionRef.current.dispose()
      } catch {}
      sessionRef.current = null
    }
  }, [])

  // 组件卸载时清理
  useEffect(
    () => () => {
      stopListening()
    },
    [stopListening]
  )

  return { isListening, startListening, stopListening, isSupported,recordingVoice }
}
