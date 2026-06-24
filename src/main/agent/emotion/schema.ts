import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { EmotionState } from '../../../shared/types'

const DB_PATH = join(app.getPath('userData'), 'companion', 'companion.db')


// 初始化情绪表，首次启动插入默认状态
export function initEmotionTable(): void {
  const db = new Database(DB_PATH)
  db.exec(`
    -- 情绪日志：每次激素状态变化记录一行，最新行即当前状态，保留最近 300 条
    CREATE TABLE IF NOT EXISTS emotion_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dopamine INTEGER NOT NULL,          -- 多巴胺：兴奋/好奇 0-100
      serotonin INTEGER NOT NULL,         -- 血清素：安宁/自尊 0-100
      gaba INTEGER NOT NULL,              -- GABA：身体松弛/镇定 0-100
      cortisol INTEGER NOT NULL,          -- 皮质醇：慢性压力 0-100
      adrenaline INTEGER NOT NULL,        -- 肾上腺素：急性应激 0-100
      oxytocin INTEGER NOT NULL,          -- 催产素：信任/依恋 0-100
      endorphin INTEGER NOT NULL,         -- 内啡肽：愉悦/舒适 0-100
      melatonin INTEGER NOT NULL,         -- 褪黑素：困倦/昼夜节律 0-100
      source TEXT NOT NULL,               -- 变化来源: tick|chat|system|weather，多个用逗号分隔
      emotion TEXT NOT NULL,              -- 当前情绪的自然语言描述
      description TEXT NOT NULL,          -- 变化描述
      display TEXT,                       -- JSON: { primary, secondary, ratio }，UI 背景渐变
      created_at INTEGER NOT NULL         -- 毫秒时间戳
    );
  `)

  // 迁移旧表：没有 display 列则新增
  try { db.exec(`ALTER TABLE emotion_log ADD COLUMN display TEXT`) } catch { /* 列已存在 */ }

  // 首次启动插入初始状态
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM emotion_log').get() as { cnt: number }
  if (row.cnt === 0) {
    db.prepare(`
      INSERT INTO emotion_log
        (dopamine, serotonin, gaba, cortisol, adrenaline, oxytocin, endorphin, melatonin, source, emotion, description, display, created_at)
      VALUES (50, 50, 60, 30, 30, 40, 50, 20, 'system', '状态平稳', '应用首次启动', ?, ?)
    `).run(JSON.stringify({ primary: '平静', secondary: '专注', ratio: 0.7 }), Date.now())
  }

  db.close()
}


// 获取当前情绪参数（最新一行）
export function getCurrentEmotion(): EmotionState | null {
  const db = new Database(DB_PATH)
  const row = db.prepare(`
    SELECT * FROM emotion_log
    ORDER BY id DESC
    LIMIT 1
  `).get() as EmotionState | undefined
  db.close()
  return row ?? null
}

// 根据ID获取指定id之前limit条情绪记录，不传ID则返回最新 limit 行
export function getCurrentEmotionLog(limit: number, id?: number): EmotionState[] {
  const db = new Database(DB_PATH)
  let rows: EmotionState[]
  if (!!id ) {
    rows = db.prepare(`SELECT * FROM emotion_log WHERE id <= ? ORDER BY id DESC LIMIT ?`).all(id, limit) as EmotionState[]
  } else {
    rows = db.prepare(`SELECT * FROM emotion_log ORDER BY id DESC LIMIT ?`).all(limit) as EmotionState[]
  }
  db.close()
  return rows
}

// 存储情绪变化，并保留最近 300 条记录
export function insertEmotion(emotion: Omit<EmotionState, 'created_at'>): void {
  const db = new Database(DB_PATH)
  const stmt = db.prepare(`
    INSERT INTO emotion_log
      (dopamine, serotonin, gaba, cortisol, adrenaline, oxytocin, endorphin, melatonin, source, emotion, description, display, created_at)
    VALUES (@dopamine, @serotonin, @gaba, @cortisol, @adrenaline, @oxytocin, @endorphin, @melatonin, @source, @emotion, @description, @display, @created_at)
  `)
  stmt.run({ ...emotion, created_at: Date.now() })

  // 保留最近 300 条，删除多余旧记录
  db.prepare(`
    DELETE FROM emotion_log
    WHERE id NOT IN (
      SELECT id FROM emotion_log
      ORDER BY id DESC
      LIMIT 300
    )
  `).run()

  db.close()
}

