import { ipcMain } from 'electron'
import { tts } from '../agent/utils/tts'
import { broadcast } from './broadcast'

export function register(): void {
  // 查询 TTS 开关状态
  ipcMain.handle('tts:getEnabled', async () => {
    return { ok: true, data: tts.isEnabled() }
  })

  // 设置 TTS 开关状态
  ipcMain.handle('tts:setEnabled', async (_, enabled: boolean) => {
    tts.setEnabled(enabled)
    broadcast('tts:enabledChanged', enabled)
    return { ok: true, data: enabled }
  })

  // 切换 TTS 开关
  ipcMain.handle('tts:toggle', async () => {
    const next = !tts.isEnabled()
    tts.setEnabled(next)
    broadcast('tts:enabledChanged', next)
    return { ok: true, data: next }
  })
}
