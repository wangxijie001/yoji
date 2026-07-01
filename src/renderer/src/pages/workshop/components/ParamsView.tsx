import { useEffect, useState } from 'react'
import { Button, Drawer, Input, Switch, Tag } from 'antd'
import type { ChildAgentConfig, McpConfig } from '@shared/types'
import { mcpConfig } from '@renderer/api/config'
import styles from './ParamsView.module.css'

interface Props {
  open: boolean
  title: string
  params: Partial<ChildAgentConfig>
  onClose: () => void
  onConfirm: (params: Partial<ChildAgentConfig>) => void
}

const ParamsView = ({ open, title, params, onClose, onConfirm }: Props) => {
  const [localParams, setLocalParams] = useState(params)
  const [showMcpSelector, setShowMcpSelector] = useState(false)
  const [allMcpList, setAllMcpList] = useState<McpConfig[]>([])

  useEffect(() => {
    setLocalParams(params)
  }, [params])

  useEffect(() => {
    loadMcpList()
  }, [])

  const changeParamsItem = (key: keyof Partial<ChildAgentConfig>, value: any) => {
    setLocalParams({
      ...localParams,
      [key]: value
    })
  }

  const loadMcpList = async () => {
    const configs = await mcpConfig.getAll() as Record<string, McpConfig>
    if (configs) {
      setAllMcpList(Object.values(configs))
    }
  }

  // 过滤掉已选中的，只展示可选的
  const selectedUuids = new Set(localParams.mcpList?.map((m) => m.uuid) || [])
  const availableMcp = allMcpList.filter((m) => !selectedUuids.has(m.uuid))

  const toggleMcp = (mcp: McpConfig) => {
    const current = localParams.mcpList || []
    changeParamsItem('mcpList', [...current, {key: mcp.key, uuid: mcp.uuid, name: mcp.name, description: mcp.description || '' }])
  }

  const removeMcp = (uuid: string) => {
    changeParamsItem('mcpList', (localParams.mcpList || []).filter((m) => m.uuid !== uuid))
  }

  return (
    <>
      <Drawer
        size="60%"
        placement="right"
        onClose={onClose}
        open={open}
        destroyOnHidden
        getContainer={false}
        title={title}
        mask={false}
        style={{ background: 'var(--default-drawer-bg)' }}
        styles={{ header: { padding: ' 8px 16px', border: 'none' }, body: { padding: ' 0 10px 0 20px' } }}
      >
        <div className={`${styles.panel} thin-scrollbar`}>
          <div className={styles.params}>
            <div>
              <span>名称</span>
              <div><Input value={localParams.name} onChange={(e) => changeParamsItem('name', e.target.value)} placeholder="智能体名称" /></div>
            </div>
            <div>
              <span>描述</span>
              <div><Input.TextArea value={localParams.description} onChange={(e) => changeParamsItem('description', e.target.value)} placeholder="描述当前智能体的功能和适用场景，以便ai助手识别并调用，例：这是一个专业的翻译，可以将英文翻译成中文..." /></div>
            </div>
            <div>
              <span>提示词</span>
              <div><Input.TextArea value={localParams.systemPrompt} onChange={(e) => changeParamsItem('systemPrompt', e.target.value)} placeholder="用于指导当前智能体如何工作或定位当前智能体角色，例：你是一个专业的翻译，负责将英文翻译成中文... 输出要求：..." /></div>
            </div>
            <div>
              <span>异步执行</span>
              <div><Switch checked={localParams.isAsync === true} onChange={() => changeParamsItem('isAsync', !localParams.isAsync)} /></div>
            </div>
            <div>
              <span>
                工具集
                <Button type="primary" size="small" ghost onClick={() => setShowMcpSelector(true)}>添加</Button>
              </span>
              <div>
                {localParams.mcpList?.map((item) => (
                  <Tag color="cyan" variant="outlined" key={item.uuid} className={styles.mcpTag}>
                    {item.name}
                    <i className="iconfont icon-cocos-shanchu" onClick={() => removeMcp(item.uuid)} />
                  </Tag>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.footer}>
            <Button type="primary" ghost onClick={onClose}>取消</Button>
            <Button type="primary" onClick={() => onConfirm(localParams)}>确定</Button>
          </div>
        </div>
      </Drawer>
      <Drawer
        size="60%"
        placement="right"
        onClose={() => setShowMcpSelector(false)}
        open={showMcpSelector}
        getContainer={false}
        destroyOnHidden
        title="选择 MCP 服务"
        mask={false}
        style={{ background: 'var(--default-drawer-bg)' }}
        styles={{ header: { padding: ' 8px 16px', border: 'none' }, body: { padding: ' 0 10px 0 20px' } }}
      >
        <div className={`${styles.mcpListWapper} thin-scrollbar`}>
          {availableMcp.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center', marginTop: 40, fontSize: 12 }}>暂无可选的 MCP 服务</p>
          ) : (
            availableMcp.map((mcp) => (
              <div key={mcp.uuid} className={styles.mcpItem}>
                <div>
                  <span>{`${mcp.name}(${mcp.key})`}</span>
                  {mcp.isEnabled ? <i className="iconfont icon-cocos-jia" onClick={() => toggleMcp(mcp)} /> : <p>已禁用</p>}
                </div>
                <div>{mcp.description}</div>
              </div>
            ))
          )}
        </div>
        <div className={styles.footer}>
          <Button type="primary" onClick={() => setShowMcpSelector(false)}>关闭</Button>
        </div>
      </Drawer>
    </>
  )
}

export default ParamsView
