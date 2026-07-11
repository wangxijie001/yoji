import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { mcpConfig } from '../../config'
import { updateAgentVersion } from '../../ipc/agent'

export type McpServerConfig = Record<string, {
  transport?: 'sse' | 'http' | 'stdio'
  url?: string                     // http/sse
  command?: string                 // stdio
  args?: string[]                  // stdio
  env?: Record<string, string>
}>


// 获取 MCP 工具列表（获取完自动关闭连接，不保持长连接）
const fetchMcpTools = async (config: McpServerConfig): Promise<any[]> => {
  if (Object.keys(config).length === 0) return []

  const client = createMcpClient(config)

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
  // 连接时合并用户 PATH 到 system PATH（仅生产环境）；开发环境去掉 env
  const mcpServers = Object.fromEntries(
    Object.entries(config).map(([k, v]) => {
      const userPath = (v as any).env?.PATH
      if (!app.isPackaged) {
        // 开发环境：PATH 完整，不需要 env
        const { env, ...rest } = v as any
        return [k, rest]
      }
      if (userPath) {
        return [k, { ...v, env: { PATH: userPath + ':' + (process.env.PATH || '') } }]
      }
      return [k, v]
    })
  )
  return new MultiServerMCPClient({
    mcpServers: mcpServers as any,
    prefixToolNameWithServerName: true,
    additionalToolNamePrefix: ''
  })
}

//测试链接
export const testConnection = async (key: string, serverConfig: any): Promise<{ ok: boolean; data?: { name: string; description: string }[]; error?: string }> => {
  const client = createMcpClient({ [key]: serverConfig })
  try {
    let timeoutId: ReturnType<typeof setTimeout>
    const tools = await Promise.race([
      client.getTools(),
      new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error('连接超时(15s)')), 15000) })
    ]).finally(() => clearTimeout(timeoutId!))
    const toolList = tools.map((t: any) => ({ name: t.name, description: t.description }))
    return { ok: true, data: toolList }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  } finally {
    await client.close().catch(() => {})
  }
}

//保存mcp配置
export const saveMcpConfig = async (config: {
  key: string
  uuid?: string
  name: string
  description: string
  isEnabled?: boolean
  isExposeToMain?: boolean
  transport?: string
  url?: string
  command?: string
  args?: string[]
  envPath?: string
}): Promise<{ ok: boolean; data?: { name: string; description: string }[]; error?: string }> => {
  const { key, name, description, transport, url, command, args, envPath, isEnabled, isExposeToMain, uuid: existingUuid } = config

  // 只存用户原始输入，连接时在 createMcpClient 中合并 system PATH
  const serverConfig = transport === 'stdio'
    ? { transport: 'stdio' as const, command: command || 'npx', args: args || [], ...(envPath ? { env: { PATH: envPath } } : {}) }
    : { transport: (transport || 'sse') as 'sse' | 'http', url: url || '' }

  const connResult = await testConnection(key, serverConfig)
  if (!connResult.ok) return connResult

  // 保存配置
  const uuid = existingUuid || uuidv4()

  mcpConfig.set(uuid, {
    key,
    uuid,
    name,
    description,
    config: serverConfig,
    isEnabled: isEnabled ?? false,
    isExposeToMain: isExposeToMain ?? false,
    tools: connResult.data!,
    version: uuidv4()
  })

  await updateAgentVersion()
  return connResult
}

export default {
  fetchMcpTools,
  createMcpClient,
  testConnection,
  saveMcpConfig
}
