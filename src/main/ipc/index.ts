import { register as registerHttp } from './http'
import { register as registerConfig } from './config'
import { register as registerAgent } from './agent'
import { register as registerEmotion } from './emotion'
import { register as registerFile } from './file'
import { register as registerTts } from './tts'
import { register as registerMcp } from './mcp'
import { register as registerBrowserWindow } from './browser-window'

// 注册所有 IPC 处理器
export function registerAll(): void {
  registerHttp()
  registerConfig()
  registerAgent()
  registerEmotion()
  registerFile()
  registerTts()
  registerMcp()
  registerBrowserWindow()
}
