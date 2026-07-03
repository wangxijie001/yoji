import { ipcRenderer } from 'electron'
import type { ChatMessage, MessageHistoryQuery, MessageRecord, StreamCallbacks, StreamChunk } from '../../shared/types'
import { createListener } from './listener'

type ApiResponse<T = unknown> = { ok: boolean; data?: T; error?: string }

// Agent 对话通道
export const agent = {
  chat: (messages: ChatMessage[]) => ipcRenderer.invoke('agent:chat', messages),
  historyQuery: (query: MessageHistoryQuery) => ipcRenderer.invoke('history:query', query) as Promise<{ ok: boolean; data?: MessageRecord[]; error?: string }>,

  /** Agent 核心重建状态通知 */
  onRebuilding: createListener<{ status: 'start' | 'done' }>('agent:rebuilding'),

  /** 异步后台任务完成通知 */
  onBackgroundTaskCompleted: createListener<{ taskId: string; result: string }>('background:task:completed'),

  // 流式聊天
  chatStream: (
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
  ) => {
    ipcRenderer.on('agent:stream:chunk', (_event, data: StreamChunk) => {
      callbacks.onChunk(data)
    })
    ipcRenderer.once('agent:stream:done', () => {
      callbacks.onDone()
      cleanup()
    })
    ipcRenderer.once('agent:stream:error', (_event, data: { error: string }) => {
      callbacks.onError(data.error)
      cleanup()
    })

    function cleanup() {
      ipcRenderer.removeAllListeners('agent:stream:chunk')
      ipcRenderer.removeAllListeners('agent:stream:done')
      ipcRenderer.removeAllListeners('agent:stream:error')
    }

    ipcRenderer.send('agent:chat:stream', messages)
  },

  /** 停止当前流式对话 */
  stop: () => ipcRenderer.send('agent:stop'),

  /** 更新 Agent 配置版本，触发 Agent 重建 */
  updateVersion: () =>
    ipcRenderer.invoke('agent:updateVersion') as Promise<{ ok: boolean; error?: string }>,

  /** 切换迷你窗口模式 */
  toggleMiniWindow: () =>
    ipcRenderer.invoke('window:toggleMini') as Promise<boolean>,

  /** 查询异步任务队列 */
  queryTaskQueue: () =>
    ipcRenderer.invoke('task:queryQueue') as Promise<ApiResponse<{ taskQueue: unknown[]; runningTaskQueue: unknown[] }>>,

  /** 取消异步任务 */
  cancelTask: (taskId: string) =>
    ipcRenderer.invoke('task:cancel', taskId) as Promise<ApiResponse<string>>,
}
