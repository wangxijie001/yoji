import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { chat, chatStream } from '../agent'
import type { ModelConfig } from '../agent/model'
import { getConfig } from '../config'
import { queryMessagesHistory } from '../agent/utils/chat-history'
import type { ModelConfig as StoredModelConfig, ModelProvider, MessageHistoryQuery } from '../../shared/types'

// agentVersion：所有需要 Agent 重建的配置变动（MCP / 子Agent / 模型）统一走此版本号
export const updateAgentVersion = () => {
  getConfig('env').set('agentVersion', uuidv4())
}

export const getAgentVersion = (): string => {
  return (getConfig('env').get('agentVersion') as string) || ''
}

function resolveModelConfig() {
  const activeProvider = getConfig('env').get('activeProvider') as ModelProvider
  const stored = getConfig('model').get(activeProvider) as StoredModelConfig | undefined
  if (!stored) return { error: '请先在设置中配置模型' }
  if (!stored.apiKey) return { error: '请先在设置中配置 API Key' }
  return {
    config: {
      apiKey: stored.apiKey,
      provider: activeProvider,
      model: stored.model,
      baseURL: stored.baseURL || (stored as any).baseUrl || '',
    } as ModelConfig,
  }
}

// Agent 对话——用户输入 + 配置 → Agent 返回结果
export function register(): void {
  let currentAbortController: AbortController | null = null

  // 更新 Agent 版本，触发重建
  ipcMain.handle('agent:updateVersion', async () => {
    try {
      updateAgentVersion()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  // 查询聊天历史
  ipcMain.handle('history:query', async (_, query: MessageHistoryQuery) => {
    try {
      const rows = queryMessagesHistory(query.beforeId, query.limit)
      return { ok: true, data: rows }
    } catch (err) {
      const message = err instanceof Error ? err.message : '查询失败'
      return { ok: false, error: message }
    }
  })

  // 非流式对话
  ipcMain.handle('agent:chat', async (_, messages: { role: 'user' | 'assistant'; content: string }[]) => {
    try {
      const resolved = resolveModelConfig()
      if ('error' in resolved) return { ok: false, error: resolved.error }

      const result = await chat(resolved.config, messages)
      return { ok: true, data: result }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Agent 调用失败'
      return { ok: false, error: message }
    }
  })

  // 停止当前对话
  ipcMain.on('agent:stop', () => {
    currentAbortController?.abort()
  })

  // 流式对话
  ipcMain.on('agent:chat:stream', (event, messages: { role: 'user' | 'assistant'; content: string }[]) => {
    const resolved = resolveModelConfig()
    if ('error' in resolved) {
      event.sender.send('agent:stream:error', { error: resolved.error })
      return
    }

    const abortController = new AbortController()
    currentAbortController = abortController
    abortController.signal.addEventListener('abort', () => {
      currentAbortController = null
    }, { once: true })

    chatStream(resolved.config, messages, {
      onChunk: (content) => {
        event.sender.send('agent:stream:chunk', content)
      },
      onDone: () => {
        currentAbortController = null
        event.sender.send('agent:stream:done')
      },
      onError: (error) => {
        currentAbortController = null
        event.sender.send('agent:stream:error', { error })
      },
    }, abortController.signal)
  })
}
