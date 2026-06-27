import { ipcMain } from 'electron'
import { getConfig } from '../config'
import { ConfigName } from '../../shared/types'

// 通用配置读写——configName 指定操作哪个配置文件（'env' | 'model' 等）
export function register(): void {
  ipcMain.handle('config:getAll', (_, configName: ConfigName) =>
    getConfig(configName).getAll(),
  )

  ipcMain.handle('config:get', (_, configName: ConfigName, key: string) =>
    getConfig(configName).get(key),
  )

  ipcMain.handle('config:set', (_, configName: ConfigName, key: string, value: unknown) =>
    getConfig(configName).set(key, value),
  )

  ipcMain.handle('config:delete', (_, configName: ConfigName, key: string) =>
    getConfig(configName).delete(key),
  )
}
