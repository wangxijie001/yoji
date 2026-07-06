import { registerSpeechHandlers } from 'electron-native-speech/main-handlers'
import type { BrowserWindow, IpcMain } from 'electron'

export function initSpeech(ipcMain: IpcMain, mainWindow: BrowserWindow): () => void {
  return registerSpeechHandlers(ipcMain, mainWindow.webContents)
}
