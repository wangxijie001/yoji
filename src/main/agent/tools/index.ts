import { searchMemories, fetchRawMessages, queryMessageDatabase } from './search-memories'
import { searchEmotionLog } from './search-emotion-log'
import { internetSearch } from './internet-search'
import { uninstallMcpServer, listMcpServers, installMcpServer } from './mcp-manage'
import {
  cancelAsyncTask,
  pushAsyncTask,
  getAsyncTaskAgent,
  getAsyncTaskResult
} from '../children-agent/async/tools'
import { previewHtml } from './preview-html'
import { mcpConfig } from '../../config'
import type { McpConfig } from '../../../shared/types'
import mcpUtil from '../mcp'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { macosReadUI } from './software -control/macos-read-ui'
import {
  macosLaunchApp,
  macosListApps,
  macosClick,
  macosTypeText,
  macosPressKey,
  macosQuitApp
} from './software -control/macos-app-control'

let mainMcpClient: MultiServerMCPClient | null = null
export const toolsStore = {
  search_memories: searchMemories,
  fetch_raw_messages: fetchRawMessages,
  query_message_database: queryMessageDatabase,
  search_emotion_log: searchEmotionLog,
  internet_search: internetSearch,
  list_mcp_servers: listMcpServers,
  install_mcp_server: installMcpServer,
  uninstall_mcp_server: uninstallMcpServer,
  push_async_task: pushAsyncTask,
  get_async_task_agent: getAsyncTaskAgent,
  get_async_task_result: getAsyncTaskResult,
  abort_async_task: cancelAsyncTask,
  preview_html: previewHtml,

  //实验性工具
  macos_read_ui: macosReadUI,
  macos_list_apps: macosListApps,
  macos_launch_app: macosLaunchApp,
  macos_click: macosClick,
  macos_type_text: macosTypeText,
  macos_press_key: macosPressKey,
  macos_quit_app: macosQuitApp
}

// 获取注入主 Agent 的 MCP 工具（isExposeToMain + isEnabled），维持长连接
async function getMainMcpTools(): Promise<any[]> {
  // 先关闭旧连接
  if (mainMcpClient) {
    await mainMcpClient.close().catch(() => {})
    mainMcpClient = null
  }

  const allMcp = (mcpConfig.getAll() || {}) as Record<string, McpConfig>
  const exposed = Object.values(allMcp).filter((m) => m.isExposeToMain && m.isEnabled)
  if (exposed.length === 0) return []

  const serverConfigs: Record<string, any> = {}
  for (const mcp of exposed) {
    serverConfigs[mcp.key] = mcp.config
  }

  mainMcpClient = mcpUtil.createMcpClient(serverConfigs)
  return mainMcpClient.getTools()
}

export const mainAgentToolList = [
  searchMemories,
  fetchRawMessages,
  queryMessageDatabase,
  searchEmotionLog,
  internetSearch,
  pushAsyncTask,
  getAsyncTaskAgent,
  getAsyncTaskResult,
  cancelAsyncTask,
  previewHtml
]

// 获取完整工具列表（含注入主 Agent 的 MCP 工具）
export async function getFullToolList(): Promise<any[]> {
  const mcpTools = await getMainMcpTools().catch(() => [])
  return [...mainAgentToolList, ...mcpTools]
}
