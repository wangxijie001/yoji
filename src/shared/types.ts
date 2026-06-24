/**
 * 共享类型声明
 *
 * 主进程 (src/main/) 和渲染进程 (src/renderer/) 都能引用这里的类型。
 * ⚠️ 约束：此文件只能放纯类型，不能 import 任何 Node.js / Electron 模块。
 */

//声明文件 类型
export type ConfigName = 'env' | 'model'
//支持的模型种类
export type ModelProvider = 'qwen' | 'deepseek'
//model 配置文件类型
export type ModelConfig = { apiKey: string; model: string ; baseURL: string }

// 聊天消息
export type ChatMessage = {
  role: 'user' | 'assistant' | 'system' 
  content: string
}

// 聊天历史消息记录
export type MessageRecord = {
  id: number
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  prev_id: number | null
  next_id: number | null
  created_at: number      // 毫秒时间戳
}

// 查询历史参数
export type MessageHistoryQuery = {
  beforeId?: number
  limit?: number
}

//流式聊天回调函数
export type StreamChunk = {
  type:string
  content:any
  operate?:any
}
export type StreamCallbacks = {
  onChunk: (content: StreamChunk) => void
  onDone: () => void
  onError: (error: string) => void
}

// 情绪状态
export type EmotionState = {
  id?: number
  dopamine: number
  serotonin: number
  gaba: number
  cortisol: number
  adrenaline: number
  oxytocin: number
  endorphin: number
  melatonin: number
  source?: string
  emotion: string
  description: string
  display?: string  // JSON: { primary, secondary, ratio }，UI 背景渐变用
  created_at: number
}