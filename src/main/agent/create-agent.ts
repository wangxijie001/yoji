import { createDeepAgent, LocalShellBackend, type DeepAgent } from 'deepagents'
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { createModel, type ModelConfig } from './model'
import { AGENTS_MD_TEMPLATE, buildSystemPrompt } from './system-prompt'
import {
  initChatHistory,
} from './utils/chat-history'
import { initEmotionTable } from './emotion/schema'
import { toolList } from './tools'
import { initSkills } from './skills'
import { toolErrorHandler } from './middleware/tool-error-handler'
import { createMcpExecuteAgent } from './children-agent/mcp-execute-agent'
import { getMcpStoreVersion } from '../ipc/mcp'
import { broadcast } from '../ipc/broadcast'

const COMPANION_DIR = join(app.getPath('userData'), 'companion')

//存储和用户聊过的话题和用户画像
const AGENTS_MD_PATH = join(COMPANION_DIR, 'AGENTS.md')


// 持久化 checkpointer，存在 userData/companion/ 目录
// 整个应用生命周期内复用同一个实例，避免重复打开数据库连接
let _checkpointer: SqliteSaver | null = null
function getCheckpointer(): SqliteSaver {
  if (_checkpointer) return _checkpointer
  // 确保 companion 目录存在（首次启动时创建）
  mkdirSync(COMPANION_DIR, { recursive: true })

  // 首次启动时创建 AGENTS.md 模板，Agent 后续会通过 edit_file 自行更新
  if (!existsSync(AGENTS_MD_PATH)) {
    writeFileSync(AGENTS_MD_PATH, AGENTS_MD_TEMPLATE, 'utf-8')
  }

  initChatHistory() // 建 raw_messages、memory_snapshots 等表
  initEmotionTable() // 建 emotion_log 情绪表
  initSkills() // 注入内置 skills 到 companion 目录

  _checkpointer = SqliteSaver.fromConnString(join(COMPANION_DIR, 'companion.db'))
  return _checkpointer
}



// 创建 Agent 实例
let _provider = ''
let _agent: DeepAgent | null = null
let _mcpStoreVersion: string | null = null
export async function createAgent(config: ModelConfig): Promise<DeepAgent> {
    const currentMcpStoreVersion = getMcpStoreVersion()
  if (_provider === config.provider && _agent !== null && currentMcpStoreVersion === _mcpStoreVersion) {
    return _agent
  }

  broadcast('agent:rebuilding', { status: 'start' })

  _provider = config.provider
  _mcpStoreVersion = currentMcpStoreVersion
  const model = createModel(config)
  const mcpExecuteAgent = await createMcpExecuteAgent()
  const systemPrompt = buildSystemPrompt()
  const subagents = mcpExecuteAgent ? [mcpExecuteAgent] : undefined
  _agent = createDeepAgent({
    model,
    systemPrompt,
    tools: toolList,
    subagents,
    // LocalShellBackend: 文件操作锁在 companion 目录内 + execute 执行系统命令
    backend: new LocalShellBackend({
      rootDir: COMPANION_DIR,
      virtualMode: true,
      inheritEnv: true,
      timeout: 30
    }),
    memory: ['/AGENTS.md'],
    skills: ['/skills/builtin/', '/skills/user/'],
    middleware: [toolErrorHandler],
    checkpointer: getCheckpointer(),
    interruptOn: {
      execute: { allowedDecisions: ['approve', 'reject'] },
      install_mcp_server: { allowedDecisions: ['approve', 'reject'] },
      uninstall_mcp_server: { allowedDecisions: ['approve', 'reject'] }
    }
  }) as unknown as DeepAgent

  broadcast('agent:rebuilding', { status: 'done' })
  return _agent
}