import { ipcRenderer } from 'electron'

export const mcp = {
  /** 测试 MCP 服务器连接，返回工具列表 */
  testConnection: (transport: string, url: string) =>
    ipcRenderer.invoke('mcp:testConnection', transport, url) as Promise<{
      ok: boolean
      data?: { name: string; description: string }[]
      error?: string
    }>,

  /** 更新 MCP 库版本号，触发 agent 重建 */
  updateMcpStoreVersion: () =>
    ipcRenderer.invoke('mcp:updateMcpStoreVersion') as Promise<{ ok: boolean; error?: string }>,
}
