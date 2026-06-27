import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { ConfigName } from '../shared/types'

/**
 * JSON 配置文件管理
 *
 * 所有配置文件统一存放在：<userData>/configs/
 *   macOS:   ~/Library/Application Support/yoji/configs/
 *   Windows: C:\Users\<用户名>\AppData\Roaming\yoji\configs/
 *   Linux:   ~/.config/yoji/configs/
 *
 * 每个配置类型一个 JSON 文件，互不干扰：
 *   configs/env.json     — 环境变量（API 地址、密钥等）
 *   configs/model.json   — 模型配置（后续）
 *   configs/ui.json      — UI 偏好（后续）
 */

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function getConfigDir(): string {
  const dir = join(app.getPath('userData'), 'configs')
  ensureDir(dir)
  return dir
}

class ConfigFile {
  private filePath: string

  constructor(filename: string) {
    this.filePath = join(getConfigDir(), `${filename}.json`)
  }

  /** 读取全部数据 */
  load(): Record<string, unknown> {
    try {
      if (!existsSync(this.filePath)) return {}
      const raw = readFileSync(this.filePath, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  /** 写入全部数据 */
  save(data: Record<string, unknown>): void {
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
  }

  get<T = unknown>(key: string): T | undefined {
    return this.load()[key] as T | undefined
  }

  getAll(): Record<string, unknown> {
    return this.load()
  }

  set(key: string, value: unknown): void {
    const data = this.load()
    data[key] = value
    this.save(data)
  }

  setAll(values: Record<string, unknown>): void {
    const data = this.load()
    Object.assign(data, values)
    this.save(data)
  }

  delete(key: string): void {
    const data = this.load()
    delete data[key]
    this.save(data)
  }

  getPath(): string {
    return this.filePath
  }
}

// 导出各配置实例
export const envConfig = new ConfigFile('env') // 环境变量配置
export const modelConfig = new ConfigFile('model') // 模型配置
export const mcpConfig = new ConfigFile('mcp') // MCP 服务器配置

// 配置注册表——按名称取实例，后续新增配置加一行即可
const configMap: Record<string, ConfigFile> = {
  env: envConfig,
  model: modelConfig,
  mcp: mcpConfig,
}

export function getConfig(name: ConfigName): ConfigFile {
  const cfg = configMap[name]
  if (!cfg) {
    throw new Error(`未知的配置文件: ${name}`)
  }
  return cfg
}
