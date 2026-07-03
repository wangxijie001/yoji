import styles from './McpManage.module.css'
import mcpLogo from '../../assets/image/mcp-logo.png'
import { Drawer, Input, message, Select, Switch, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { McpConfig } from '@shared/types'
import { v4 as uuidv4 } from 'uuid'
import { mcpConfig } from '@renderer/api/config'
import mcpApi from '@renderer/api/mcp'
import agentApi from '@renderer/api/agent'

type McpConfigItem = McpConfig & { isEdit?: boolean, isAddModel?: boolean }
const McpManage = () => {
    const [openDsc, setOpenDsc] = useState<Partial<{ isOpen: boolean } & McpConfigItem>>({ isOpen: false })
    const [mcpList, setMcpList] = useState<McpConfigItem[]>([])


    useEffect(() => {
        initConfig()
    }, [])

    const initConfig = async () => {
        const modelConfigs = await mcpConfig.getAll() as Record<string, McpConfig>
        if (modelConfigs) {
            const list = Object.values(modelConfigs).reverse()
            setMcpList([{
                key: 'new-mcp',
                name: '新增',
                description: '新增一个MCP服务链接',
                config: {
                    transport: 'sse',
                    url: 'https://xxxxxxx.com/mcp',
                    command: 'npx',
                    args: [],
                },
                isEnabled: false,
                isExposeToMain: false,
                isAddModel: true,
                isEdit: true,
                uuid: "new_mcp_model",
                version: '',
                tools: [],
            }, ...list])
        }
    }



    // 编辑配置
    const changeConfig = (index: number, field: string, value: any) => {
        if (['transport', 'url', 'command', 'args'].includes(field)) {
            mcpList[index].config[field] = value
        } else {
            mcpList[index][field] = value
        }
        setMcpList([...mcpList])
    }

    // 切换布尔开关（isEnabled / isExposeToMain 等）
    const switchBoolean = async (index: number, field: 'isEnabled' | 'isExposeToMain') => {
        const current = await mcpConfig.get(mcpList[index].uuid) as McpConfig
        if (!current) return
        current[field] = !current[field]
        mcpList[index][field] = current[field]
        setMcpList([...mcpList])
        mcpConfig.set(current.uuid, current)
        agentApi.updateVersion()
    }

    // 保存配置
    const saveConfig = async (index: number) => {
        const isAdd = mcpList[index].uuid === "new_mcp_model"
        const uuid = isAdd ? uuidv4() : mcpList[index].uuid
        const { key, name, description, config, isEnabled, isExposeToMain } = mcpList[index]
        
        if (!key || !name || !description || !config.transport) {
            message.error('请填写全部参数')
            return
        }
        
        if (config.transport === 'stdio') {
            if (!config.command || !config.args?.length) {
                message.error('NPX 模式下请填写 command 和 args（包名）')
                return
            }
        } else {
            if (!config.url) {
                message.error('请填写 URL')
                return
            }
        }
        // 按 transport 类型组装纯净 config
        const transport = config.transport || 'sse'
        const cleanConfig: McpConfig['config'] = transport === 'stdio'
            ? { transport, command: config.command || 'npx', args: config.args || [] }
            : { transport, url: config.url || '' }
        const testArg = transport === 'stdio'
            ? (cleanConfig.command || 'npx') + ' ' + (cleanConfig.args || []).join(' ')
            : (cleanConfig.url || '')

        // 测试连接
        const tools = await mcpApi.testConnection(transport, testArg).catch(() => null)
        if (!tools) return
        message.success(`连接成功，发现 ${tools.length} 个工具, 配置已保存`)
        const version = uuidv4()
        mcpConfig.set(uuid, {
            key,
            uuid,
            name,
            description,
            config: cleanConfig,
            isEnabled,
            isExposeToMain: isExposeToMain || false,
            tools,
            version
        })
        mcpList[index] = {
            ...mcpList[index],
            isEnabled,
            tools,
        }
        if (isAdd) {
            initConfig()
        } else {
            mcpList[index].isEdit = false
            setMcpList([...mcpList])
        }
        // 更新 MCP 库版本号，触发 agent 重建
        await agentApi.updateVersion()
    }

    // 卸载配置
    const uninstallConfig = async (index: number) => {
        const uuid = mcpList[index].uuid
        mcpConfig.delete(uuid)
        setMcpList(mcpList.filter((item) => item.uuid !== uuid))
        message.success('卸载成功')
        // 更新 MCP 库版本号，触发 agent 重建
        await agentApi.updateVersion()
    }



    return (
        <main className={`${styles.wapper} thin-scrollbar`}>
            {mcpList.map((mcp: McpConfigItem, index: number) => (
                <div key={mcp.uuid} className={[styles.modalWapper, mcp.isEnabled ? styles.active : ''].join(' ')}>
                    <div>
                        <img src={mcpLogo} alt="" />
                        <span>{mcp.name || mcp.key} <i className="iconfont icon-cocos-tishi_mian" onClick={() => setOpenDsc({ ...openDsc, isOpen: true, ...mcp })} /></span>
                        {mcp.isEdit && (
                            <i
                                className="iconfont icon-cocos-version-list"
                                onClick={() => saveConfig(index)}
                                title="保存"
                            />
                        )}
                        {!mcp.isEdit && mcp.isEnabled && (
                            <i
                                className="iconfont icon-cocos-zidingyiguanli"
                                onClick={() => changeConfig(index, 'isEdit', true)}
                                title="编辑"
                            />
                        )}
                        {!mcp.isEnabled && !mcp.isAddModel && (
                            <i
                                className="iconfont icon-cocos-xiezai"
                                onClick={() => uninstallConfig(index)}
                                title="卸载"
                            />
                        )}
                    </div>
                    <div>
                        <div className={styles.listItem}>
                            <span>名称</span>
                            <span title={mcp.name}>
                                {mcp.isEdit ?
                                    <Input
                                        value={mcp.name}
                                        onChange={(e) => changeConfig(index, 'name', e.target.value)}
                                    /> : mcp.name}
                            </span>
                        </div>
                        <div className={styles.listItem}>
                            <span>key</span>
                            <span title={mcp.key}>
                                {mcp.isEdit ?
                                    <Input
                                        value={mcp.key}
                                        onChange={(e) => changeConfig(index, 'key', e.target.value)}
                                    /> : mcp.key}
                            </span>
                        </div>
                        <div className={styles.listItem}>
                            <span>transport</span>
                            <span>
                                {mcp.isEdit ?
                                    <Select
                                        value={mcp.config.transport || 'sse'}
                                        onChange={(v) => changeConfig(index, 'transport', v)}
                                        style={{ width: '100%' }}
                                        options={[
                                            { value: 'sse', label: 'SSE (Server-Sent Events)' },
                                            { value: 'http', label: 'HTTP (Streamable)' },
                                            { value: 'stdio', label: 'NPX (本地进程)' }
                                        ]}
                                    /> : mcp.config.transport}
                            </span>
                        </div>
                        {mcp.config.transport === 'stdio' ? (
                            <>
                                <div className={styles.listItem}>
                                    <span>command</span>
                                    <span>
                                        {mcp.isEdit ?
                                            <Input
                                                value={mcp.config.command || 'npx'}
                                                placeholder="npx"
                                                onChange={(e) => changeConfig(index, 'command', e.target.value)}
                                            /> : (mcp.config.command || 'npx')}
                                    </span>
                                </div>
                                <div className={styles.listItem}>
                                    <span>args</span>
                                    <span>
                                        {mcp.isEdit ?
                                            <Input
                                                value={(mcp.config.args || []).join(' ')}
                                                placeholder="@scope/mcp-pkg@latest"
                                                onChange={(e) => changeConfig(index, 'args', e.target.value.split(/\s+/).filter(Boolean))}
                                            /> : (mcp.config.args || []).join(' ')}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className={styles.listItem}>
                                <span>url</span>
                                <span title={mcp.config.url}>
                                    {mcp.isEdit ?
                                        <Input
                                            value={mcp.config.url}
                                            onChange={(e) => changeConfig(index, 'url', e.target.value)}
                                        /> : mcp.config.url}
                                </span>
                            </div>
                        )}
                        <div className={styles.listItem}>
                            <span>简介</span>
                            <span title={mcp.description}>
                                {mcp.isEdit ?
                                    <Input
                                        value={mcp.description}
                                        onChange={(e) => changeConfig(index, 'description', e.target.value)}
                                    /> : mcp.description}
                            </span>
                        </div>
                        {!mcp.isEdit && <div className={styles.listItem}>
                            <span>主Agent启用</span>
                            <span>
                                <Switch size="small" checked={mcp.isExposeToMain} onChange={() => switchBoolean(index, 'isExposeToMain')} />
                            </span>
                        </div>}
                        {!mcp.isEdit && <div className={styles.listItem}>
                            <span>启用</span>
                            <span>
                                <Switch size="small" checked={mcp.isEnabled} onChange={() => switchBoolean(index, 'isEnabled')} />
                            </span>
                        </div>}
                    </div>
                </div>
            ))}
            <Drawer
                size='60%'
                placement='right'
                onClose={() => setOpenDsc({ ...openDsc, isOpen: false })}
                open={openDsc.isOpen}
                getContainer={false}
                title={'参数介绍'}
                mask={false}
                style={{ background: 'var(--default-drawer-bg)' }}
                styles={{ header: { padding: ' 8px 16px', border: 'none' }, body: { padding: ' 0 10px 0 20px' } }}

            >
                <div className={`${styles.paramsDsc} thin-scrollbar`}>
                    <ul>
                        <li>
                            <strong>名称</strong>
                            <p>{openDsc.name || '未配置'}</p>

                        </li>
                        <li>
                            <strong>key</strong>
                            <p>{openDsc.key || '未配置'}</p>

                        </li>
                        <li>
                            <strong>transport</strong>
                            <p>{openDsc.config?.transport || '未配置'}</p>

                        </li>
                        <li>
                            <strong>url</strong>
                            <p>{openDsc.config?.url || '未配置'}</p>

                        </li>
                        <li>
                            <strong>简介</strong>
                            <p>{openDsc.description || '未配置'}</p>
                        </li>
                        <li>
                            <strong>启用</strong>
                            <p><Tag color={openDsc.isEnabled ? 'cyan' : ''} variant='solid'>{openDsc.isEnabled ? '已启用' : '未启用'}</Tag></p>
                        </li>
                        <li>
                            <strong>工具列表</strong>
                            <p>
                                {openDsc.tools?.map(tool =>
                                    <div className={styles.toolItem} key={tool.name}>
                                        <div>{tool.name}</div>
                                        <div>{tool.description}</div>
                                    </div>
                                )}
                            </p>
                        </li>
                    </ul>
                </div>

            </Drawer>
        </main>
    )
}
export default McpManage
