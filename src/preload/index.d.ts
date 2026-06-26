import { ElectronAPI } from '@electron-toolkit/preload'
import type { ChatMessage, MessageHistoryQuery, MessageRecord, StreamCallbacks, EmotionState, FileEntry } from '../../shared/types'

interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  data?: unknown
  params?: Record<string, unknown>
}

interface Api {
  request: (config: RequestConfig) => Promise<ApiResponse>
  config: {
    getAll: (configName: string) => Promise<Record<string, unknown>>
    get: (configName: string, key: string) => Promise<unknown>
    set: (configName: string, key: string, value: unknown) => Promise<void>
  }
  agent: {
    chat: (messages: ChatMessage[]) => Promise<ApiResponse>
    historyQuery: (query: MessageHistoryQuery) => Promise<ApiResponse<MessageRecord[]>>
    chatStream: (messages: ChatMessage[], callbacks: StreamCallbacks) => void
  }
  emotion: {
    getLog: (limit: number, id?: number) => Promise<ApiResponse<EmotionState[]>>
    onUpdated: (callback: (emotion: EmotionState) => void) => () => void
  }
  file: {
    readAgentsMd: () => Promise<ApiResponse<string>>
    listDir: (dirPath?: string) => Promise<ApiResponse<FileEntry[]>>
    readFile: (fullPath: string) => Promise<ApiResponse<{ content: ArrayBuffer; fileName: string; mimeType: string }>>
    exportFile: (type: 'db' | 'md' | 'all') => Promise<ApiResponse<string>>
    importFile: (type: 'db' | 'md' | 'all') => Promise<ApiResponse<string>>
    showFileInFolder: (fullPath: string) => Promise<ApiResponse<void>>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
