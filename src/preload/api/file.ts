import { ipcRenderer } from 'electron'
import type { ExportType } from '../../main/ipc/file'
import type { FileEntry } from '../../shared/types'

export const file = {
  readAgentsMd: () =>
    ipcRenderer.invoke('file:readAgentsMd') as Promise<{ ok: boolean; data?: string; error?: string }>,

  /** 列出 companion 目录下指定路径的直接子级，不传则列出根目录 */
  listDir: (dirPath?: string) =>
    ipcRenderer.invoke('file:listDir', dirPath) as Promise<{ ok: boolean; data?: FileEntry[]; error?: string }>,

  /** 读取文件内容，传入 FileEntry.fullPath */
  readFile: (fullPath: string) =>
    ipcRenderer.invoke('file:readFile', fullPath) as Promise<{
      ok: boolean
      data?: { content: ArrayBuffer; fileName: string; mimeType: string }
      error?: string
    }>,

  /** 导出 companion 文件，type: 'db' | 'md' | 'all' */
  exportFile: (type: ExportType) =>
    ipcRenderer.invoke('file:export', type) as Promise<{ ok: boolean; data?: string; error?: string }>,

  /** 导入文件，type: 'db' | 'md' | 'all' */
  importFile: (type: ExportType) =>
    ipcRenderer.invoke('file:import', type) as Promise<{ ok: boolean; data?: string; error?: string }>,

  /** 在系统文件管理器中显示文件（macOS Finder / Windows Explorer） */
  showFileInFolder: (fullPath: string) =>
    ipcRenderer.invoke('file:showFileInFolder', fullPath) as Promise<{ ok: boolean; error?: string }>,
}
