import { ipcRenderer } from 'electron'
import { createListener } from './listener'

export const tts = {
  getEnabled: () =>
    ipcRenderer.invoke('tts:getEnabled') as Promise<{ ok: boolean; data: boolean }>,

  setEnabled: (enabled: boolean) =>
    ipcRenderer.invoke('tts:setEnabled', enabled) as Promise<{ ok: boolean; data: boolean }>,

  toggle: () =>
    ipcRenderer.invoke('tts:toggle') as Promise<{ ok: boolean; data: boolean }>,

  onEnabledChanged: createListener<boolean>('tts:enabledChanged'),
}
