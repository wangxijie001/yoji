import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { RemoveMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'


const DB_PATH = join(app.getPath('userData'), 'companion', 'companion.db')
const THREAD_ID = 'companion'

// 清理旧 checkpoint，只保留最新 N 条
export function cleanupCheckpoints(keepLatest: number = 1): void {
  const db = new Database(DB_PATH)

  // 先清理关联的 writes，再清理 checkpoints
  db.exec(`
    DELETE FROM writes
    WHERE thread_id = '${THREAD_ID}'
    AND checkpoint_id NOT IN (
      SELECT checkpoint_id FROM checkpoints
      WHERE thread_id = '${THREAD_ID}'
      ORDER BY checkpoint_id DESC
      LIMIT ${keepLatest}
    )
  `)

  db.exec(`
    DELETE FROM checkpoints
    WHERE thread_id = '${THREAD_ID}'
    AND checkpoint_id NOT IN (
      SELECT checkpoint_id FROM checkpoints
      WHERE thread_id = '${THREAD_ID}'
      ORDER BY checkpoint_id DESC
      LIMIT ${keepLatest}
    )
  `)

  db.close()
}

// 删除指定 thread 的所有 checkpoint（子 Agent 用完即清）
export function deleteThreadCheckpoints(threadId: string): void {
  const db = new Database(DB_PATH)
  db.prepare('DELETE FROM writes WHERE thread_id = ?').run(threadId)
  db.prepare('DELETE FROM checkpoints WHERE thread_id = ?').run(threadId)
  db.close()
}


//删除第n条消息记录（从 checkpoint state 中移除指定位置的消息）
export async function deleteMessageByIndex(
  agent: { getState: any; updateState: any },
  threadId: string,
  index: number
): Promise<void> {
  const state = await agent.getState({ configurable: { thread_id: threadId } })
  const messages: BaseMessage[] = state.values?.messages ?? []

  if (index < 0 || index >= messages.length) {
    throw new Error(`消息索引 ${index} 超出范围 (共 ${messages.length} 条)`)
  }

  const target = messages[index]
  await agent.updateState(
    { configurable: { thread_id: threadId } },
    { messages: [new RemoveMessage({ id: target.id! })] }
  )
}
