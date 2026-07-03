import { ipcMain } from 'electron'
import { MultiServerMCPClient } from '@langchain/mcp-adapters'

export function register(): void {
  ipcMain.handle('mcp:testConnection', async (_, transport: string, connectStr: string) => {
    let serverConfig: any

    if (transport === 'stdio') {
      const parts = connectStr.split(/\s+/).filter(Boolean)
      serverConfig = {
        transport: 'stdio',
        command: parts[0] || 'npx',
        args: parts.slice(1)
      }
    } else {
      serverConfig = {
        transport: transport,
        url: connectStr
      }
    }

    const client = new MultiServerMCPClient({ _test: serverConfig })
    try {
      let timeoutId: ReturnType<typeof setTimeout>
      const tools = await Promise.race([
        client.getTools(),
        new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error('连接超时(15s)')), 15000) })
      ]).finally(() => clearTimeout(timeoutId!))
      const toolList = tools.map((t) => ({ name: t.name, description: t.description }))
      return { ok: true, data: toolList }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    } finally {
      await client.close().catch(() => {})
    }
  })

}



