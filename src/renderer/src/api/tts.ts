import { message } from 'antd'

const ttsApi = {
  getEnabled: async (): Promise<boolean> => {
    try {
      const res = await window.api.tts.getEnabled()
      if (!res.ok) throw new Error(res.error)
      return res.data ?? true
    } catch (err) {
      message.error('获取语音状态失败')
      return true
    }
  },

  setEnabled: async (enabled: boolean): Promise<boolean> => {
    const res = await window.api.tts.setEnabled(enabled)
    if (!res.ok) throw new Error(res.error)
    return res.data ?? enabled
  },

  toggle: async (): Promise<boolean> => {
    const res = await window.api.tts.toggle()
    if (!res.ok) throw new Error(res.error)
    return res.data ?? true
  },

  onEnabledChanged: window.api.tts.onEnabledChanged,
}

export default ttsApi
