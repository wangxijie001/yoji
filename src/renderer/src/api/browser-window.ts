import { message } from 'antd'

const browserWindowApi = {
  // 传入地址，额外开一个窗口打开（http(s) 外链 / 应用内路由如 /task-monitor）
  open: async (url: string): Promise<boolean> => {
    try {
      const res = await window.api.browserWindow.open(url)
      if (!res.ok) throw new Error()
      return true
    } catch {
      message.error('打开窗口失败')
      return false
    }
  }
}

export default browserWindowApi
