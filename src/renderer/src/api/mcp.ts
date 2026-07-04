import { message } from 'antd'

const mcpApi = {
  /** 测试连接并保存 MCP 服务器配置 */
  save: async (config: {
    key: string; name: string; description: string
    uuid?: string; transport?: string; url?: string; command?: string; args?: string[]; isExposeToMain?: boolean; envPath?: string
  }) => {
    const hide = message.loading('正在测试连接...', 0)
    try {
      const res = await window.api.mcp.save(config)
      if (!res.ok) { message.error(res.error || '连接失败'); return null }
      return res.data!
    } finally {
      hide()
    }
  },
}

export default mcpApi
