import { ChildAgentConfig, McpConfig } from "../../../shared/types"
import { childrenAgentConfig, mcpConfig } from "../../config"
import crypto from 'crypto'



export type ChildAgentResponse = {
    name: string
    uuid: string
    version: string// 版本号,每次修改后需要更新
    description: string // 描述信息
    systemPrompt: string // agent 系统提示词
    tools?: string[] // 工具列表
    mcpList:Record<string,McpConfig['config']> // MCP 服务器配置列表
}


// 获取智能体配置
export const getAgent = (uuid: string):{success: boolean,md5?: string, agent?: ChildAgentResponse, error?: string} => {

  const agent = childrenAgentConfig.get(uuid) as ChildAgentConfig

  if(!agent){
    return {success: false, error: '智能体不存在或未启用'}
  }

  const { version, mcpList } = agent
  const mcpConfigList: Record<string,McpConfig['config']> = {}

  let mcpVersionJoin = ''
  
  if(mcpList.length > 0){
    mcpList.forEach((item) => {
      const config = mcpConfig.get(item.uuid) as McpConfig
      // 过滤出启用的 MCP 服务器
      if(config && config.isEnabled){
        mcpConfigList[config.key] = config.config
        mcpVersionJoin += config.version
      }
    })
  }

  //判断是否需要重新加载智能体配置
  const md5 = crypto.createHash('md5').update(version + mcpVersionJoin).digest('hex')

 
  return {success: true, md5, agent: {...agent, mcpList: mcpConfigList}}
}

//判断智能体是否存在
export const isAgentExist = (uuid: string): boolean => {
  // return defaultAgentList.has(uuid)
  const agent = childrenAgentConfig.get(uuid) as ChildAgentConfig || {}
  return !!agent?.uuid
}

export type AgentType = 'async-agent' | 'sync-agent'

//获取智能体信息描述（供主 Agent 查看可用子 Agent 列表）
export const getAllAgentDesc = (type: AgentType = 'async-agent'): string => {
  // const _agentlist = Array.from(defaultAgentList.values())
  const configs = childrenAgentConfig.getAll() as Record<string, ChildAgentConfig>
  const isAsync = type === 'async-agent'
  const list = Object.values(configs).filter((item) => {
    return item.isAsync === isAsync && item.isEnabled === true
  })

  let descStr = '\n'

  if (list.length === 0) {
    descStr += `(暂无可用${isAsync ? '异步' : '同步'}智能体)\n`
    return descStr
  }

  list.forEach((item) => {
    descStr += `- ${item.name}：${item.description}（agentId：${item.uuid}）\n`
  })

  return descStr
}

export default {
  getAgent,
  isAgentExist,
  getAllAgentDesc
}
