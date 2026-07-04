import { createDeepAgent, LocalShellBackend, type DeepAgent } from 'deepagents'
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite'
import { app } from 'electron'
import { join } from 'path'
import { createModel, type ModelConfig } from './model'
import { buildSystemPrompt } from './system-prompt'
import { getFullToolList } from './tools'
import { toolErrorHandler } from './middleware/tool-error-handler'
import { getAgentVersion } from '../ipc/agent'
import { broadcast } from '../ipc/broadcast'
import  createSyncSubAgents  from './children-agent/sync'



const COMPANION_DIR = join(app.getPath('userData'), 'companion')


// 持久化 checkpointer，存在 userData/companion/ 目录
// 整个应用生命周期内复用同一个实例，避免重复打开数据库连接
export let _checkpointer: SqliteSaver | null = null
function getCheckpointer(): SqliteSaver {
  if (_checkpointer) return _checkpointer
  _checkpointer = SqliteSaver.fromConnString(join(COMPANION_DIR, 'companion.db'))
  return _checkpointer
}



// 创建 Agent 实例
let _agent: DeepAgent | null = null
let _agentVersion: string | null = null
export async function createAgent(config: ModelConfig): Promise<DeepAgent> {
  const currentVersion = getAgentVersion()
  if (_agent !== null && currentVersion === _agentVersion) {
    return _agent
  }

  broadcast('agent:rebuilding', { status: 'start' })

  _agentVersion = currentVersion
  const model = createModel(config)
  const syncSubAgents = await createSyncSubAgents()
  const systemPrompt = buildSystemPrompt()
  _agent = createDeepAgent({
    model,
    systemPrompt,
    tools: await getFullToolList(),
    subagents: syncSubAgents,
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