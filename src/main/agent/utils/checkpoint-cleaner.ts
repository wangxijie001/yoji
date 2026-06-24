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
