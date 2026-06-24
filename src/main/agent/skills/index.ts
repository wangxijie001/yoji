import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, cpSync, existsSync } from 'fs'

const COMPANION_DIR = join(app.getPath('userData'), 'companion')

// 运行时 skills 目标路径
const SKILLS_BUILTIN_DIR = join(COMPANION_DIR, 'skills', 'builtin')
const SKILLS_USER_DIR = join(COMPANION_DIR, 'skills', 'user')

// 查找内置 skills 源目录
// 开发模式：app.getAppPath() → 项目根目录 → src/main/agent/skills/builtin/
// 生产模式：extraResources 拷贝到 process.resourcesPath/skills/builtin/
function findBuiltinSource(): string {
  // 开发模式路径
  const devPath = join(app.getAppPath(), 'src', 'main', 'agent', 'skills', 'builtin')
  if (existsSync(devPath)) return devPath

  // 生产模式路径（extraResources）
  const prodPath = join(process.resourcesPath!, 'skills', 'builtin')
  if (existsSync(prodPath)) return prodPath

  // 兜底：尝试 __dirname 相邻路径
  const fallbackPath = join(__dirname, 'builtin')
  if (existsSync(fallbackPath)) return fallbackPath

  throw new Error(
    `找不到内置 skills 目录。已尝试:\n` +
    `  - ${devPath}\n` +
    `  - ${prodPath}\n` +
    `  - ${fallbackPath}`
  )
}

// 启动时调用：全量覆盖 builtin/，确保 user/ 存在
export function initSkills(): void {
  const sourceDir = findBuiltinSource()

  // 确保目标目录存在
  mkdirSync(SKILLS_BUILTIN_DIR, { recursive: true })
  mkdirSync(SKILLS_USER_DIR, { recursive: true })

  // 全量覆盖：清空目标目录 → 从源目录拷贝
  cpSync(sourceDir, SKILLS_BUILTIN_DIR, { recursive: true, force: true })

  console.log(`[Skills] 已从 ${sourceDir} 注入到 ${SKILLS_BUILTIN_DIR}`)
}
