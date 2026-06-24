import styles from './ModalSet.module.css'
import deepseekLogo from '../../assets/image/deepseek-logo.svg'
import qwenLogo from '../../assets/image/qwen-logo.svg'
import { Input, message, Switch } from 'antd'
import { useEffect, useState } from 'react'
import { modelConfig, envConfig } from '@renderer/api/config'

import { ModelProvider } from '@shared/types'

interface ModelConfig {
  apiKey: string
  model: string
  logo: string
  isEdit: boolean
  baseUrl?: string
}

const ModeSet = () => {
  const [activeProvider, setActiveProvider] = useState<ModelProvider>()
  const [modelList, setModelList] = useState<Record<ModelProvider, ModelConfig>>({
    deepseek: {
      apiKey: '',
      model: '',
      logo: deepseekLogo,
      isEdit: false
    },
    qwen: {
      apiKey: '',
      model: '',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      logo: qwenLogo,
      isEdit: false
    }
  })

  useEffect(() => {
    initConfig()
  }, [])

  const initConfig = async () => {
    const modelConfigs = await modelConfig.getAll()
    const activeProviderConfig = await envConfig.get('activeProvider') as ModelProvider
    if(modelConfigs){
        for(const provider in modelList){
            if(modelConfigs[provider]){
                modelList[provider] = {...modelList[provider], ...modelConfigs[provider]}
            }
        }
    }
    setModelList({...modelList})
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
    message.success('启用成功')
  }

  const saveConfig = (key: ModelProvider) => {
    const { apiKey, model, baseUrl } = modelList[key]
    modelConfig.set(key, { apiKey, model, baseUrl })
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
      {Object.keys(modelList).map((provider:any) => (
        <div key={provider} className={[styles.modalWapper, provider === activeProvider ? styles.active : ''].join(' ')}>
          <div>
            <img src={modelList[provider].logo} alt="" />
            <span>{provider}</span>
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
              <span>
                {modelList[provider].isEdit ? 
                  <Input    
                  value={modelList[provider].apiKey}
                  onChange={(e) => changeEdit(provider, 'apiKey', e.target.value)}
                />:modelList[provider].apiKey}
              </span>
            </div>
            <div className={styles.listItem}>
              <span>model</span>
              <span>
                {modelList[provider].isEdit ? 
                  <Input
                  value={modelList[provider].model}
                  onChange={(e) => changeEdit(provider, 'model', e.target.value)}
                />:modelList[provider].model}
              </span>
            </div>
            <div className={styles.listItem}>
              <span>启用</span>
              <span>
                <Switch checked={provider === activeProvider} onChange={() => switchProvider(provider)} />
              </span>
            </div>
          </div>
        </div>
      ))}
    </main>
  )
}
export default ModeSet
