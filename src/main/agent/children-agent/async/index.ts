import { v4 as uuidv4 } from 'uuid'
import { createAgent, HumanMessage } from 'langchain'
import { createModel } from '../../model'
import { getConfig } from '../../../config'
import { ModelProvider, ModelConfig } from '../../../../shared/types'
import agentList from '../agent-list'
import { toolErrorHandler } from '../../middleware/tool-error-handler'
import { _checkpointer } from '../../create-agent'
import { deleteThreadCheckpoints } from '../../utils/checkpoint-cleaner'
import mcpConfig from '../../mcp'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import {
  cleanupExpiredTasks,
  insertTaskResult,
  markTaskNotified,
  queryTaskResultById,
  TaskResult
} from './task-result'
import { broadcast } from '../../../ipc/broadcast'
import { toolsStore } from '../../tools'
import { updateTaskRunningInfo } from '../../task-monitor'

type Task = {
  taskId: string // 任务ID
  params: string // 任务参数
  agentId: string // 任务所属智能体ID
}


let eventLoopRunning: ReturnType<typeof setInterval> | null = null
const MAX_RUNNING_TASKS = 5
// 待执行任务队列
const taskQueue: Task[] = []
// 执行中的任务队列
const runningTaskQueue: Map<string, Task> = new Map()
// 任务结果队列
const taskResultQueue: TaskResult[] = []


// 子智能体缓存映射
// key: agentId(uuid), value: {uuid: string,md5: string,agent:any}
const cacheAgentMap = new Map<
  string,
  {
    uuid: string
    status: 'free' | 'running' | 'failed'
    md5: string
    mcpClient: MultiServerMCPClient
    agent: any
    abortController?: AbortController
  }
>()



// 获取智能体,如果不存在则创建
const getChildAgent = async (agentId: string) => {
  const agentConfig = agentList.getAgent(agentId)
  if (!agentConfig.success || !agentConfig.agent) {
    throw new Error(agentConfig.error || '')
  }

  const cacheAgent = cacheAgentMap.get(agentId)

  if (cacheAgent && cacheAgent.md5 === agentConfig.md5) {
    return cacheAgent.agent
  }

  const { systemPrompt, mcpList, tools } = agentConfig.agent

  // 获取 MCP 工具列表
  if (cacheAgent) {
    await cacheAgent.mcpClient.close()
  }
  const mcpClient = mcpConfig.createMcpClient(mcpList)

  let timeoutId: ReturnType<typeof setTimeout>
  const _tools = await Promise.race([
    mcpClient.getTools(),
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('MCP 连接超时')), 15000)
    })
  ]).finally(() => clearTimeout(timeoutId!))

  // 获取本地工具
  const localTools = (tools || []).map((t) => toolsStore[t])
  _tools.push(...localTools)

  // 获取本地模型配置文件
  const activeProvider = getConfig('env').get('activeProvider') as ModelProvider
  const stored = getConfig('model').get(activeProvider) as ModelConfig

  const _modelConfig = {
    apiKey: stored.apiKey,
    provider: activeProvider,
    model: stored.model,
    baseURL: stored.baseURL
  }

  // 创建模型
  const model = createModel(_modelConfig)
  const abortController = new AbortController()
  // 创建智能体
  const agent = createAgent({
    model: model,
    tools: _tools,
    middleware: [toolErrorHandler],
    systemPrompt: systemPrompt,
    checkpointer: _checkpointer!,
    signal: abortController.signal
  }) as any

  // 缓存智能体
  cacheAgentMap.set(agentId, {
    uuid: agentId,
    status: 'free',
    md5: agentConfig.md5 || '',
    mcpClient,
    agent: agent,
    abortController: abortController
  })

  return agent
}

//获取智能体状态
const getAgentStatus = (agentId: string) => {
  const cacheAgent = cacheAgentMap.get(agentId)
  // 智能体不存在，默认 free 状态
  return cacheAgent?.status || 'free'
}

//删除缓存智能体
const deleteCacheAgent = async (agentId: string) => {
  const cacheAgent = cacheAgentMap.get(agentId)
  if (!cacheAgent) {
    return
  }
  await cacheAgent.mcpClient.close()
  cacheAgentMap.delete(agentId)
}

//更新智能体状态
const updateAgentStatus = (agentId: string, status: 'free' | 'running' | 'failed') => {
  const cacheAgent = cacheAgentMap.get(agentId)
  if (cacheAgent) {
    cacheAgent.status = status
  }
}

//事件循环机制
const eventLoop = () => {
  // 事件循环正在运行，直接返回
  if (eventLoopRunning) return

  eventLoopRunning = setInterval(() => {
    // 处理任务执行逻辑
    let index = 0
    while (index < taskQueue.length) {
      // 执行中的任务队列已满最大数量，直接退出
      if (runningTaskQueue.size >= MAX_RUNNING_TASKS) {
        break
      }
      const task = taskQueue[index]
      // 智能体状态为 free闲，且执行中的任务队列未满最大数量
      if (getAgentStatus(task.agentId) === 'free' && runningTaskQueue.size < MAX_RUNNING_TASKS) {
        runningTaskQueue.set(task.taskId, task)
        updateTaskRunningInfo('async:' + task.taskId, { status: 'running' })
        taskQueue.splice(index, 1)
        executor(task)
      } else {
        index++
      }
    }

    // 处理任务结果队列
    while (taskResultQueue.length > 0) {
      const _task = taskResultQueue.shift()
      if (!_task) {
        continue
      }
      broadcast('background:task:completed', { taskId: _task.taskId, result: _task.result })
      updateTaskRunningInfo('async:' + _task.taskId, { status: _task.status })
      markTaskNotified(_task.taskId)
    }

    if (
      taskResultQueue.length === 0 &&
      taskQueue.length === 0 &&
      runningTaskQueue.size === 0 &&
      eventLoopRunning
    ) {
      clearInterval(eventLoopRunning)
      eventLoopRunning = null
      //时间空闲，清理过期任务
      cleanupExpiredTasks()
    }
  }, 100)
}

// 处理流式输出，区分消息类型并打印
async function handleStreamOutput(taskId: string, stream: any): Promise<string> {
  let fullText = ''

  for await (const [streamMode, chunk] of stream) {
    // console.log(streamMode)
    if (streamMode === 'messages') {

        const msg = Array.isArray(chunk) ? chunk[0] : chunk
      // 思考过程
      if (msg.additional_kwargs?.reasoning_content) {
        updateTaskRunningInfo('async:' + taskId, { thinkMessage: msg.additional_kwargs.reasoning_content })
      }

      // AI 输出
      if (msg.type === 'ai' && msg.content) {
        updateTaskRunningInfo('async:' + taskId, { mainMessage: msg.content })
        fullText += msg.content
      }
    }

    if (streamMode === 'updates') {
      // 工具调用请求
      if (chunk.model_request) {
        const msgs = chunk.model_request.messages || []
        for (const m of msgs) {
          if (m.tool_calls?.length) {
            for (const tc of m.tool_calls) {
              updateTaskRunningInfo('async:' + taskId, { toolsMessage: {id: tc.id, name: tc.name, params: JSON.stringify(tc.args)} })
            }
          }
        }
      }

      // 工具执行结果
      if (chunk.tools) {
        const toolMsgs = chunk.tools.messages || []
        for (const m of toolMsgs) {
          if (m.type === 'tool') {
             updateTaskRunningInfo('async:' + taskId, { toolsMessage: {id: m.tool_call_id, content: m.content} })
          }
        }
      }
    }
  }

  return fullText
}

//执行器
const executor = async (task: Task) => {
  try {
    const { taskId, params, agentId } = task
    const agent = await getChildAgent(agentId)

    updateAgentStatus(agentId, 'running')
    const threadId = uuidv4()

    const streamConfig = {
      configurable: { thread_id: threadId },
      streamMode: ['messages', 'updates']
    }

    const stream = await agent.stream({ messages: [new HumanMessage(params)] }, streamConfig)

    const resultText = await handleStreamOutput(taskId, stream)

    runningTaskQueue.delete(taskId)
    taskResultQueue.push({
      taskId,
      description: params,
      status: 'completed',
      result: `[success:任务执行成功]，异步任务执行成功，快去查询任务结果 (taskId:${taskId})`
    })

    insertTaskResult({
      taskId,
      description: params,
      isNotified: false,
      result: resultText,
      createdAt: Date.now()
    })

    // 子 Agent 用完即清空 checkpoint
    deleteThreadCheckpoints(threadId)
    updateAgentStatus(agentId, 'free')
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      runningTaskQueue.delete(task.taskId)
      taskResultQueue.push({
        taskId: task.taskId,
        description: task.params,
        status: 'stopped',
        result: `[info:任务已取消]，任务已被用户取消 (taskId:${task.taskId})`
      })
    } else {
      const errMsg = err instanceof Error ? err.message : String(err)
      runningTaskQueue.delete(task.taskId)
      taskResultQueue.push({
        taskId: task.taskId,
        description: task.params,
        status: 'failed',
        result: `[error:任务执行失败]，错误信息：${errMsg} (taskId:${task.taskId})`
      })
      insertTaskResult({
        taskId: task.taskId,
        description: task.params,
        isNotified: false,
        result: `[error:任务执行失败]${errMsg}`,
        createdAt: Date.now()
      })
    }
    deleteCacheAgent(task.agentId)
    deleteThreadCheckpoints(task.taskId)
  }
}

// 推送任务到队列
export const pushOneTask = (task: {
  params: string
  agentId: string
}): { taskId: string; description: string } => {
  const { params, agentId } = task || {}
  if (!params || !agentId) {
    return {
      taskId: '',
      description:
        '[error,任务参数错误] 请填写完整任务参数: params-任务参数, agentId-任务所属智能体ID'
    }
  }
  if (!agentList.isAgentExist(agentId)) {
    return {
      taskId: '',
      description: `[error,任务参数错误] 任务所属智能体${agentId}不存在或未启用,当前可用智能体:${agentList.getAllAgentDesc()},请检查任务参数是否正确`
    }
  }

  const _taskUuid = uuidv4()

  taskQueue.push({
    taskId: _taskUuid,
    params,
    agentId
  })

  updateTaskRunningInfo('async:' + _taskUuid, {
    taskId: 'async:' + _taskUuid,
    params,
    agentId,
    status: 'waiting',
    toolsMessage: [],
    thinkMessage: '',
    mainMessage: '',
    createdAt: Date.now(),
    endTime: null
  })

  // 触发事件循环，处理任务
  eventLoop()

  return {
    taskId: _taskUuid,
    description: `[success,任务已添加到队列] 当前任务(taskId:${_taskUuid})`
  }
}

//取消异步任务
export const cancelTask = (taskId: string): string => {
  // 先检查排队中的任务
  const queueIdx = taskQueue.findIndex((t) => t.taskId === taskId)
  if (queueIdx >= 0) {
    taskQueue.splice(queueIdx, 1)
    return `[success] 任务已取消 (taskId:${taskId})`
  }

  // 再检查执行中的任务
  const runningTask = runningTaskQueue.get(taskId)
  const abortController = cacheAgentMap.get(runningTask?.agentId || '')?.abortController
  if (abortController) {
    abortController.abort()
    return `[success] 任务已发起取消，正在中止 (taskId:${taskId})`
  }

  return `[error] 未找到指定任务 (taskId:${taskId})，可能已完成或不存在`
}



//查询任务结果
export const queryTaskResult = (taskId: string) => {
  const res = queryTaskResultById(taskId)

  if (!res) {
    const isTaskRuning = runningTaskQueue.has(taskId)
    return {
      taskId,
      description: isTaskRuning
        ? '任务正在执行中,请稍后查询结果,任务完成时会自动通知您'
        : '任务结果不存在：可能原因：1. 任务taskId不存在,请检查查询的 taskId 是否正确 2. 任务结果已被过期清理 默认仅保存最近3天的任务结果'
    }
  }

  const resDesc = `任务(taskId:${taskId}),任务描述:${res?.description || ''},任务结果:${res?.result || ''}`

  return {
    taskId,
    description: resDesc,
    result: res?.result || ''
  }
}
