import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import type { Serialized } from '@langchain/core/load/serializable'
// import type { BaseMessage } from '@langchain/core/messages'
import type { LLMResult } from '@langchain/core/outputs'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/**
 * 临时诊断工具：拦截模型调用，记录完整 prompt 到文件
 *
 * 用法：
 *   在 model.ts 创建模型时加上 callbacks: [tokenLogger]
 *   每次对话后查看 userData/companion/prompt-logs/ 下的 JSON 文件
 *
 * 不再需要时删除 import 和 callbacks 即可
 */

const LOG_DIR = join(app.getPath('userData'), 'companion', 'prompt-logs')
mkdirSync(LOG_DIR, { recursive: true })

class TokenLogger extends BaseCallbackHandler {
  name = 'TokenLogger'

  async handleLLMStart(
    _llm: Serialized,
    prompts: string[],
    _runId: string,
    _parentRunId?: string,
    extraParams?: Record<string, unknown>,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
  ): Promise<void> {
    const timestamp = Date.now()
    const totalChars = prompts.reduce((sum, p) => sum + p.length, 0)

    // 工具信息通过 bindTools 注入，不在文本 prompt 里
    const tools = (extraParams as any)?.invocation_params?.tools ?? []
    const toolList = tools.map((t: any) => ({
      name: t.function?.name ?? t.name ?? 'unknown',
      description: (t.function?.description ?? t.description ?? '').slice(0, 200),
      parameters: t.function?.parameters ?? t.parameters,
    }))

    const dump = {
      timestamp: new Date(timestamp).toISOString(),
      textChars: totalChars,
      estimatedTextTokens: Math.round(totalChars / 3.5),
      toolCount: toolList.length,
      tools: toolList,
      prompts: prompts.map((p) => ({
        length: p.length,
        preview: p.slice(0, 500),
        full: p,
      })),
    }

    const file = join(LOG_DIR, `prompt-${timestamp}.json`)
    writeFileSync(file, JSON.stringify(dump, null, 2), 'utf-8')
    console.log(`[TokenLogger] 文本 ${Math.round(totalChars / 3.5)}t + ${toolList.length} 工具 → ${file}`)
  }

  async handleLLMEnd(
    _output: LLMResult,
    _runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    // 可选：记录输出 token 用量
  }
}

export const tokenLogger = new TokenLogger()
