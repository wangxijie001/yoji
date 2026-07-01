import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

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
