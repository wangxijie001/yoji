import { ipcRenderer } from 'electron'

/**
 * 创建通用 IPC 推送监听器
 *
 * 与主进程 broadcast() 配对使用，自动处理 ipcRenderer.on / removeListener。
 * 返回的函数调用后返回取消订阅函数，方便在 useEffect cleanup 中使用。
 *
 * 用法：
 *   const emotion = {
 *     onUpdated: createListener<EmotionState>('emotion:updated'),
 *   }
 */
export function createListener<T>(channel: string) {
  return (callback: (data: T) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: T) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}
