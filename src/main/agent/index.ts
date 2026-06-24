import { createDeepAgent, FilesystemBackend, type DeepAgent } from 'deepagents'
import { HumanMessage, AIMessage, type BaseMessage, SystemMessage } from '@langchain/core/messages'
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { createModel, type ModelConfig } from './model'
import { buildSystemPrompt } from './system-prompt'
import { ChatMessage, StreamCallbacks } from '../../shared/types'
import { cleanupCheckpoints } from './utils/checkpoint-cleaner'
import {
  generateAndStoreSnapshot,
  initChatHistory,
  insertMessageHistory
} from './utils/chat-history'
import { initEmotionTable } from './emotion/schema'
import { toolList } from './tools'
import { changeEmotion, getCurrentEmotionInfo } from './emotion'
import { initSkills } from './skills'

const COMPANION_DIR = join(app.getPath('userData'), 'companion')

//存储和用户聊过的话题和用户画像
const AGENTS_MD_PATH = join(COMPANION_DIR, 'AGENTS.md')
const AGENTS_MD_TEMPLATE = `# 用户画像
- 尚未记录（Agent 会在对话中逐步了解你）

# 主题记录
- 尚未记录（Agent 会在对话中逐步建立）
#关于你
 -你初次来到这个世界，对一切充满着好奇
 -但是你对这个世界了解不多，不知道自己是谁，对一切充满着陌生感
`

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

// 固定线程 ID——整个应用只有这一条持续对话
const THREAD_ID = 'companion'
const threadConfig = { configurable: { thread_id: THREAD_ID } }

// 创建 Agent 实例
let _provider = ''
let _agent: DeepAgent | null = null
export function createAgent(config: ModelConfig): DeepAgent {
  if (_provider === config.provider && _agent !== null) {
    return _agent
  }
  _provider = config.provider
  const model = createModel(config)
  const systemPrompt = buildSystemPrompt()
  _agent = createDeepAgent({
    model,
    systemPrompt,
    tools: toolList,
    // FilesystemBackend: 将 companion 目录映射为虚拟文件系统
    // virtualMode 下，Agent 只能操作该目录内的文件，无法越界
    backend: new FilesystemBackend({ rootDir: COMPANION_DIR, virtualMode: true }),
    memory: [AGENTS_MD_PATH],
    skills: ['/skills/builtin/', '/skills/user/'],
    checkpointer: getCheckpointer()
  }) as unknown as DeepAgent
  return _agent
}

// 便捷方法：将简单的 { role, content } 转换为 LangChain 消息类型
export async function chat(config: ModelConfig, messages: ChatMessage[]) {
  const agent = createAgent(config)

  const langchainMessages: BaseMessage[] = messages.map((m) =>
    m.role === 'assistant'
      ? new AIMessage({ content: m.content })
      : new HumanMessage({ content: m.content })
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = agent.invoke({ messages: langchainMessages } as any, threadConfig)
  result.then(() => {
    cleanupCheckpoints(1)
  })
  return result
}

// 流式对话——逐个 token 推送给回调
export async function chatStream(
  config: ModelConfig,
  messages: ChatMessage[],
  callbacks: StreamCallbacks
): Promise<void> {
  const agent = createAgent(config)
  let userMessage = ''
  const langchainMessages: BaseMessage[] = messages.map((m) => {
    let _message: SystemMessage | AIMessage | HumanMessage 
    switch (m.role) {
      case 'system':
        _message = new SystemMessage({ content: m.content })
        break
      case 'assistant':
        _message = new AIMessage({ content: m.content })
        break
      default:
        _message = new HumanMessage({ content: m.content })
        userMessage += m.content
        break
    }
    return _message
  })
  const currentEmotionInfo = getCurrentEmotionInfo()
  if (currentEmotionInfo) {
    langchainMessages.push(new SystemMessage({ content: `你当前情绪：${currentEmotionInfo}` }))
  }

  try {
    // 记录用户消息
    insertMessageHistory({
      session_id: 'main',
      role: 'user',
      content: userMessage || messages.filter(m => m.role === 'user').map(m => m.content).join('')
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await agent.stream({ messages: langchainMessages } as any, {
      ...threadConfig,
      streamMode: ['messages', 'updates'],
      subgraphs: true
    })
    let totalMessages = ''
    for await (const [namespace, mode, data] of stream) {
      // 1. 处理流式输出：思考过程与最终答案
      if (mode === 'messages') {
        const msg = Array.isArray(data) ? data[0] : data
        // 实时打印思考过程 (增量流)
        if (msg.additional_kwargs?.reasoning_content) {
          const data = { content: msg.additional_kwargs.reasoning_content, type: 'think' }
          callbacks.onChunk(data)
        }

        // 实时打印最终答案
        if (msg.type === 'ai' && !!msg.content) {
          //子agent输出
          if (namespace && namespace.length > 1) {
            const data = { content: msg.content, type: 'think' }
            callbacks.onChunk(data)
          } else {
            const data = { content: msg.content, type: 'result' }
            totalMessages += msg.content
            callbacks.onChunk(data)
          }
        }
      }

      // 2. 处理节点更新：监控工具调用详细信息
      if (mode === 'updates') {
        // 检查是否有节点执行了 tool 调用
        if (data.tools) {
          const toolMessages = data.tools.messages || []
          for (const msg of toolMessages) {
            // 当工具执行完成后，这里会有 ToolMessage
            if (msg.type === 'tool') {
              let results = []
              let data = { content: '查询到了一些信息，我来分析一下', type: 'toolReturn' }

              if (msg.name === 'internet_search') {
                try {
                  results = JSON.parse(msg.content).results
                } catch (error) {}

                const resLength = results.length
                const urlList = results.map((item: { url: any }) => item.url).join('\n\n')
                data = {
                  content: `\n\n查询到${resLength}个结果 \n\n${urlList}`,
                  type: 'toolReturn'
                }
                callbacks.onChunk(data)
              }
            }
          }
        }

        // 检查模型发起的工具调用请求 (即调用前的规划信息)
        if (data.model_request) {
          const msgs = data.model_request.messages || []
          for (const msg of msgs) {
            if (msg.tool_calls?.length) {
              for (const tc of msg.tool_calls) {
                const data = {
                  content: `\n\n调用${tc.name}, 参数：${tc.args?.query || JSON.stringify(tc.args)}`,
                  type: 'toolparams'
                }
                callbacks.onChunk(data)
              }
            }
          }
        }

        //检查是否有工具中断
        if (data.__interrupt__) {
          const interrupts = data.__interrupt__[0].value
          const actionRequests = interrupts.actionRequests
          const reviewConfigs = interrupts.reviewConfigs

          // Create a lookup map from tool name to review config
          const configMap = Object.fromEntries(
            reviewConfigs.map((cfg: any) => [cfg.actionName, cfg])
          )

          // Display the pending actions to the user
          for (const action of actionRequests) {
            const reviewConfig = configMap[action.name]
            const data = {
              content: `Tool: ${action.name}\nArguments: ${JSON.stringify(action.args)}`,
              type: 'requires_approval',
              operate: reviewConfig.allowedDecisions
            }
            callbacks.onChunk(data)
          }
        }
      }
    }
    callbacks.onDone()
    //清理checkpoint快照
    cleanupCheckpoints(1)
    //记录聊天记录
    insertMessageHistory({
      session_id: 'main',
      role: 'assistant',
      content: totalMessages
    })
    //生成聊天记录摘要
    generateAndStoreSnapshot(config)
    //分析情绪
    changeEmotion([
      { role: 'user', content: userMessage },
      { role: 'assistant', content: totalMessages }
    ])
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : '流式调用失败')
  }
}
