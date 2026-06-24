import { ipcMain } from 'electron'
import request from '../http'

// HTTP 请求（渲染进程通过此通道调用接口）
export function register(): void {
  ipcMain.handle('http:request', async (_, { method, url, data, config }) => {
    try {
      let res
      switch (method) {
        case 'GET':
          res = await request.get(url, config)
          break
        case 'POST':
          res = await request.post(url, data, config)
          break
        case 'PUT':
          res = await request.put(url, data, config)
          break
        case 'PATCH':
          res = await request.patch(url, data, config)
          break
        case 'DELETE':
          res = await request.delete(url, config)
          break
        default:
          return { ok: false, error: `不支持的请求方法: ${method}` }
      }
      return { ok: true, data: res.data }
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      return { ok: false, error: message }
    }
  })
}
