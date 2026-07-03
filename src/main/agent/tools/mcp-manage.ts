import { tool } from 'langchain'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { mcpConfig } from '../../config'
import { updateAgentVersion } from '../../ipc/agent'

/**
 * 卸载 MCP 服务器工具
 */
export const uninstallMcpServer = tool(
  async ({ uuid }: { uuid: string }) => {
    try {
      const all = mcpConfig.getAll() as Record<string, Record<string, unknown>>
      const target = all[uuid]
      if (!target) return `卸载失败：未找到 uuid 为 "${uuid}" 的 MCP 服务器。可用 list_mcp_servers 查看已安装列表。`

      mcpConfig.delete(uuid)
      await updateAgentVersion()
      return `已成功卸载 MCP 服务器 "${target.name}"（${target.key}），下一轮对话生效。`
    } catch (err) {
      return `卸载失败：${(err as Error).message}`
    }
  },
  {
    name: 'uninstall_mcp_server',
    description:
      '卸载指定的 MCP 服务器。需传入 uuid（通过 list_mcp_servers 获取）。卸载后下一轮对话生效。',
    schema: z.object({
      uuid: z.string().describe('要卸载的 MCP 服务器 uuid，通过 list_mcp_servers 获取')
    })
  }
)

/**
 * 查看已安装的 MCP 服务器列表
 */
export const listMcpServers = tool(
  async () => {
    try {
      const all = mcpConfig.getAll() as Record<string, Record<string, unknown>> || {}
      const list = Object.entries(all).map(([uuid, cfg]) => {
        const config = cfg.config as Record<string, unknown>
        const item: Record<string, unknown> = {
          uuid,
          name: cfg.name,
          key: cfg.key,
          description: cfg.description,
          transport: config?.transport,
          isEnabled: cfg.isEnabled,
          isExposeToMain: cfg.isExposeToMain,
          toolsCount: Array.isArray(cfg.tools) ? (cfg.tools as unknown[]).length : 0
        }
        if (config?.transport === 'stdio') {
          item.command = config?.command || 'npx'
          item.args = config?.args
        } else {
          item.url = config?.url
        }
        return item
      })
      if (list.length === 0) return '当前没有安装任何 MCP 服务器。可用 install_mcp_server 工具安装。'
      return JSON.stringify(list, null, 2)
    } catch (err) {
      return `获取 MCP 服务器列表失败：${(err as Error).message}`
    }
  },
  {
    name: 'list_mcp_servers',
    description:
      '查看本地已安装的所有 MCP 服务器列表，包括 uuid、名称、transport、启用状态、工具数量。安装/修改前先调用此工具了解当前配置。',
    schema: z.object({})
  }
)

/**
 * 安装 MCP 服务器工具
 *
 * AI 可自主调用此工具安装新的 MCP 服务器。
 * 安装后自动更新 MCP 库版本号，下一轮对话新工具即可用。
 */
export const installMcpServer = tool(
  async ({
    name,
    key,
    description,
    transport,
    url,
    command,
    args,
    uuid: existingUuid
  }: {
    name: string
    key: string
    description: string
    transport: string
    url?: string
    command?: string
    args?: string[]
    uuid?: string
  }) => {
    // 构建服务端配置
    const isStdio = transport === 'stdio'
    let serverConfig: any

    if (isStdio) {
      serverConfig = {
        transport: 'stdio' as const,
        command: command || 'npx',
        args: args || []
      }
    } else {
      serverConfig = {
        transport: transport as 'sse' | 'http',
        url: url || ''
      }
    }

    // 先测试连接
    const client = new MultiServerMCPClient({ _test: serverConfig })
    try {
      let timeoutId: ReturnType<typeof setTimeout>
      const tools = await Promise.race([
        client.getTools(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('连接超时(15s)')), 15000)
        })
      ]).finally(() => clearTimeout(timeoutId!))

      // 连接成功，保存配置
      const uuid = existingUuid || uuidv4()
      mcpConfig.set(uuid, {
        key,
        uuid,
        name,
        description,
        config: isStdio
          ? { transport: 'stdio', command: command || 'npx', args: args || [] }
          : { transport, url: url || '' },
        isEnabled: true,
        isExposeToMain: false,
        tools: tools.map((t: { name: string; description: string }) => ({
          name: t.name,
          description: t.description
        }))
      })

      await updateAgentVersion()
      return `安装成功！MCP 服务器 "${name}" 已启用，发现 ${tools.length} 个工具：${tools.map((t: { name: string }) => t.name).join('、')}。下一轮对话即可使用。`
    } catch (err) {
      return `安装失败：${(err as Error).message}。请检查 ${isStdio ? 'command/args' : 'URL 和传输协议'} 是否正确。`
    } finally {
      await client.close().catch(() => {})
    }
  },
  {
    name: 'install_mcp_server',
    description:
      '安装或修改 MCP 服务器。先测试连接是否可用，可用则保存配置并启用。支持 stdio(npx命令启动本地进程)、sse、http 三种协议。不传 uuid 则新建，传 uuid 则更新已有配置。',
    schema: z.object({
      name: z.string().describe('MCP 服务器名称，如"Chrome DevTools"'),
      key: z.string().describe('唯一标识 key，如"chrome-devtools-mcp"'),
      description: z.string().describe('服务器功能简介，200个字符以内'),
      transport: z.string().describe('传输协议：sse、http 或 stdio（本地 npx 子进程）'),
      url: z.string().optional().describe('SSE/HTTP 的服务器 URL，transport 为 sse/http 时必填'),
      command: z.string().optional().describe('stdio 模式下的启动命令，默认 npx。如 uvx、node 等'),
      args: z.array(z.string()).optional().describe('stdio 模式下的启动参数，如 ["chrome-devtools-mcp@latest"]'),
      uuid: z.string().optional().describe('可选，修改已有配置时传入目标 uuid，不传则新建')
    })
  }
)