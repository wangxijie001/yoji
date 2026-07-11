import { HumanMessage, AIMessage, type BaseMessage, SystemMessage } from '@langchain/core/messages'
import { Command } from '@langchain/langgraph'
import { type ModelConfig } from './model'
import { ChatMessage, StreamCallbacks } from '../../shared/types'
import { cleanupCheckpoints, deleteMessageByIndex } from './utils/checkpoint-cleaner'
import { generateAndStoreSnapshot, insertMessageHistory } from './utils/chat-history'

import { changeEmotion, getCurrentEmotionInfo } from './emotion'
import { tts } from './utils/tts'
import { createAgent } from './create-agent'
import { envConfig } from '../config'
import dayjs from 'dayjs'
import { updateTaskRunningInfo } from './task-monitor'
import { v4 as uuidv4 } from 'uuid'


// 固定线程 ID——整个应用只有这一条持续对话
const THREAD_ID = 'companion'
const threadConfig = { configurable: { thread_id: THREAD_ID } }

// 便捷方法：将简单的 { role, content } 转换为 LangChain 消息类型
export async function chat(config: ModelConfig, messages: ChatMessage[]) {
  const agent = await createAgent(config)

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
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const agent = await createAgent(config)
  const _taskUuid = uuidv4()
  let userMessage = ''
  /** 中断审批决策，仅 role='user' 且有未处理中断时传 */
  let interruptDecision: ChatMessage['interruptDecision'] | undefined = undefined
  const langchainMessages: BaseMessage[] = messages.map((m) => {
    let _message: SystemMessage | AIMessage | HumanMessage
    switch (m.role) {
      case 'system':
        _message = new SystemMessage({ content: m.content })
        break
      case 'assistant'://此处表示ai主动发起对话
        _message = new HumanMessage({ content: m.content })
        break
      default:
        _message = new HumanMessage({ content: `用户消息：${m.content}` })
        userMessage = m.content
        interruptDecision = m.interruptDecision
        break
    }
      updateTaskRunningInfo('main:' + _taskUuid, {
        taskId: 'main:' + _taskUuid,
        params:JSON.stringify(m),
        agentId:"yoji",
        status: 'running',
        toolsMessage: [],
        thinkMessage: '',
        mainMessage: '',
        createdAt: Date.now(),
        endTime: null
      })
    return _message
  })

  let interruptCommand: Command | null = null

  if (interruptDecision) {
    // 用户明确处理中断：构建 Command，继续向下执行
    const decisions = [{ type: interruptDecision, message: userMessage }]
    interruptCommand = new Command({ resume: { decisions } })
  } else {
    // 非中断消息：检查是否有未处理的中断，有则自动拒绝
    const lastState = await (agent as any).getState(threadConfig)
    const pendingInterrupts = lastState?.tasks?.flatMap((t: any) => t.interrupts || []) || []
    if (pendingInterrupts.length > 0) {
      const decisions = [
        {
          type: 'reject' as const,
          message: 'User rejected this action. Do not retry this tool call.'
        }
      ]
      // stream 方式 resume，invoke 有兼容问题
      const rejectStream = await (agent as any).stream(new Command({ resume: { decisions } }), {
        ...threadConfig,
        streamMode: 'updates'
      })
      for await (const _ of rejectStream) {
        /* 消费完毕 */
      }
    }
  }

  try {
    // 记录用户消息
    if (userMessage) {
      insertMessageHistory({
        session_id: 'main',
        role: 'user',
        content: userMessage
      })
    }

    const emotion = getCurrentEmotionInfo()
    if (emotion) {
      const currentTime = dayjs().format("YYYY-MM-DD HH:mm:ss")
      const _systemMessage = new HumanMessage({
        content: `我是你的情绪提示，你当前的情绪：${emotion}，当前时间：${currentTime}`
      })
      langchainMessages.unshift(_systemMessage)
    }

    const streamInput: any = interruptCommand || { messages: langchainMessages }
    const streamConfig: any = {
      ...threadConfig,
      streamMode: ['messages', 'updates'],
      subgraphs: true,
      version: 'v2',
      signal
    }

    const stream: any = await agent.stream(streamInput, streamConfig)
    let totalMessages = ''
    for await (const [namespace, mode, data] of stream) {
      const isSubAgent = namespace && namespace.length > 1
      // 1. 处理流式输出：思考过程与最终答案
      if (mode === 'messages') {
        const msg = Array.isArray(data) ? data[0] : data

        // 实时打印思考过程 (增量流)
        if (msg.additional_kwargs?.reasoning_content) {
          const data = { content: msg.additional_kwargs.reasoning_content, type: 'think' }
          callbacks.onChunk(data)
          updateTaskRunningInfo('main:' + _taskUuid, {thinkMessage:data.content})
        }

        // 实时打印最终答案
        if (msg.type === 'ai' && !!msg.content) {
          //子agent输出
          if (namespace && namespace.length > 1) {
            // const data = { content: msg.content, type: 'think' }
            // callbacks.onChunk(data)
            //  updateTaskRunningInfo('main:' + _taskUuid, {thinkMessage:data.content})
          } else {
            const data = { content: msg.content, type: 'result' }
            totalMessages += msg.content
            //语音播报
            if (tts.isEnabled()) tts.feed(msg.content as string)
            callbacks.onChunk(data)
            updateTaskRunningInfo('main:' + _taskUuid, {mainMessage:data.content})
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
              let data = {
                content: `·\n\n${msg.name}：${msg.name === 'push_async_task' ? `已发起异步任务调度，等待结果...` : msg.content || ''}`,
                type: 'toolReturn'
              }

              if (msg.name === 'internet_search') {
                try {
                  results = JSON.parse(msg.content).results
                  if (Array.isArray(results)) {
                    const resLength = results.length
                    const urlList = results.map((item: { url: any }) => item.url).join('\n\n')
                    data = {
                      content: `\n\n${msg.name}：查询到${resLength}个结果 \n\n${urlList}`,
                      type: 'toolReturn'
                    }
                  }
                } catch (error) {}
              }

              callbacks.onChunk(data)
              updateTaskRunningInfo('main:' + _taskUuid, { toolsMessage: {id: msg.tool_call_id,content: msg.content} })
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
                  content: `\n\n调用${tc.name}, 参数：${JSON.stringify(tc.args)}\n\n`,
                  type: 'toolparams'
                }
                callbacks.onChunk(data)               
                updateTaskRunningInfo('main:' + _taskUuid, { toolsMessage: {id: tc.id, name:tc.name, params: JSON.stringify(tc.args)} })
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
            totalMessages += '等待确认。'
            //语音播报
            if (tts.isEnabled()) tts.feed('等待确认。')
            callbacks.onChunk({ content: '等待确认。', type: 'result' })
            updateTaskRunningInfo('main:' + _taskUuid, { mainMessage:"工具执行，等待确认。",status:'stopped' })
          }
        }
      }
    }

    callbacks.onDone()
    updateTaskRunningInfo('main:' + _taskUuid, { status:'completed' })
    //播放剩余半句
    tts.flush()
    //清理checkpoint快照
    cleanupCheckpoints(5)
    //记录聊天记录
    insertMessageHistory({
      session_id: 'main',
      role: 'assistant',
      content: totalMessages
    })
    //生成聊天记录摘要
    generateAndStoreSnapshot(config)
    //分析情绪, 中断意见不涉及情绪分析
    !interruptDecision &&
      changeEmotion([
        { role: 'user', content: userMessage },
        { role: 'assistant', content: totalMessages }
      ]).finally(() => {
        // 更新最新用户消息(情绪系统获取的是上次用户消息，所以必须情绪工具执行完后再更新最新用户消息)
        if (userMessage) {
          envConfig.set('latestUserMessage', { createdAt: Date.now(), content: userMessage })
        }
      })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      callbacks.onDone()
      updateTaskRunningInfo('main:' + _taskUuid, { mainMessage:'用户取消任务', status:'stopped' })
      return
    }
    const errMsg = err instanceof Error ? err.message : '流式调用失败'

    // 自动修复：deepagents 产生的 file 内容块不被 DeepSeek/Qwen 支持
    const match = errMsg.match(/messages\[(\d+)\].*unknown variant.*file/)
    if (match) {
      const badIndex = parseInt(match[1], 10)
      await deleteMessageByIndex(agent, THREAD_ID, badIndex - 1)
      callbacks.onError(
        `已自动修复：移除了第 ${badIndex + 1} 条不支持的消息内容，请重新发送。`
      )
      updateTaskRunningInfo('main:' + _taskUuid, { mainMessage: `已自动修复：移除了第 ${badIndex + 1} 条不支持的消息内容，请重新发送。`, status:'stopped'})
      return
    }

    callbacks.onError(errMsg)
    updateTaskRunningInfo('main:' + _taskUuid, { mainMessage: errMsg, status:'failed'})
    return
  }
}
