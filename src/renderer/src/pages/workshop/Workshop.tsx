import { useEffect, useState } from 'react'
import styles from './Workshop.module.css'
import { childrenAgentConfig } from '@renderer/api/config'
import { ChildAgentConfig } from '@shared/types'
import { Button, message, Modal, Switch } from 'antd'
import ParamsView from './components/ParamsView'
import agentApi from '@renderer/api/agent'
import { v4 as uuidv4 } from 'uuid'
import agentLogo from '../../assets/image/agent-logo.png'
type WorkshopType = {
  key: string
  label: string
  prompt: string
}
const workshopType: WorkshopType[] = [
  {
    key: 'async-agent',
    label: '异步执行',
    prompt: 'AI 把耗时任务派发到后台执行，调用异步智能体，不打断当前对话，完成后通知你。适用场景：联网检索、批量处理文件、数据爬取、定时任务等。注意：同时开启过多任务会导致聊天上下文剧增，影响对话质量与token成本。',

  },
  {
    key: 'sync-agent',
    label: '同步执行',
    prompt: 'AI 调用 同步智能体 即时执行，等结果返回再继续。适用场景：读写文件、执行命令、代码运行等。注意：同时开启过多任务会导致聊天上下文剧增，影响对话质量与token成本。',
  },
]
const Workshop = () => {

  const [activeType, setActiveType] = useState<WorkshopType>(workshopType[0])
  const [childrenAgentList, setChildrenAgentList] = useState<ChildAgentConfig[]>([])
  const [showTypePrompt, setShowTypePrompt] = useState<boolean>(true)  //提示
  const [openDsc, setOpenDsc] = useState<{ isOpen: boolean, title: string, params: Partial<ChildAgentConfig> }>({ isOpen: false, title: '', params: {} })



  useEffect(() => {
    loadChildrenAgentConfig()
  }, [])

  const changeWorkshopType = (type: WorkshopType) => {
    setActiveType(type)
    loadChildrenAgentConfig(type.key)
  }

  // 切换启用状态
  const switchEnabledStatus = async (index: number) => {

    const current = await childrenAgentConfig.get(childrenAgentList[index].uuid) as ChildAgentConfig
    if (!current) {
      return
    }
    current.isEnabled = !current.isEnabled
    childrenAgentList[index].isEnabled = current.isEnabled
    setChildrenAgentList([...childrenAgentList])
    childrenAgentConfig.set(current.uuid, current)
    agentApi.updateVersion()
    message.success(current.isEnabled ? '已启用' : '已禁用')
  }

  const loadChildrenAgentConfig = async (type = 'async-agent') => {
    const childrenAgentConfigs = await childrenAgentConfig.getAll() as Record<string, ChildAgentConfig>
    if (childrenAgentConfigs) {
      const list = Object.values(childrenAgentConfigs).reverse()
      const _list = list.filter((item) => item.isAsync === (type === 'async-agent'))
      setChildrenAgentList(_list)
    }
  }

  const onDrawerConfirm = (params: Partial<ChildAgentConfig>) => {
    const { name, description, systemPrompt, isAsync, mcpList, uuid } = params
    if (!name || !description || !systemPrompt) {
      message.error('请填写必要信息【名称】【描述】【系统提示词】')
      return
    }
    const _uuid = uuid || uuidv4()
    const _agentConfig = {
      name,
      uuid: _uuid,
      isAsync,
      isSystem: false,
      version: uuidv4(),
      description,
      systemPrompt,
      mcpList: mcpList || [],
      isEnabled: false,
      createdAt: Date.now()
    } as ChildAgentConfig
    message.success(uuid ? '更新成功' : '新增成功')
    childrenAgentConfig.set(_uuid, _agentConfig)
    agentApi.updateVersion()
    changeWorkshopType(params.isAsync ? workshopType[0] : workshopType[1])
    setOpenDsc({ isOpen: false, title: '', params: {} })
  }

  const deleteAgent = (item: ChildAgentConfig) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除智能体「${item.name}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        childrenAgentConfig.delete(item.uuid)
        agentApi.updateVersion()
        message.success('已删除')
        loadChildrenAgentConfig(activeType.key)
      }
    })
  }



  return (
    <main className={styles.wrapper}>
      <div className={styles.btnWapper}>
        <Button type="primary" onClick={() => setOpenDsc({ isOpen: true, title: '新增', params: { isAsync: activeType.key === 'async-agent' } })} title="新增智能体">新增</Button>
      </div>
      <div className={styles.header}>
        {workshopType.map((item) => (
          <span key={item.key} className={activeType.key === item.key ? styles.active : ''} onClick={() => changeWorkshopType(item)}>
            {item.label}
          </span>
        ))}
      </div>
      {showTypePrompt && <div className={styles.typePrompt}>
        {activeType.prompt}
        <i className={'iconfont icon-cocos-hidden'} title={'收起提示'} onClick={() => setShowTypePrompt(false)} /></div>
      }
      <div className={`${styles.content} thin-scrollbar`}>

        {childrenAgentList.map((item, index) => (
          <div className={`${styles.agentItem} ${item.isEnabled ? styles.active : ''}`} key={item.uuid}>
            <div>
              <img src={agentLogo} alt="" />
              <span>{item.name}</span>
              {!item.isSystem && (
                <>
                  {!item.isEnabled && <i
                    className="iconfont icon-cocos-xiezai"
                    title="删除"
                    onClick={() => deleteAgent(item)}
                  />}
                  <i
                    className="iconfont icon-cocos-zidingyiguanli"
                    title="编辑"
                    onClick={() => setOpenDsc({ isOpen: true, title: '编辑', params: item })}
                  />
                </>
              )}
            </div>
            <div>
              <div className={styles.listItem}>
                <span>描述</span>
                <span title={item.description}>
                  {item.description}
                </span>
              </div>
              <div className={styles.listItem}>
                <span>提示词</span>
                <span title={item.systemPrompt}>
                  {item.systemPrompt}
                </span>
              </div>

              <div className={styles.listItem}>
                <span>启用</span>
                <span>
                  <Switch size="small" checked={item.isEnabled} onChange={() => switchEnabledStatus(index)} />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <ParamsView
        open={openDsc.isOpen}
        title={openDsc.title}
        params={openDsc.params}
        onClose={() => setOpenDsc({ title: '', params: {}, isOpen: false })}
        onConfirm={(params) => {
          onDrawerConfirm(params)
        }}
      />
    </main>
  )
}

export default Workshop
