import { ChildAgentConfig, TaskRunningInfo } from '../../../shared/types'
import { childrenAgentConfig } from '../../config'
import { readTemp, writeTemp } from '../../utils/tem-file-manage'

type ToolMessage = { id: string; name: string; params: string; content: string }

// 增量更新入参：顶层字段可选；toolsMessage 的每一项 id 必填、其余字段可选（只传要改的）
type TaskRunningInfoPatch = Partial<Omit<TaskRunningInfo, 'toolsMessage'>> & {
  toolsMessage?: (Pick<ToolMessage, 'id'> & Partial<ToolMessage>) | []
}

//任务执行信息缓存
const taskRunningInfoCache: Map<string, TaskRunningInfo> = new Map()

//更新任务执行信息缓存
// 首次（缓存不存在）：整体替换，直接写入传入对象
// 已存在时按字段类型增量更新：
//   status       → 直接替换
//   toolsMessage → 追加到已有数组
//   thinkMessage → 拼接到已有字符串
//   mainMessage  → 拼接到已有字符串
export const updateTaskRunningInfo = async (taskId: string, info: TaskRunningInfoPatch) => {
  const prev = taskRunningInfoCache.get(taskId)

  // 首次：整体替换
  if (!prev) {
    taskRunningInfoCache.set(taskId, info as any)
    return
  }

  // 已存在：按字段类型增量更新
  if (info.status !== undefined) prev.status = info.status
  if (info.toolsMessage !== undefined && !Array.isArray(info.toolsMessage)) {
    // 按 id upsert：不存在则新增，存在则合并替换该项
    const msg = info.toolsMessage
    const idx = prev.toolsMessage.findIndex((t) => t.id === msg.id)
    if (idx === -1) {
      // 新增：补全缺省字段，保证是完整的 ToolMessage
      prev.toolsMessage.push({ name: '', params: '', content: '', ...msg })
    } else {
      prev.toolsMessage[idx] = { ...prev.toolsMessage[idx], ...msg }
    }
  }
  if (info.thinkMessage !== undefined) prev.thinkMessage += info.thinkMessage
  if (info.mainMessage !== undefined) prev.mainMessage += info.mainMessage
  if (info.agentGraph !== undefined) prev.agentGraph = info.agentGraph
  if (info.currentNode !== undefined) prev.currentNode = info.currentNode

  if (info.status === 'completed' || info.status === 'stopped' || info.status === 'failed') {
    prev.endTime = Date.now()
    writeTemp(`tasks/${prev.taskId}.json`, JSON.stringify(prev))
    let timer: NodeJS.Timeout | null = setTimeout(() => {
      timer && clearTimeout(timer)
      timer = null
      taskRunningInfoCache.delete(taskId)
    }, 10000)
  }
}

//查询任务队列
export const queryTaskQueue = (taskId?: string) => {
  if (taskId) {
    const runingTask = taskRunningInfoCache.get(taskId) || null
    if (runingTask) {
      const agent = childrenAgentConfig.get(runingTask.agentId) as ChildAgentConfig
      return { ...runingTask, agentName: agent?.name || '', agentDesc: agent?.description || '' }
    }

    const temTask = readTemp(`tasks/${taskId}.json`) || null

    if (temTask) {
      const _result = JSON.parse(temTask)
      const agent =
        _result.agentId === 'yoji'
          ? { name: 'yoji', description: '智能助手' }
          : (childrenAgentConfig.get(_result.agentId) as ChildAgentConfig)
      return { ..._result, agentName: agent?.name || '', agentDesc: agent?.description || '' }
    }
    return null
  }
  return Array.from(taskRunningInfoCache.values()).map(({ taskId, status }) => ({
    taskId,
    status
  }))
}

//获取agent状态图
export const getAgentGraph = async (agent: any): Promise<{ nodes: any[]; edges: any[] } | null> => {
  // 缓存在内存，图结构只在 Agent 重建时变化
  let graphData: { nodes: any[]; edges: any[] } | null = null
  try {
    const drawableGraph = await (agent as any).getGraphAsync()
    graphData = {
      nodes: Object.keys(drawableGraph.nodes || {}).map((name) => ({
        id: name,
        shape: 'node' as const,
        data: { name, type: drawableGraph.nodes[name].data?.id?.[1] || '' }
      })),
      edges: (drawableGraph.edges || []).map((e: any) => ({
        id: `${e.source}→${e.target}`,
        shape: 'edge' as const,
        source: e.source,
        target: e.target,
        data: { conditional: e.conditional }
      }))
    }
  } catch (e) {
    console.error('[agent-graph] dump failed:', e)
  }
  return graphData
}
