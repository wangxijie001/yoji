import { ipcMain } from 'electron'
import { saveMcpConfig } from '../agent/mcp'

export function register(): void {
  ipcMain.handle('mcp:save', async (_, config) => {
    return saveMcpConfig(config)
  })
}



