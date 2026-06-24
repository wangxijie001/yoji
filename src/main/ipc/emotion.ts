import { ipcMain } from 'electron'
import { getCurrentEmotionLog } from '../agent/emotion/schema'

export function register(): void {
  ipcMain.handle('emotion:log', async (_, limit: number, id?: number) => {
    try {
      const rows = getCurrentEmotionLog(limit, id)
      return { ok: true, data: rows }
    } catch (err) {
      const message = err instanceof Error ? err.message : '查询情绪日志失败'
      return { ok: false, error: message }
    }
  })
}
