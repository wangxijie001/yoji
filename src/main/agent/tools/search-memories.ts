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
  async ({ query, keywords, time_from, time_to }: {
    query?: string
    keywords?: string
    time_from?: string
    time_to?: string
  }) => {
    // 搜索和时间查询互斥
    const hasSearch = query || keywords
    if (!hasSearch && !time_from && !time_to) return '请提供搜索关键词或时间范围。'
    if (hasSearch && (time_from || time_to)) return '搜索和时间查询不能同时使用，请选择其一。'

    try {
      const db = new Database(DB_PATH)
      const prodDylib = join(process.resourcesPath!, 'native', 'sqlite-vec', 'vec0')
      if (existsSync(prodDylib + '.dylib')) {
        db.loadExtension(prodDylib)
      } else {
        sqlite_vec.load(db)
      }

      let rows: SnapshotRow[] = []

      if (hasSearch) {
        const K = 60           // RRF 平滑常数
        const TOP = query && keywords ? 5 : 5  // 最终返回 top 5
        const scores = new Map<number, number>()

        // ── 向量路径 ──
        if (query) {
          const queryVec = await generateEmbedding(query)
          const f32 = new Float32Array(queryVec)
          const vecResults = db.prepare(`
            SELECT rowid, distance
            FROM memory_embeddings
            WHERE embedding MATCH ?
            ORDER BY distance
            LIMIT 10
          `).all(Buffer.from(f32.buffer)) as Array<{ rowid: number; distance: number }>

          vecResults.forEach((r, i) => scores.set(r.rowid, 1 / (K + i + 1)))
        }

        // ── 关键词路径（FTS5 BM25）──
        if (keywords) {
          const ftsResults = db.prepare(`
            SELECT rowid, rank
            FROM memory_snapshots_fts
            WHERE memory_snapshots_fts MATCH ?
            ORDER BY rank
            LIMIT 10
          `).all(keywords) as Array<{ rowid: number; rank: number }>

          ftsResults.forEach((r, i) => {
            scores.set(r.rowid, (scores.get(r.rowid) ?? 0) + 1 / (K + i + 1))
          })
        }

        const mergedIds = [...scores.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, TOP)
          .map(([id]) => id)

        if (mergedIds.length > 0) {
          const placeholders = mergedIds.map(() => '?').join(',')
          const snapshotRows = (db.prepare(`
            SELECT id, message_ids, summary, tags, time_start, time_end
            FROM memory_snapshots
            WHERE id IN (${placeholders})
          `).all(...mergedIds) as Array<{ id: number; message_ids: string; summary: string; tags: string | null; time_start: number; time_end: number }>)
            .map((r) => ({ ...r, time_start: formatTimestamp(r.time_start), time_end: formatTimestamp(r.time_end) })) as SnapshotRow[]

          // 按融合分数排序
          const idMap = new Map(snapshotRows.map((r) => [r.id, r]))
          rows = mergedIds.map((id) => idMap.get(id)!).filter(Boolean)
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
      搜索历史对话记忆摘要。支持三种模式：
       -仅 query：纯向量语义搜索
       -仅 keywords：纯关键词精确匹配（FTS5 BM25）
       -query + keywords：混合检索，双路召回 + RRF 融合，效果最佳
       -时间范围查询不能与搜索同时使用
       -关键词需从用户问题中提取核心词，空格分隔，如 "React 项目 重构"
    `,
    schema: z.object({
      query: z.string().optional().describe('自然语言描述，用于向量语义搜索'),
      keywords: z.string().optional().describe('空格分隔的核心关键词，从用户问题中提取，用于 FTS5 精确文本匹配。如 "钓鱼 休闲 娱乐"'),
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
