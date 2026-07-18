import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { AGENTS_MD_TEMPLATE } from './agent/system-prompt'
import { initChatHistory } from './agent/utils/chat-history'
import { initEmotionTable } from './agent/emotion/schema'
import { initSkills } from './agent/skills'
import { initTaskResultTable } from './agent/children-agent/async/task-result'
import { initDefaultAgent } from './agent/children-agent/agent-default'
import { initLogger } from './utils/logger'
import { clearTemp } from './utils/tem-file-manage'
import { changeEmotion } from './agent/emotion'

const COMPANION_DIR = join(app.getPath('userData'), 'companion')
const AGENTS_MD_PATH = join(COMPANION_DIR, 'AGENTS.md')

// 应用启动时一次性完成 companion 基础设施初始化
export function initCompanion(): void {
  initLogger() // 接管 console，所有日志写入文件

  mkdirSync(COMPANION_DIR, { recursive: true })

  if (!existsSync(AGENTS_MD_PATH)) {
    writeFileSync(AGENTS_MD_PATH, AGENTS_MD_TEMPLATE, 'utf-8') // 初始化 AGENTS.md 模板
  }

  initChatHistory()    // raw_messages / memory_snapshots 等表
  initEmotionTable()   // emotion_log 情緒表
  initSkills()         // 注入内置 skills 到 companion 目录
  initTaskResultTable() // task_results 异步任务结果表
  initDefaultAgent()    // 注册内置子 Agent
  changeEmotion([])     // 初始化当前情绪状态
  clearTemp()           // 清理临时文件目录
}
