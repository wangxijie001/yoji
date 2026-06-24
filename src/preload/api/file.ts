import { ipcRenderer } from 'electron'
import type { ExportType } from '../../main/ipc/file'

export const file = {
  readAgentsMd: () =>
    ipcRenderer.invoke('file:readAgentsMd') as Promise<{ ok: boolean; data?: string; error?: string }>,

  /** 导出 companion 文件，type: 'db' | 'md' | 'all' */
  exportFile: (type: ExportType) =>
    ipcRenderer.invoke('file:export', type) as Promise<{ ok: boolean; data?: string; error?: string }>,

  /** 导入文件，type: 'db' | 'md' | 'all' */
  importFile: (type: ExportType) =>
    ipcRenderer.invoke('file:import', type) as Promise<{ ok: boolean; data?: string; error?: string }>,
}
