/**
 * 文件 API
 *
 * 用法：
 *   import { fileApi } from '@renderer/api/file'
 *   const md = await fileApi.readAgentsMd()
 */

import { message } from 'antd'

type ExportType = 'db' | 'md' | 'all'

const fileApi = {
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
}

export default fileApi
