import { SubAgent } from 'deepagents'
import { childrenAgentConfig, mcpConfig } from '../../../config'
import type { ChildAgentConfig, McpConfig } from '../../../../shared/types'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { toolErrorHandler } from '../../middleware/tool-error-handler'
import mcpUtil, { McpServerConfig } from '../../mcp'
import { toolsStore } from '../../tools'

let mcpClient: MultiServerMCPClient | null = null

/** 创建所有同步子 Agent，统一用一个 MCP 客户端连接，按各 Agent 的 mcpList 分发工具 */
export async function createSyncSubAgents(): Promise<SubAgent[]> {
  const configs = childrenAgentConfig.getAll() as Record<string, ChildAgentConfig>
  const syncAgents = Object.values(configs).filter((a) => !a.isAsync && a.isEnabled)
  if (syncAgents.length === 0) return []

  // 1. 收集所有 Agent 引用的 MCP server（按 key 去重），直接构建连接配置
  const mcpKeySet = new Set<string>()
  for (const agent of syncAgents) {
    for (const mcp of agent.mcpList || []) {
      if (mcp.key) mcpKeySet.add(mcp.key)
    }
  }

  // 2. 构建 MCP server 连接配置
  const mcpServerConfigs: McpServerConfig = {}
  if (mcpKeySet.size > 0) {
    const allMcp = (mcpConfig.getAll() || {}) as Record<string, McpConfig>
    for (const mcp of Object.values(allMcp)) {
      if (mcpKeySet.has(mcp.key) && mcp.isEnabled) {
        mcpServerConfigs[mcp.key] = mcp.config
      }
    }
  }

  // 3. 连接 MCP 获取工具，按 serverKey 预分组
  const allTools = await connectAndGetTools(mcpServerConfigs)
  const toolMap = new Map<string, any[]>()
  for (const t of allTools) {
    const key = t.name.split('__')[0]
    if (!toolMap.has(key)) toolMap.set(key, [])
    toolMap.get(key)!.push(t)
  }
  
  // 4. 组装 SubAgent，直接按 mcpList[].key 取工具
  return syncAgents.map((agent) => {
    const _tools = (agent.mcpList || []).flatMap((m) => toolMap.get(m.key || '') || []) 
    const localTools = (agent.tools || []).map((t) => toolsStore[t])
    return {
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      tools: [..._tools, ...localTools],
      middleware: [toolErrorHandler]
    }
  })
}

/** 连接 MCP 服务器并获取工具列表 */
async function connectAndGetTools(config: McpServerConfig): Promise<any[]> {
  if (Object.keys(config).length === 0) return []

  if (mcpClient) {
    await mcpClient.close().catch(() => {})
    mcpClient = null
  }

  try {
    mcpClient = mcpUtil.createMcpClient(config)

    let timeoutId: ReturnType<typeof setTimeout>
    const tools =
      (await Promise.race([
        mcpClient.getTools(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('MCP 连接超时')), 15000)
        })
      ]).finally(() => clearTimeout(timeoutId!))) || []

    return tools
  } catch (error) {
    console.error('[SyncAgents] MCP 连接失败:', (error as Error).message)
    return []
  }
}

export default createSyncSubAgents
