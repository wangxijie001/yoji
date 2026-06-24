import { register as registerHttp } from './http'
import { register as registerConfig } from './config'
import { register as registerAgent } from './agent'
import { register as registerEmotion } from './emotion'
import { register as registerFile } from './file'

// 注册所有 IPC 处理器
export function registerAll(): void {
  registerHttp()
  registerConfig()
  registerAgent()
  registerEmotion()
  registerFile()
}
