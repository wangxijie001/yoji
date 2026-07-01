/**
 * 配置 API——通用封装，通过 configName 区分不同配置文件
 *
 *   configs/env.json      环境变量（API Key、baseURL 等）
 *   configs/model.json    模型配置
 *
 * 用法：
 *   import { envConfig } from '@renderer/api/config'
 *   await envConfig.set('apiKey', 'sk-xxx')
 */

import { ConfigName } from '@shared/types'

function createConfig(configName: ConfigName) {
  return {
    getAll: (): Promise<Record<string, unknown>> => window.api.config.getAll(configName),

    get: async <T = unknown>(key: string): Promise<T | undefined> => {
      return (await window.api.config.get(configName, key)) as T | undefined
    },

    set: (key: string, value: unknown): Promise<void> =>
      window.api.config.set(configName, key, value),

    delete: (key: string): Promise<void> => window.api.config.delete(configName, key),
  }
}

export const envConfig = createConfig('env')
export const modelConfig = createConfig('model')
export const mcpConfig = createConfig('mcp')
export const childrenAgentConfig = createConfig('childrenAgent')

