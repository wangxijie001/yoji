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
        if (['transport', 'url', 'command', 'args', 'env'].includes(field)) {
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
        const { key, name, description, config, isExposeToMain } = mcpList[index]
        
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
        // 测试连接并保存
        try {
            const result = await mcpApi.save({
                key, uuid, name, description,
                transport: config.transport || 'sse',
                url: config.url,
                command: config.command,
                args: config.args,
                isExposeToMain,
                envPath: config.env?.PATH
            })
            if (!result || !result.length) return
            // 保存配置
            message.success(`连接成功，发现 ${result?.length || 0} 个工具, 配置已保存`)
            mcpList[index] = { ...mcpList[index], isEnabled: false, tools: result || [] }
            if (isAdd) { initConfig() } else { mcpList[index].isEdit = false; setMcpList([...mcpList]) }
        } catch {
            // mcpApi.save 内部已 toast 错误信息，这里只需兜底
        }
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
                        {!mcp.isEdit &&  !mcp.isAddModel && (
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
                                        value={mcp.config.transport}
                                        onChange={(v) => changeConfig(index, 'transport', v)}
                                        style={{ width: '100%' }}
                                        options={[
                                            { value: 'sse', label: 'SSE' },
                                            { value: 'http', label: 'HTTP' },
                                            { value: 'stdio', label: '本地进程启动' }
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
                                                value={mcp.config.command}
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
                                <div className={styles.listItem}>
                                    <span>envPath</span>
                                    <span>
                                        {mcp.isEdit ?
                                            <Input
                                                placeholder="找不到 npx？在此填入 npx 所在目录（其它命令同样适用）"
                                                value={mcp.config.env?.PATH || ''}
                                                onChange={(e) => changeConfig(index, 'env', e.target.value ? { PATH: e.target.value } : undefined)}
                                            /> : (mcp.config.env?.PATH || '')}
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
                            <p>给这个 MCP 服务起个名字，方便你在列表中识别。不会影响功能。</p>
                            <p style={{ color: '#1677ff' }}>{openDsc.name || '未配置'}</p>
                        </li>
                        <li>
                            <strong>key</strong>
                            <p>这个 MCP 服务的唯一标识，AI 调用工具时会带着这个前缀（如 <code>yourkey__toolName</code>）。只能填小写字母和短横线，一旦保存不要随意修改，否则工坊里绑定的 Agent 会失效。</p>
                            <p style={{ color: '#1677ff' }}>{openDsc.key || '未配置'}</p>
                        </li>
                        <li>
                            <strong>transport</strong>
                            <div>选择这个 MCP 服务的通信方式：</div>
                            <ul style={{ margin: '4px 0', paddingLeft: 18, fontSize: 12, color: '#696969' }}>
                                <li>SSE / HTTP—— 远程服务，需填写下方的 URL 地址</li>
                                <li>本地进程 —— 本地命令，通过 npx或其他命令启动，需填写 command 和 args</li>
                            </ul>
                            <div style={{ color: '#1677ff' }}>{openDsc.config?.transport || '未配置'}</div>
                        </li>
                        <li>
                            <strong>url</strong>
                            <p>仅 SSE / HTTP 模式有效。填写 MCP 服务的完整地址，例如 <code>https://example.com/mcp</code></p>
                            <p style={{ color: '#1677ff' }}>{openDsc.config?.url || '未配置'}</p>
                        </li>
                        <li>
                            <strong>command / args</strong>
                            <p>仅 NPX 模式有效。command 填启动命令（通常是 <code>npx</code>），args 填包名和额外参数，空格分隔。例如：<code>chrome-devtools-mcp@latest --headless</code></p>
                            <p style={{ color: '#1677ff' }}>
                                {openDsc.config?.transport === 'stdio'
                                    ? `${openDsc.config?.command || 'npx'} ${(openDsc.config?.args || []).join(' ')}`
                                    : '非 NPX 模式无需配置'}
                            </p>
                        </li>
                        <li>
                            <strong>PATH（环境变量）</strong>
                            <p>仅 NPX 模式且<strong>打包安装后</strong>需要。开发环境（pnpm dev）跳过此项。如果双击 App 打开后测试连接报错 <code>Connection closed</code> 或 <code>command not found</code>，说明系统找不到 npx。在终端输入 <code>which npx</code> 查看路径，填入即可。多个路径用冒号 <code>:</code> 隔开。</p>
                            <p style={{ color: '#1677ff' }}>{openDsc.config?.env?.PATH || '未配置'}</p>
                        </li>
                        <li>
                            <strong>简介</strong>
                            <p>用一两句话告诉 AI 这个 MCP 服务能做什么。写得好 AI 才知道什么时候该用它。</p>
                            <p style={{ color: '#1677ff' }}>{openDsc.description || '未配置'}</p>
                        </li>
                        <li>
                            <strong>启用</strong>
                            <p>开关控制这个 MCP 是否生效。关闭后 AI 看不到它的工具。</p>
                            <p><Tag color={openDsc.isEnabled ? 'cyan' : ''} variant='solid'>{openDsc.isEnabled ? '已启用' : '未启用'}</Tag></p>
                        </li>
                        <li>
                            <strong>工具列表</strong>
                            <p>测试连接成功后自动发现的工具列表。每个工具对应一个 AI 可调用的能力。</p>
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
