import { ipcRenderer } from 'electron'

// 通用配置通道——configName 指定操作哪个配置文件（'env' | 'model' | 'mcp' 等）
export const config = {
  getAll: (configName: string) => ipcRenderer.invoke('config:getAll', configName),
  get: (configName: string, key: string) => ipcRenderer.invoke('config:get', configName, key),
  set: (configName: string, key: string, value: unknown) =>
    ipcRenderer.invoke('config:set', configName, key, value),
  delete: (configName: string, key: string) =>
    ipcRenderer.invoke('config:delete', configName, key),
}
