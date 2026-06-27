import { SubAgent } from 'deepagents'
import { mcpConfig } from '../../config'
import { McpConfig } from '../../../shared/types'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { toolErrorHandler } from '../middleware/tool-error-handler'

type McpServerConfig = Record<string, { transport: 'sse' | 'http'; url: string }>
let mcpClient: MultiServerMCPClient | null = null

const queryMcpTools = (): { config?: McpServerConfig; desc?: string } => {
  const _mcpInfoConfig = mcpConfig.getAll() || {}
  const mcpList = Object.values(_mcpInfoConfig) as McpConfig[]
  if (mcpList.length === 0) {
    return {}
  }

  //组装已启用的MCP server配置项
  const _enabledMcpConfig: McpServerConfig = {}
  let _enabledMcpDesc = '目前有以下已启用的MCP server：'
  mcpList.forEach((item) => {
    const { name, key, config, description, isEnabled } = item
    if (isEnabled) {
      _enabledMcpConfig[key] = {
        transport: config.transport as 'sse' | 'http',
        url: config.url as string
      }
      _enabledMcpDesc += `\n${name}(${key}):${description}\n`
    }
  })

  return {
    config: _enabledMcpConfig,
    desc: _enabledMcpDesc
  }
}

//创建MCP server客户端
const createMcpServerClient = async (config: McpServerConfig) => {
  if (Object.keys(config).length === 0) {
    return
  }
  if (mcpClient) {
    await mcpClient.close().catch(() => {})
    mcpClient = null
  }

  mcpClient = new MultiServerMCPClient({
    mcpServers: config,
    // 可选：避免工具名冲突，不同服务器的同名工具会被加上服务器名称前缀
    prefixToolNameWithServerName: true,
    // 可选：统一添加一个额外的工具名前缀
    additionalToolNamePrefix: ''
  })
}

/**
 * MCP 工具执行子 Agent
 *
 * 主 Agent 通过 task 工具调用，所有 MCP tools schema 隔离在此 Agent 内部。
 */
export async function createMcpExecuteAgent(): Promise<SubAgent | null> {
  let tools:any[] = []
  const { config, desc } = queryMcpTools()
  if (!config || Object.keys(config).length === 0) return null
  try {
    await createMcpServerClient(config)
    let timeoutId: ReturnType<typeof setTimeout>
    tools = (await Promise.race([
      mcpClient!.getTools(),
      new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error('MCP 连接超时')), 15000) })
    ])) || []
    clearTimeout(timeoutId!)
  } catch (error) {
    console.error('[MCP] 连接失败:', (error as Error).message)
    return null
  }


  return {
    name: 'mcp-executor',

    description: `外部 MCP 服务调用器。调用第三方 API 时使用。
调用时请用中文描述清楚用户的原始需求，子 Agent 会自动匹配合适的工具。
${desc}`,

    systemPrompt: `你是 MCP 工具执行器，负责调用外部服务接口完成用户的任务。

## 核心原则
1. **快速匹配**：根据用户需求直接选择最合适的工具，不要犹豫
2. **一次到位**：如果任务需要多个步骤（如"查北京到上海的火车"需要先查车站码再查票），自动串联调用
3. **结果整理**：工具返回的原始数据可能冗长，你需要提取关键信息，用简洁清晰的中文呈现
4. **容错处理**：工具调用失败时，尝试其他方式或诚实告知用户失败原因

## 回复风格
- 用中文回复，语气友好
- 火车票、车次等信息用列表或表格展示更直观
- 不要输出技术细节（如 tool call 过程），只呈现结果

## 重点约束
- 不要编造数据，所有信息必须来自工具返回
- 不要反问用户"我该用哪个工具"，自己判断`,
    // @langchain/mcp-adapters (core@1.2.1) 与 deepagents (core@1.1.48) 版本不一致，运行时兼容
    tools: tools as unknown as SubAgent['tools'],
    middleware: [toolErrorHandler],
  }
}
