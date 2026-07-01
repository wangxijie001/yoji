/**
 * 主动聊天工具
 * 定时触发 AI 主动发起对话，间隔随时间翻倍（10min → 20min → 40min → ...），上限 12 小时
 */

import { envConfig } from '@renderer/api/config'
import { SetStateAction } from 'react'

type Callback = (params: { assistantMessage?: string }) => Promise<void>

const INITIAL_INTERVAL_MS = 10 * 60 * 1000 // 初始间隔：10 分钟
const MAX_INTERVAL_MS = 12 * 60 * 60 * 1000 // 上限：12 小时

let currentIntervalMs = INITIAL_INTERVAL_MS
let timeoutId: ReturnType<typeof setTimeout> | null = null
let systemProactiveChatEnabled: boolean = false // 系统配置开启主动聊天设置缓存

let _callback: Callback | null = null

const onTickChat = async () => {
  // 获取最新用户消息
  const lastUserMsg = await envConfig.get<{ createdAt: number; content: string }>(
    'latestUserMessage'
  )
  if (!lastUserMsg) {
    return
  }

  const { createdAt } = lastUserMsg
  const now = Date.now() // 当前时间戳
  // 距上次聊天的时间
  const minutesSinceLastChat = (now - createdAt) / 1000 / 60 // 转换为分钟
  const last_chat_time_span = `${minutesSinceLastChat.toFixed(2)}分钟`
  const aiMessage = `我是你的情绪助手：用户已经 ${last_chat_time_span} 分钟没有和你聊天了，你应该主动与用户互动一下`
  if (!_callback) {
    return
  }
  _callback({ assistantMessage: aiMessage })
}

// 初始化主动聊天配置
const initProactiveConfig = async (
  callback: Callback,
  setIsProactiveChatUISwitch: (value: SetStateAction<boolean>) => void
) => {
  _callback = callback
  systemProactiveChatEnabled = (await envConfig.get<boolean>('isProactiveChatEnabled')) || false
  setIsProactiveChatUISwitch(systemProactiveChatEnabled)

  if (!systemProactiveChatEnabled) {
    return
  }

  resetTimer()
}

/**
 * 启动或重置主动聊天定时器
 * - 首次调用：开始计时（10 分钟后首次触发）
 * - 再次调用：重置计时器，从 10 分钟重新开始
 * @param isProactiveChatEnabled 修改系统配置开启主动聊天设置，不存在则默认使用系统配置
 *  */

function resetTimer(isProactiveChatEnabled?: true): void {
  if (isProactiveChatEnabled) {
    envConfig.set('isProactiveChatEnabled', true)
    systemProactiveChatEnabled = true
  }

  if (!systemProactiveChatEnabled) {
    return
  }

  currentIntervalMs = INITIAL_INTERVAL_MS
  scheduleNext()
}

/** 设置下一次定时 */
function scheduleNext(): void {
  clearTimer()
  // 如果下一次间隔超过上限，不再继续
  if (currentIntervalMs > MAX_INTERVAL_MS) return

  timeoutId = setTimeout(() => {
    try {
      onTickChat()
    } catch (error) {
      console.error('主动聊天触发失败:', error)
    }
    // 触发后间隔翻倍
    currentIntervalMs *= 2
    scheduleNext()
  }, currentIntervalMs)
}

/** 清除当前定时器 */
function clearTimer(): void {
  if (timeoutId !== null) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

/**
 * 停止定时器，彻底清理
 *  * @param isProactiveChatEnabled 修改系统配置开启主动聊天设置，不存在则默认使用系统配置
 * */
function stopTimer(isProactiveChatEnabled?: true): void {
  if (isProactiveChatEnabled) {
    envConfig.set('isProactiveChatEnabled', false)
    systemProactiveChatEnabled = false
  }
  clearTimer()
  currentIntervalMs = INITIAL_INTERVAL_MS
  _callback = null
}


export default {
  initProactiveConfig,
  resetTimer,
  stopTimer
}
