import styles from './ModalSet.module.css'
import deepseekLogo from '../../assets/image/deepseek-logo.svg'
import openaiLogo from '../../assets/image/mcp-logo.png'
import { Drawer, Input, message, Switch } from 'antd'
import { useEffect, useState } from 'react'
import { modelConfig, envConfig } from '@renderer/api/config'
import agentApi from '@renderer/api/agent'

import { ModelProvider } from '@shared/types'

interface ModelConfig {
  apiKey: string
  model: string
  tavilyApiKey: string
  logo: string
  isEdit: boolean
  baseURL?: string
}

const ModeSet = () => {
  const [activeProvider, setActiveProvider] = useState<ModelProvider>()
  const [openParamsDsc, setOpenParamsDsc] = useState(false)
  const [modelList, setModelList] = useState<Record<ModelProvider, ModelConfig>>({
    deepseek: {
      apiKey: '',
      model: '',
      tavilyApiKey: '',
      logo: deepseekLogo,
      isEdit: false
    },
    openai: {
      apiKey: '',
      model: '',
      tavilyApiKey: '',
      baseURL: '',
      logo: openaiLogo,
      isEdit: false
    }
  })

  useEffect(() => {
    initConfig()
  }, [])

  const initConfig = async () => {
    const modelConfigs = await modelConfig.getAll()
    const activeProviderConfig = await envConfig.get('activeProvider') as ModelProvider
    if (modelConfigs) {
      for (const provider in modelList) {
        if (modelConfigs[provider]) {
          modelList[provider] = { ...modelList[provider], ...modelConfigs[provider] }
        }
      }
    }
    setModelList({ ...modelList })
    setActiveProvider(activeProviderConfig)
  }

  const changeEdit = (provider: ModelProvider, key: keyof ModelConfig, value: any) => {
    setModelList((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [key]: value
      }
    }))
  }

  const switchProvider = (provider: ModelProvider) => {
    setActiveProvider(provider)
    envConfig.set('activeProvider', provider)
    agentApi.updateVersion()
    message.success('启用成功')
  }

  const saveConfig = (key: ModelProvider) => {
    const { apiKey, model, baseURL, tavilyApiKey } = modelList[key]
    modelConfig.set(key, { apiKey, model, baseURL, tavilyApiKey })
    agentApi.updateVersion()
    message.success('保存成功')
    setModelList((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        isEdit: false
      }
    }))
  }


  return (
    <main className={styles.wapper}>
      {Object.keys(modelList).map((provider: any) => (
        <div key={provider} className={[styles.modalWapper, provider === activeProvider ? styles.active : ''].join(' ')}>
          <div>
            <img src={modelList[provider].logo} alt="" />
            <span>{provider} <i className="iconfont icon-cocos-tishi_mian" onClick={() => setOpenParamsDsc(true)} /></span>
            {modelList[provider].isEdit ? (
              <i
                className="iconfont icon-cocos-version-list"
                onClick={() => saveConfig(provider)}
                title="保存"
              />
            ) : (
              <i
                className="iconfont icon-cocos-zidingyiguanli"
                onClick={() => changeEdit(provider, 'isEdit', true)}
                title="编辑"
              />
            )}
          </div>
          <div>
            <div className={styles.listItem}>
              <span>api-key</span>
              <span title={modelList[provider].apiKey}>
                {modelList[provider].isEdit ?
                  <Input
                    value={modelList[provider].apiKey}
                    onChange={(e) => changeEdit(provider, 'apiKey', e.target.value)}
                  /> : modelList[provider].apiKey}
              </span>
            </div>
            <div className={styles.listItem}>
              <span>model</span>
              <span title={modelList[provider].model}>
                {modelList[provider].isEdit ?
                  <Input
                    value={modelList[provider].model}
                    onChange={(e) => changeEdit(provider, 'model', e.target.value)}
                  /> : modelList[provider].model}
              </span>
            </div>
            <div className={styles.listItem}>
              <span>tavily-key</span>
              <span title={modelList[provider].tavilyApiKey}>
                {modelList[provider].isEdit ?
                  <Input
                    value={modelList[provider].tavilyApiKey}
                    onChange={(e) => changeEdit(provider, 'tavilyApiKey', e.target.value)}
                  /> : modelList[provider].tavilyApiKey}
              </span>
            </div>
            <div className={styles.listItem}>
              <span>baseURL</span>
              <span title={modelList[provider].baseURL}>
                {modelList[provider].isEdit ?
                  <Input
                    value={modelList[provider].baseURL}
                    onChange={(e) => changeEdit(provider, 'baseURL', e.target.value)}
                  /> : modelList[provider].baseURL}
              </span>
            </div>
            {!modelList[provider].isEdit && <div className={styles.listItem}>
              <span>启用</span>
              <span>
                <Switch checked={provider === activeProvider} onChange={() => switchProvider(provider)} />
              </span>
            </div>}
          </div>
        </div>
      ))}
      <Drawer
        size='50%'
        placement='right'
        onClose={() => setOpenParamsDsc(false)}
        open={openParamsDsc}
        getContainer={false}
        title={'参数介绍'}
        mask={false}
        style={{ background: 'var(--default-drawer-bg)' }}
        styles={{ header: { padding: ' 8px 16px', border: 'none' }, body: { padding: ' 0 20px' } }}

      >
        <div className={styles.paramsDsc}>
          <ul>
            <li>
              <strong>提示</strong> <br />修改正在使用的模型的参数后，需要重启项目才能生效
            </li>
            <li>
              <strong>api-key</strong>
              <p>模型服务商的 API 密钥，用于调用大语言模型。</p>
              <p>获取方式：
                <br />· DeepSeek：访问 <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</a>，注册后在 API Keys 页面创建
                <br />· Qwen（通义千问）：访问 <a href="https://bailian.console.aliyun.com/" target="_blank">阿里云百炼</a>，开通模型服务后创建 API Key
              </p>
            </li>
            <li>
              <strong>model</strong>
              <p>要调用的模型名称，不同服务商支持不同模型。</p>
              <p>获取方式：
                <br />· DeepSeek：在 <a href="https://platform.deepseek.com/api_keys" target="_blank">控制台</a> 查看可用模型列表，如 deepseek-chat、deepseek-reasoner
                <br />· Qwen：在 <a href="https://bailian.console.aliyun.com/" target="_blank">阿里云百炼</a> 模型广场查看模型名称，如 qwen-plus、qwen-max
              </p>
            </li>
            <li>
              <strong>tavily-key</strong>
              <p>Tavily 搜索 API 密钥，用于 AI 联网搜索。不填则无法使用联网检索功能。</p>
              <p>获取方式：
                <br />· 访问 <a href="https://app.tavily.com/home" target="_blank">app.tavily.com</a>，注册后在 API Keys 页面创建免费 Key
                <br />· 免费额度每月 1000 次搜索，足够日常使用
              </p>
            </li>
            <li>
              <strong>baseUrl（可选）</strong>
              <p>自定义 API 服务地址，需兼容 OpenAI 接口规范。使用 OpenAI 官方接口无需填写，其他厂商均需配置</p>
              <p>常见厂商 baseUrl 示例：
                <br />· DeepSeek：<code>https://api.deepseek.com/v1</code>
                <br />· 阿里云百炼（Qwen）：<code>https://dashscope.aliyuncs.com/compatible-mode/v1</code>
                <br />· 智谱（GLM）：<code>https://open.bigmodel.cn/api/paas/v4</code>
                <br />· Moonshot（Kimi）：<code>https://api.moonshot.cn/v1</code>
                <br />· 硅基流动（SiliconFlow）：<code>https://api.siliconflow.cn/v1</code>
              </p>
            </li>
          </ul>
        </div>

      </Drawer>
    </main>
  )
}
export default ModeSet
