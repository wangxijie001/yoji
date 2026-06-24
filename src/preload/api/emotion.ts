import { ipcRenderer } from 'electron'
import type { EmotionState } from '../../shared/types'
import { createListener } from './listener'

export const emotion = {
  getLog: (limit: number, id?: number) =>
    ipcRenderer.invoke('emotion:log', limit, id) as Promise<{ ok: boolean; data?: EmotionState[]; error?: string }>,

  /** 监听情绪更新（主进程主动推送），返回取消订阅函数 */
  onUpdated: createListener<EmotionState>('emotion:updated'),
}
