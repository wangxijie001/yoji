import { tool } from 'langchain'
import { z } from 'zod'
import { getAllAgentDesc } from '../agent-list'
import { pushOneTask, queryTaskResult } from './index'

export const pushAsyncTask = tool(
  async ({ params, agentId }: { params: string; agentId: string }) => {
    const result = pushOneTask({ params, agentId })
    return result.description
  },
  {
    name: 'push_async_task',
    description: '推送异步任务工具，用于将任务发送到异步子代理执行，使用本工具前请可使用get_async_task_agent工具查询当前已注册的异步子代理列表保证agentId存在且已启用',
    schema: z.object({
      params: z.string().describe('任务描述：描述你需要做的事情以及希望得到什么样的结果'),
      agentId: z.string().describe('异步子代理的 agentId，用于指定执行任务的异步子代理')
    })
  }
)

//获取当前可用的异步子代理列表
export const getAsyncTaskAgent = tool(
  async ({}) => {
    return getAllAgentDesc('async-agent')
  },
  {
    name: 'get_async_task_agent',
    description: '获取异步任务代理列表，用于查询当前已注册的异步子代理列表',
    schema: z.object({})
  }
)

//获取异步任务结果
export const getAsyncTaskResult = tool(
  async ({ taskId }: { taskId: string }) => {
    return queryTaskResult(taskId)
  },
  {
    name: 'get_async_task_result',
    description: '传入异步任务的 taskId，用于获取异步任务结果工具，用于查询异步任务的执行结果',
    schema: z.object({
      taskId: z.string().describe('异步任务的 taskId，用于指定查询的异步任务执行结果')
    })
  }
)