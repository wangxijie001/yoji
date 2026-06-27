import { ipcMain } from 'electron'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { getConfig } from '../config'
import { v4 as uuidv4 } from 'uuid'

export function register(): void {
  ipcMain.handle('mcp:testConnection', async (_, transport: string, url: string) => {
    const client = new MultiServerMCPClient({
      _test: {
        transport: transport as 'sse' | 'http',
        url,
      },
    })
    try {
      let timeoutId: ReturnType<typeof setTimeout>
      const tools = await Promise.race([
        client.getTools(),
        new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error('连接超时(15s)')), 15000) })
      ])
      clearTimeout(timeoutId!)
      const toolList = tools.map((t) => ({ name: t.name, description: t.description }))
      return { ok: true, data: toolList }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    } finally {
      await client.close().catch(() => {})
    }
  })

  ipcMain.handle('mcp:updateMcpStoreVersion', async () => {
    try {
      await updateMcpStoreVersion()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })
}



//在环境变量配置文件里添加一个mcpStoreVersion字段,保存当前mcp库的版本，值为uuid
//更新mcp库版本
export const updateMcpStoreVersion = async () => {
  const uuid = uuidv4()
  getConfig('env').set('mcpStoreVersion', uuid)
}

//获取mcp库版本
export const getMcpStoreVersion = () => {
  const version = getConfig('env').get('mcpStoreVersion') as string || ''
  return version
}