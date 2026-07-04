import { ipcRenderer } from 'electron'

export const mcp = {
  /** 测试并保存 MCP 服务器配置 */
  save: (config: {
    key: string; name: string; description: string
    uuid?: string; transport?: string; url?: string; command?: string; args?: string[]; isExposeToMain?: boolean; envPath?: string
  }) =>
    ipcRenderer.invoke('mcp:save', config) as Promise<{
      ok: boolean
      data?: { name: string; description: string }[]
      error?: string
    }>,
}
