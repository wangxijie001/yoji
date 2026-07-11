import { http } from './http'
import { config } from './config'
import { agent } from './agent'
import { emotion } from './emotion'
import { file } from './file'
import { tts } from './tts'
import { mcp } from './mcp'
import { browserWindow } from './browser-window'

// 汇总所有暴露给渲染进程的 API
export const api = {
  ...http,
  config,
  agent,
  emotion,
  file,
  tts,
  mcp,
  browserWindow
}
