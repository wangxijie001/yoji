import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

const DB_PATH = join(app.getPath('userData'), 'companion', 'companion.db')

export type TaskResult = {
  taskId: string
  description: string
  status?:'completed'|'failed' | 'stopped'
  result: string
}

type TaskResultRow = TaskResult & {
  isNotified?: boolean // 是否已通知客户端
  createdAt: number // 毫秒时间戳
}

// 初始化任务结果表
export function initTaskResultTable(): void {
  const db = new Database(DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_results (
      task_id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      result TEXT NOT NULL,
      is_notified INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `)
  db.close()
}

// 插入任务结果
export function insertTaskResult(task: TaskResultRow): void {
  const db = new Database(DB_PATH)
  db.prepare(`
    INSERT OR REPLACE INTO task_results (task_id, description, result, is_notified, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    task.taskId,
    task.description,
    task.result,
    task.isNotified ? 1 : 0,
    task.createdAt || Date.now()
  )
  db.close()
}

// 查询单个任务结果
export function queryTaskResultById(taskId: string): TaskResultRow | null {
  const db = new Database(DB_PATH)
  const row = db.prepare('SELECT * FROM task_results WHERE task_id = ?').get(taskId) as TaskResultRow | undefined
  db.close()
  return row || null
}

// 查询所有任务结果（最近 N 条）
export function queryAllTaskResults(limit: number = 50): TaskResultRow[] {
  const db = new Database(DB_PATH)
  const rows = db.prepare(
    'SELECT * FROM task_results ORDER BY created_at DESC LIMIT ?'
  ).all(limit) as TaskResultRow[]
  db.close()
  return rows
}

// 更新通知状态
export function markTaskNotified(taskId: string): void {
  const db = new Database(DB_PATH)
  db.prepare('UPDATE task_results SET is_notified = 1 WHERE task_id = ?').run(taskId)
  db.close()
}

// 删除任务结果
export function deleteTaskResult(taskId: string): void {
  const db = new Database(DB_PATH)
  db.prepare('DELETE FROM task_results WHERE task_id = ?').run(taskId)
  db.close()
}

// 清理过期任务（默认 3 天）
export function cleanupExpiredTasks(ttlMs: number = 3 * 24 * 60 * 60 * 1000): number {
  const db = new Database(DB_PATH)
  const expireBefore = Date.now() - ttlMs
  const result = db.prepare('DELETE FROM task_results WHERE created_at < ?').run(expireBefore)
  db.close()
  return result.changes
}

