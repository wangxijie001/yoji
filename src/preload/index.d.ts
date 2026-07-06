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
    delete: (configName: string, key: string) => Promise<void>
  }
  agent: {
    chat: (messages: ChatMessage[]) => Promise<ApiResponse>
    historyQuery: (query: MessageHistoryQuery) => Promise<ApiResponse<MessageRecord[]>>
    chatStream: (messages: ChatMessage[], callbacks: StreamCallbacks) => void
    onRebuilding: (callback: (data: { status: 'start' | 'done' }) => void) => () => void
    onBackgroundTaskCompleted: (callback: (data: { taskId: string; result: string }) => void) => () => void
    stop: () => void
    updateVersion: () => Promise<ApiResponse<void>>
    toggleMiniWindow: () => Promise<boolean>
    queryTaskQueue: () => Promise<ApiResponse<{ taskQueue: unknown[]; runningTaskQueue: unknown[] }>>
    cancelTask: (taskId: string) => Promise<ApiResponse<string>>
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
  tts: {
    getEnabled: () => Promise<ApiResponse<boolean>>
    setEnabled: (enabled: boolean) => Promise<ApiResponse<boolean>>
    toggle: () => Promise<ApiResponse<boolean>>
    onEnabledChanged: (callback: (enabled: boolean) => void) => () => void
  }
  mcp: {
    save: (config: { key: string; name: string; description: string; uuid?: string; transport?: string; url?: string; command?: string; args?: string[]; isExposeToMain?: boolean; envPath?: string }) => Promise<ApiResponse<{ name: string; description: string }[]>>
  }
}

interface ElectronSpeechSession {
  on(event: 'result', listener: (result: { text: string; isFinal: boolean; confidence?: number; timestampMs?: number }) => void): () => void
  on(event: 'error', listener: (error: { code: string; message: string; details?: unknown }) => void): () => void
  on(event: 'state', listener: (state: string) => void): () => void
  start(options?: { locale?: string; interimResults?: boolean; continuous?: boolean }): Promise<void>
  stop(): Promise<void>
  abort(): Promise<void>
  dispose(): Promise<void>
}

interface ElectronSpeechAPI {
  getSpeechAvailability(): Promise<{ available: boolean; platform: string; reason?: string }>
  createSpeechSession(): Promise<ElectronSpeechSession>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
    electronSpeech?: ElectronSpeechAPI
  }
}
