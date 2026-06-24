import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { z } from 'zod'
import dayjs from 'dayjs'
import * as sqlite_vec from 'sqlite-vec'
import { createModel, type ModelConfig } from '../model'
import { generateEmbedding } from './embedding'

const DB_PATH = join(app.getPath('userData'), 'companion', 'companion.db')
const Max_Summary_Length = 30

// 时间戳格式化工具：Agent 展示用
export function formatTimestamp(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm:ss')
}

// 将 Agent 传入的时间字符串转为毫秒时间戳
function parseTimeInput(t: string): number {
  return dayjs(t).valueOf()
}

function loadVec(db: Database.Database): void {
  const prodPath = join(process.resourcesPath!, 'native', 'sqlite-vec', 'vec0')
  if (existsSync(prodPath + '.dylib')) {
    // 生产环境：从 extraResources 目录加载，loadExtension 自动追加扩展名
    db.loadExtension(prodPath)
  } else {
    sqlite_vec.load(db)
  }
}

function getDb(): Database.Database {
  const db = new Database(DB_PATH)
  loadVec(db)
  return db
}

// 初始化表结构
export function initChatHistory(): void {
  const db = getDb()
  db.exec(`
    -- 聊天记录：每条消息一行，自增 ID + 链表结构，支持分页拉取
    CREATE TABLE IF NOT EXISTS raw_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      prev_id INTEGER REFERENCES raw_messages(id),
      next_id INTEGER REFERENCES raw_messages(id),
      metadata TEXT,
      created_at INTEGER NOT NULL        -- 毫秒时间戳
    );

    -- 记忆快照：每 N 轮对话生成一条摘要，Agent 回忆时语义检索
    -- embedding 由 sqlite-vec 虚拟表管理，不存此处
    CREATE TABLE IF NOT EXISTS memory_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_end_id INTEGER NOT NULL,    -- 本次摘要覆盖的最后一条消息 ID，用于判断下次触发
      message_ids TEXT NOT NULL,           -- JSON 数组，本次覆盖的所有消息 ID 集合
      summary TEXT NOT NULL,               -- LLM 生成的摘要文本
      tags TEXT,                           -- JSON 数组，主题标签
      time_start INTEGER NOT NULL,         -- 毫秒时间戳
      time_end INTEGER NOT NULL,           -- 毫秒时间戳
      created_at INTEGER NOT NULL
    );

    -- sqlite-vec 向量虚拟表，rowid = memory_snapshots.id，用于 KNN 语义搜索
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_embeddings USING vec0(
      embedding FLOAT[384]
    );
  `)
  db.close()
}

// 插入一条消息，自动维护链表，返回自增 ID
export function insertMessageHistory(msg: {
  session_id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: string | null
}): number {
  const db = getDb()

  // 找到上一条消息（id 最大且 next_id 为空）
  const last = db.prepare(`
    SELECT id FROM raw_messages
    WHERE next_id IS NULL
    ORDER BY id DESC
    LIMIT 1
  `).get() as { id: number } | undefined

  const prevId = last?.id ?? null

  const result = db.prepare(`
    INSERT INTO raw_messages (session_id, role, content, prev_id, next_id, metadata, created_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?)
  `).run(msg.session_id, msg.role, msg.content, prevId, msg.metadata ?? null, Date.now())

  // 更新上一条的 next_id
  if (prevId !== null) {
    db.prepare('UPDATE raw_messages SET next_id = ? WHERE id = ?')
      .run(result.lastInsertRowid, prevId)
  }

  db.close()
  return Number(result.lastInsertRowid)
}

// 分页查询：从某个 id 开始往前取 N 条
export function queryMessagesHistory(
  beforeId?: number,
  limit: number = 100
): Array<{
  id: number
  session_id: string
  role: string
  content: string
  prev_id: number | null
  next_id: number | null
  created_at: number
}> {
  const db = getDb()
  let rows: unknown[]
  if (beforeId !== undefined) {
    rows = db.prepare(`
      SELECT * FROM raw_messages
      WHERE id < ?
      ORDER BY id DESC
      LIMIT ?
    `).all(beforeId, limit)
  } else {
    rows = db.prepare(`
      SELECT * FROM raw_messages
      ORDER BY id DESC
      LIMIT ?
    `).all(limit)
  }
  db.close()
  return (rows as any[]).reverse()
}


// ========== 记忆快照摘要 ==========

// 获取最后一次摘要覆盖的消息 ID，没有则返回 0
export function getLastSnapshotEndId(): number {
  const db = getDb()
  const row = db.prepare(`
    SELECT COALESCE(MAX(message_end_id), 0) AS end_id FROM memory_snapshots
  `).get() as { end_id: number }
  db.close()
  return row.end_id
}

// 统计自上次摘要以来的新消息数
export function countNewMessages(): number {
  const lastEndId = getLastSnapshotEndId()
  const db = getDb()
  const row = db.prepare(`
    SELECT COUNT(*) AS cnt FROM raw_messages WHERE id > ?
  `).get(lastEndId) as { cnt: number }
  db.close()
  return row.cnt
}

// 统计历史消息总数
export function countTotalMessages(): number {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM raw_messages').get() as { cnt: number }
  db.close()
  return row.cnt
}

// 按时间区间查询消息 ID 范围
export function queryMessageIdsByTimeRange(time_from?: string, time_to?: string): {
  count: number
  ids: number[]
} {
  const db = getDb()
  const conditions: string[] = []
  const params: (string | number)[] = []

  // 将 Agent 传入的时间字符串转为毫秒时间戳
  if (time_from) { conditions.push('created_at >= ?'); params.push(parseTimeInput(time_from)) }
  if (time_to) { conditions.push('created_at <= ?'); params.push(parseTimeInput(time_to)) }

  const rows = db.prepare(`
    SELECT id FROM raw_messages
    ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}
    ORDER BY id ASC
  `).all(...params) as Array<{ id: number }>
  db.close()

  return { count: rows.length, ids: rows.map((r) => r.id) }
}

// 根据消息 ID 列表查原文
export function getMessagesByIds(ids: number[]): Array<{
  id: number
  role: string
  content: string
  created_at: number
}> {
  if (ids.length === 0) return []
  const db = getDb()
  const placeholders = ids.map(() => '?').join(',')
  const rows = db.prepare(`
    SELECT id, role, content, created_at FROM raw_messages
    WHERE id IN (${placeholders})
    ORDER BY id ASC
  `).all(...ids) as Array<{ id: number; role: string; content: string; created_at: number }>
  db.close()
  return rows
}

// ========== 摘要生成 ==========

const SummarySchema = z.object({
  summary: z.string().describe('100 字以内的对话摘要'),
  tags: z.array(z.string()).describe('2-5 个主题标签'),
})

export async function generateAndStoreSnapshot(config: ModelConfig): Promise<boolean> {
  const total = countNewMessages()
  if (total < Max_Summary_Length) return false

  const lastEndId = getLastSnapshotEndId()
  const db = getDb()
  const rows = db.prepare(`
    SELECT id, role, content, created_at FROM raw_messages
    WHERE id > ?
    ORDER BY id ASC
    LIMIT ?
  `).all(lastEndId, Max_Summary_Length) as Array<{
    id: number; role: string; content: string; created_at: number
  }>
  db.close()

  // 拼对话文本 → 结构化输出
  const text = rows
    .map((r) => `${r.role === 'user' ? '用户' : 'AI'}: ${r.content}`)
    .join('\n')

  const model = createModel({...config,modelKwargs:{thinking: { type: "disabled" }}})
  const structured = model.withStructuredOutput(SummarySchema)
  const result = await structured.invoke(`
将以下对话总结为 200 字以内的摘要，并提取 2-5 个主题标签：
${text}
`)

  // 向量化
  const vec = await generateEmbedding(result.summary)
  const f32 = new Float32Array(vec)

  // 存储：元数据入 memory_snapshots，向量入 vec0 虚拟表（rowid 对齐）
  const insertDb = getDb()
  const insertResult = insertDb.prepare(`
    INSERT INTO memory_snapshots
      (message_end_id, message_ids, summary, tags, time_start, time_end, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    rows[rows.length - 1].id,
    JSON.stringify(rows.map((r) => r.id)),
    result.summary,
    JSON.stringify(result.tags),
    rows[0].created_at,
    rows[rows.length - 1].created_at,
    Date.now(),
  )
  // better-sqlite3 v12 lastInsertRowid 返回 bigint，sqlite-vec 需要整数
  const snapshotId = BigInt(insertResult.lastInsertRowid)

  insertDb.prepare(`
    INSERT INTO memory_embeddings (rowid, embedding) VALUES (?, ?)
  `).run(snapshotId, Buffer.from(f32.buffer))
  insertDb.close()

  return true
}