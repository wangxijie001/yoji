import { MultiServerMCPClient } from "@langchain/mcp-adapters";


export type McpServerConfig = Record<string, {
  transport?: 'sse' | 'http' | 'stdio'
  url?: string                     // http/sse
  command?: string                 // stdio
  args?: string[]                  // stdio
}>


// 获取 MCP 工具列表（获取完自动关闭连接，不保持长连接）
const fetchMcpTools = async (config: McpServerConfig): Promise<any[]> => {
  if (Object.keys(config).length === 0) return []

  const client = new MultiServerMCPClient({
    // @langchain/mcp-adapters 类型约束过紧，运行时正确识别 transport 类型
    mcpServers: config as any,
    prefixToolNameWithServerName: true,
    additionalToolNamePrefix: ''
  })

  try {
    let timeoutId: ReturnType<typeof setTimeout>
    const tools = await Promise.race([
      client.getTools(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('MCP 连接超时')), 15000)
      })
    ]).finally(() => clearTimeout(timeoutId!))
    return tools || []
  } finally {
    await client.close().catch(() => {})
  }
}


//创建mcp客户端
export const createMcpClient = (config: McpServerConfig): MultiServerMCPClient => {
  return new MultiServerMCPClient({
    mcpServers: config as any,
    prefixToolNameWithServerName: true,
    additionalToolNamePrefix: ''
  })
}

export default {
  fetchMcpTools,
  createMcpClient
}
