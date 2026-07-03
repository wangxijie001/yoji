import { tool } from "langchain";
import dayjs from 'dayjs'
import { z } from "zod";
import { searchMemories, fetchRawMessages, queryMessageDatabase } from './search-memories'
import { searchEmotionLog } from './search-emotion-log'
import { internetSearch } from './internet-search'
import { uninstallMcpServer, listMcpServers, installMcpServer } from "./mcp-manage";
import { cancelAsyncTask, pushAsyncTask, getAsyncTaskAgent, getAsyncTaskResult } from '../children-agent/async/tools'
import { mcpConfig } from '../../config'
import type { McpConfig } from '../../../shared/types'
import mcpUtil from '../mcp'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'

let mainMcpClient: MultiServerMCPClient | null = null

export const queryCurrentTime = tool(
    async ({}:{}) => {
        try {
            return '当前时间：' +  dayjs().format("YYYY-MM-DD HH:mm:ss");

        } catch (error) {
            return JSON.stringify({ error: `查询当前时间失败: ${error}` });
        }
    },
    {
        name: "query_current_time",
        description: "问题涉及时间时调用该工具，查询当前时间，返回当前时间",
        schema: z.object({}),
    }
);

// 获取注入主 Agent 的 MCP 工具（isExposeToMain + isEnabled），维持长连接
async function getMainMcpTools(): Promise<any[]> {
  // 先关闭旧连接
  if (mainMcpClient) {
    await mainMcpClient.close().catch(() => {})
    mainMcpClient = null
  }

  const allMcp = (mcpConfig.getAll() || {}) as Record<string, McpConfig>
  const exposed = Object.values(allMcp).filter(m => m.isExposeToMain && m.isEnabled)
  if (exposed.length === 0) return []

  const serverConfigs: Record<string, any> = {}
  for (const mcp of exposed) {
    const t = mcp.config.transport || 'sse'
    serverConfigs[mcp.key] = t === 'stdio'
      ? { transport: 'stdio', command: mcp.config.command || 'npx', args: mcp.config.args || [] }
      : { transport: t, url: mcp.config.url || '' }
  }

  mainMcpClient = mcpUtil.createMcpClient(serverConfigs)
  return mainMcpClient.getTools()
}

export const toolList = [ queryCurrentTime,
    searchMemories, fetchRawMessages, queryMessageDatabase,
    searchEmotionLog, internetSearch ,
    listMcpServers,
    installMcpServer,
    uninstallMcpServer,
    pushAsyncTask,
    getAsyncTaskAgent,
    getAsyncTaskResult,
    cancelAsyncTask,
];

// 获取完整工具列表（含注入主 Agent 的 MCP 工具）
export async function getFullToolList(): Promise<any[]> {
  const mcpTools = await getMainMcpTools().catch(() => [])
  return [...toolList, ...mcpTools]
}
