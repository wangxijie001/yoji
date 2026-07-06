import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { api } from './api'

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)

    // macOS 原生语音识别（electron-native-speech），Windows 上静默跳过
    try {
      const { exposeElectronSpeech } = require('electron-native-speech/preload')
      exposeElectronSpeech() // → window.electronSpeech
    } catch {}
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
