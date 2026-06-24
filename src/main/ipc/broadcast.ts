import { BrowserWindow } from 'electron'

/**
 * 广播消息到所有渲染进程窗口
 *
 * 用法：broadcast('emotion:updated', data)
 */
export function broadcast(channel: string, data: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, data)
  })
}
