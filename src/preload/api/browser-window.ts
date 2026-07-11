import { ipcRenderer } from 'electron'

export const browserWindow = {
  // 传入地址，额外开一个窗口打开
  //   - http(s) 开头        → 外部网页
  //   - 其他(如 /task-monitor) → 应用内路由
  open: (url: string) =>
    ipcRenderer.invoke('browserWindow:open', url) as Promise<{ ok: boolean }>
}
