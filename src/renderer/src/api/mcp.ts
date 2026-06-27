import { message } from 'antd'

const mcpApi = {
  /** 测试 MCP 服务器连接 */
  testConnection: async (transport: string, url: string) => {
    const hide = message.loading('正在测试连接...', 0)
    try {
      const res = await window.api.mcp.testConnection(transport, url)
      if (!res.ok) throw new Error(res.error)
      return res.data!
    } finally {
      hide()
    }
  },

  /** 更新 MCP 库版本，触发 agent 重建 */
  updateMcpStoreVersion: async () => {
    const res = await window.api.mcp.updateMcpStoreVersion()
    if (!res.ok) throw new Error(res.error)
  },
}

export default mcpApi
