/**
 * 文件 API
 *
 * 用法：
 *   import { fileApi } from '@renderer/api/file'
 *   const md = await fileApi.readAgentsMd()
 */

import { message } from 'antd'
import type { FileEntry } from '@shared/types'

type ExportType = 'db' | 'md' | 'all'

const fileApi = {
  /** 列出 companion 目录下指定路径的直接子级，不传则列出根目录 */
  async listDir(dirPath?: string): Promise<FileEntry[]> {
    const res = await window.api.file.listDir(dirPath)
    if (!res.ok) {
      message.error(res.error || '读取文件列表失败')
      return []
    }
    return res.data ?? []
  },

  /** 读取文件内容，传入 FileEntry.fullPath */
  async readFile(fullPath: string): Promise<{ content: ArrayBuffer; fileName: string; mimeType: string } | null> {
    const res = await window.api.file.readFile(fullPath)
    if (!res.ok) {
      message.error(res.error || '读取文件失败')
      return null
    }
    return res.data ?? null
  },

  async readAgentsMd(): Promise<string> {
    const res = await window.api.file.readAgentsMd()
    if (!res.ok) {
      // message.error(res.error || '读取失败')
      return ''
    }
    return res.data ?? ''
  },

  /** 导出 companion 文件，弹出原生保存/选择对话框，返回导出的目标路径 */
  async exportFile(type: ExportType): Promise<string | null> {
    const res = await window.api.file.exportFile(type)
    if (!res.ok) {
      if (res.error !== '已取消') {
        message.error(res.error || '导出失败')
      }
      return null
    }
    message.success(`已导出到: ${res.data}`)
    return res.data ?? null
  },

  /** 导入文件，弹出原生文件选择对话框，type: 'db' | 'md' | 'all' */
  async importFile(type: ExportType): Promise<boolean> {
    const res = await window.api.file.importFile(type)
    if (!res.ok) {
      if (res.error !== '已取消') {
        message.error(res.error || '导入失败')
      }
      return false
    }
    message.success(res.data || '导入成功')
    return true
  },

  /** 在系统文件管理器中显示文件（macOS Finder / Windows Explorer） */
  async showFileInFolder(fullPath: string): Promise<void> {
    const res = await window.api.file.showFileInFolder(fullPath)
    if (!res.ok) {
      message.error(res.error || '打开失败')
    }
  },
}

export default fileApi
