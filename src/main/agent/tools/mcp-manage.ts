import { tool } from 'langchain'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { mcpConfig } from '../../config'
import { updateMcpStoreVersion } from '../../ipc/mcp'

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
      await updateMcpStoreVersion()
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
      const list = Object.entries(all).map(([uuid, cfg]) => ({
        uuid,
        name: cfg.name,
        key: cfg.key,
        description: cfg.description,
        transport: (cfg.config as Record<string, unknown>)?.transport,
        url: (cfg.config as Record<string, unknown>)?.url,
        isEnabled: cfg.isEnabled,
        toolsCount: Array.isArray(cfg.tools) ? (cfg.tools as unknown[]).length : 0
      }))
      if (list.length === 0) return '当前没有安装任何 MCP 服务器。可用 install_mcp_server 工具安装。'
      return JSON.stringify(list, null, 2)
    } catch (err) {
      return `获取 MCP 服务器列表失败：${(err as Error).message}`
    }
  },
  {
    name: 'list_mcp_servers',
    description:
      '查看本地已安装的所有 MCP 服务器列表，包括 uuid、名称、启用状态、工具数量。安装/修改前先调用此工具了解当前配置。',
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
    uuid: existingUuid
  }: {
    name: string
    key: string
    description: string
    transport: string
    url: string
    uuid?: string
  }) => {
    // 先测试连接
    let client: MultiServerMCPClient | null = null
    try {
      client = new MultiServerMCPClient({
        _test: {
          transport: transport as 'sse' | 'http',
          url
        }
      })
      let timeoutId: ReturnType<typeof setTimeout>
      const tools = await Promise.race([
        client.getTools(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('连接超时(15s)')), 15000)
        })
      ])
      clearTimeout(timeoutId!)

      // 连接成功，保存配置（传 uuid 则更新，不传则新建）
      const uuid = existingUuid || uuidv4()
      mcpConfig.set(uuid, {
        key,
        uuid,
        name,
        description,
        config: { transport, url },
        isEnabled: true,
        tools: tools.map((t: { name: string; description: string }) => ({
          name: t.name,
          description: t.description
        }))
      })

      await updateMcpStoreVersion()

      return `安装成功！MCP 服务器 "${name}" 已启用，发现 ${tools.length} 个工具：${tools.map((t: { name: string }) => t.name).join('、')}。下一轮对话即可使用。`
    } catch (err) {
      await client?.close().catch(() => {})
      return `安装失败：${(err as Error).message}。请检查 URL 和传输协议是否正确。`
    } finally {
      client && client.close().catch(() => {})
    }
  },
  {
    name: 'install_mcp_server',
    description:
      '安装或修改 MCP 服务器。先测试连接是否可用，可用则保存配置并启用。不传 uuid 则新建，传 uuid 则更新已有配置。安装后下一轮对话即可使用新工具。适用场景：用户要求添加/修改外部 MCP 服务时调用。',
    schema: z.object({
      name: z.string().describe('MCP 服务器名称，如"12306订票工具"'),
      key: z.string().describe('唯一标识 key，以 "-mcp" 结尾的字符串，如"12306-mcp"'),
      description: z.string().describe('服务器功能简介,200个字符以内'),
      transport: z.string().describe('传输协议：sse 或 http'),
      url: z.string().describe('MCP 服务器 SSE/HTTP URL'),
      uuid: z.string().optional().describe('可选，修改已有MCP服务配置时传入目标 uuid，不传则新建')
    })
  }
)