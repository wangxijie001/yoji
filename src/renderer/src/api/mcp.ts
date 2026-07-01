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
}

export default mcpApi
