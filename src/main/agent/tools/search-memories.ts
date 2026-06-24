import { tool } from 'langchain'
import dayjs from 'dayjs'
import { z } from 'zod'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import * as sqlite_vec from 'sqlite-vec'
import { generateEmbedding } from '../utils/embedding'
import { getMessagesByIds, countTotalMessages, queryMessageIdsByTimeRange, formatTimestamp } from '../utils/chat-history'

const DB_PATH = join(app.getPath('userData'), 'companion', 'companion.db')

type SnapshotRow = {
  id: number
  message_ids: string
  summary: string
  tags: string | null
  time_start: string
  time_end: string
}

function formatResults(rows: SnapshotRow[]): string {
  if (rows.length === 0) return '暂无相关记忆。'

  return rows
    .map(
      (s, i) =>
        `[${i + 1}] 时间: ${s.time_start} ~ ${s.time_end}\n` +
        `    摘要: ${s.summary}\n` +
        `    标签: ${s.tags ?? '无'}\n` +
        `    原始消息ID: ${s.message_ids}`,
    )
    .join('\n\n')
}

//查询记忆摘要
export const searchMemories = tool(
  async ({ query, time_from, time_to }: {
    query?: string
    time_from?: string
    time_to?: string
  }) => {
    // 语义搜索和时间查询互斥，必须二选一
    if (!query && !time_from && !time_to) return '请提供搜索关键词或时间范围。'
    if (query && (time_from || time_to)) return '语义搜索和时间查询不能同时使用，请选择其一。'

    try {
      const db = new Database(DB_PATH)
      const prodDylib = join(process.resourcesPath!, 'native', 'sqlite-vec', 'vec0')
      if (existsSync(prodDylib + '.dylib')) {
        db.loadExtension(prodDylib)
      } else {
        sqlite_vec.load(db)
      }

      let rows: SnapshotRow[] = []

      if (query) {
        // 向量语义搜索，top 3
        const queryVec = await generateEmbedding(query)
        const f32 = new Float32Array(queryVec)

        const matched = db.prepare(`
          SELECT rowid, distance
          FROM memory_embeddings
          WHERE embedding MATCH ?
          ORDER BY distance
          LIMIT 3
        `).all(Buffer.from(f32.buffer)) as Array<{ rowid: number; distance: number }>

        if (matched.length > 0) {
          const ids = matched.map((m) => m.rowid)
          const placeholders = ids.map(() => '?').join(',')
          const snapshotRows = (db.prepare(`
            SELECT id, message_ids, summary, tags, time_start, time_end
            FROM memory_snapshots
            WHERE id IN (${placeholders})
          `).all(...ids) as Array<{ id: number; message_ids: string; summary: string; tags: string | null; time_start: number; time_end: number }>)
            .map((r) => ({ ...r, time_start: formatTimestamp(r.time_start), time_end: formatTimestamp(r.time_end) })) as SnapshotRow[]

          const idMap = new Map(snapshotRows.map((r) => [r.id, r]))
          rows = matched.map((m) => idMap.get(m.rowid)!).filter(Boolean)
        }
      } else if (time_from || time_to) {
        // 时间范围查询，top 3
        const conditions: string[] = []
        const params: (string | number)[] = []

        if (time_from) { conditions.push('time_end >= ?'); params.push(String(dayjs(time_from).valueOf())) }
        if (time_to)   { conditions.push('time_start <= ?'); params.push(String(dayjs(time_to).valueOf())) }

        rows = (db.prepare(`
          SELECT id, message_ids, summary, tags, time_start, time_end
          FROM memory_snapshots
          WHERE ${conditions.join(' AND ')}
          ORDER BY time_start DESC
          LIMIT 6
        `).all(...params) as Array<{ id: number; message_ids: string; summary: string; tags: string | null; time_start: number; time_end: number }>)
          .map((r) => ({ ...r, time_start: formatTimestamp(r.time_start), time_end: formatTimestamp(r.time_end) })) as SnapshotRow[]
      }

      db.close()
      
      return formatResults(rows)
    } catch (error) {
      return `查询记忆失败: ${error}`
    }
  },
  {
    name: 'search_memories',
    description: `
      搜索历史对话记忆摘要。可通过关键词（语义搜索）或时间范围查找。返回结果包含记忆摘要、标签、时间范围、原始消息ID列表
       -语义搜索和时间查询不能同时使用，请选择其一
       -时间范围查询时，时间范围，最好在一天内，尽量不要超过两天
    `,
    schema: z.object({
      query: z.string().optional().describe('搜索关键词或描述，用于语义匹配'),
      time_from: z.string().optional().describe('时间范围起点，精确到秒，格式 YYYY-MM-DD HH:mm:ss，如 2026-06-01 14:00:00'),
      time_to: z.string().optional().describe('时间范围终点，精确到秒，格式 YYYY-MM-DD HH:mm:ss，如 2026-06-15 18:00:00'),
    }),
  },
)

// 根据消息 ID 列表拉取原始对话内容
export const fetchRawMessages = tool(
  async ({ message_ids }: { message_ids: number[] }) => {
    try {
      if (!message_ids || message_ids.length === 0) return '请提供消息 ID 列表。'
      const rows = getMessagesByIds(message_ids)
      if (rows.length === 0) return '未找到对应消息。'
      return rows
        .map((r) => `[${r.id}] ${r.role === 'user' ? '用户' : 'AI'} (${formatTimestamp(r.created_at)}): ${r.content}`)
        .join('\n\n')
    } catch (error) {
      return `查询失败: ${error}`
    }
  },
  {
    name: 'fetch_raw_messages',
    description: `根据消息 ID 列表查询原始对话内容。配合 search_memories 使用：先搜索记忆获取 message_ids，再用本工具拉取原文`,
    schema: z.object({
      message_ids: z.array(z.number()).describe('消息 ID 列表，来自 search_memories 返回的原始消息ID,控制查询数量0-50之间'),
    }),
  },
)

// 查询聊天记录数据库：不传参返回总数，传时间返回区间内条数和 ID 范围
export const queryMessageDatabase = tool(
  async ({ time_from, time_to }: { time_from?: string; time_to?: string }) => {
    try {

      // 不传参数：只返回总数，不查 ID
      if (!time_from && !time_to) {
        return `历史消息总数: ${countTotalMessages()} 条`
      }

      const { count, ids } = queryMessageIdsByTimeRange(time_from, time_to)
      if (count === 0) return '该时间段内没有消息记录。'

      const idRange = ids.length > 0 ? `[${ids[0]} ~ ${ids[ids.length - 1]}]` : '无'
      return [
        `查询时间: ${time_from ?? '最早'} ~ ${time_to ?? '最新'}`,
        `消息数量: ${count} 条`,
        `ID 范围: ${idRange}`,
        `ID 列表: [${ids.join(', ')}]`,
      ].join('\n')
    } catch (error) {
      return `查询失败: ${error}`
    }
  },
  {
    name: 'query_message_database',
    description: '查询聊天记录数据库。不传参数返回历史消息总数；传时间区间返回该时段内的消息数量和 ID 列表',
    schema: z.object({
      time_from: z.string().optional().describe('时间起点，格式 YYYY-MM-DD HH:mm:ss'),
      time_to: z.string().optional().describe('时间终点，格式 YYYY-MM-DD HH:mm:ss'),
    }),
  },
)
