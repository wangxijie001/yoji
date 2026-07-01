// 渲染进程 Agent 调用封装

import { message } from 'antd'
import type { ChatMessage, MessageHistoryQuery, MessageRecord, StreamCallbacks } from '@shared/types'

interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}


const agent = {
  async chat(messages: ChatMessage[]): Promise<any> {
    const res: ApiResponse = await window.api.agent.chat(messages)
    if (!res.ok) {
      message.error(res.error || 'Agent 调用失败')
      return null
    }
    return res.data
  },

  /** 查询聊天历史 */
  async historyQuery(query: MessageHistoryQuery = {}): Promise<MessageRecord[]> {
    const res = await window.api.agent.historyQuery(query)
    if (!res.ok) {
      // message.error(res.error || '查询失败')
      return []
    }
    return res.data ?? []
  },

  /** 流式聊天——逐 token 回调 */
  chatStream(messages: ChatMessage[], callbacks: StreamCallbacks): void {
    window.api.agent.chatStream(messages, {
      onChunk: callbacks.onChunk,
      onDone: callbacks.onDone,
      onError: (err) => {
        message.error(err)
        callbacks.onError(err)
      },
    })
  },

  /** 停止当前流式对话 */
  stop(): void {
    window.api.agent.stop()
  },

  /** 更新 Agent 配置版本，触发 Agent 重建 */
  async updateVersion(): Promise<void> {
    const res = await window.api.agent.updateVersion()
    if (!res.ok) throw new Error(res.error)
  },
}

export default agent 
