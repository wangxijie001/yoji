import { ipcRenderer } from 'electron'

// HTTP 请求——渲染进程通过此通道调用外部接口
export const http = {
  request: (config: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    url: string
    data?: unknown
    params?: Record<string, unknown>
  }) => ipcRenderer.invoke('http:request', config),
}
