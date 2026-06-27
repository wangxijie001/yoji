/**
 * 共享类型声明
 *
 * 主进程 (src/main/) 和渲染进程 (src/renderer/) 都能引用这里的类型。
 * ⚠️ 约束：此文件只能放纯类型，不能 import 任何 Node.js / Electron 模块。
 */

//声明文件 类型
export type ConfigName = 'env' | 'model' | 'mcp'
//支持的模型种类
export type ModelProvider = 'qwen' | 'deepseek'
//model 配置文件类型
export type ModelConfig = { apiKey: string; model: string ; baseURL: string }
//mcp 配置文件类型
export type McpConfig = { 
  key: string
  name: string
  description: string
  isEnabled: boolean
  uuid: string
  config:{
         transport: "http" | "sse" | undefined,
         url: string,
  }
  tools?: { name: string; description: string }[]
}

// 聊天消息
export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
  /** 中断审批决策，仅 role='user' 且有未处理中断时传 */
  interruptDecision?: 'approve' | 'edit' | 'reject'
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

// companion 目录下的文件条目
export interface FileEntry {
  name: string           // 文件名
  relativePath: string   // 相对 companion 目录的路径
  isDirectory: boolean
  size: number           // 字节数，目录为 0
  createdAt: number      // 创建时间，毫秒时间戳
  modifiedAt: number     // 修改时间，毫秒时间戳
  fullPath: string       // 完整绝对路径
  mimeType?: string      // MIME 类型（仅文件有值）
}