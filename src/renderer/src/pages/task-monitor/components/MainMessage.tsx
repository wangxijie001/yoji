import { memo, useState } from 'react'
import styles from './Message.module.css'
import FormatChat from '@renderer/components/format-chat'
import { Tooltip, TooltipProps } from 'antd'
import AgentGraph from './AgentGraph'

const MainMessage = (props: { 
    message: string; thinkMessage: string, agentName: string; agentDesc: string,
    agentGraph: string, currentNode?: string | null
    }) => {
    const [isLarge, setIsLarge] = useState(false)
    const [infoType, setInfoType] = useState<'output' | 'think' | 'graph'>('output')
    const tooltipStyles: TooltipProps['styles'] = {
        container: {
            fontSize: 10
        }
    }
    return (
        <main className={`${styles.mainMessage} ${isLarge ? styles.largeWapper : ''}`}>
            <div>
                <span>
                    <Tooltip styles={tooltipStyles} title={props.agentDesc || 'agentDesc'} placement="bottom">
                        {props.agentName || 'agentName'}
                    </Tooltip>
                </span>
                <span>
                    {isLarge ?
                        <i className={'iconfont icon-cocos-suoping'} onClick={() => setIsLarge(false)} />
                        :
                        <i className={'iconfont icon-cocos-quanping'} onClick={() => setIsLarge(true)} />
                    }
                </span>
            </div>
            <div className={styles.mianWindowBtn}>
                <div>
                    <span className={infoType === 'output' ? styles.activeType : ''} onClick={() => setInfoType('output')}>输出</span>
                    <span className={infoType === 'think' ? styles.activeType : ''} onClick={() => setInfoType('think')}>思考</span>
                    <span className={infoType === 'graph' ? styles.activeType : ''} onClick={() => setInfoType('graph')}>状态图</span>
                </div>
            </div>
            <div className={'thin-scrollbar'} style={{ color: infoType === 'output' ? '#d3adf7' : '#69b1ff' }}>
                {infoType === 'graph' ? 
                    <AgentGraph graph={props.agentGraph} currentNode={props.currentNode || null} />
                : 
                    <FormatChat fontSize={'10px'} message={infoType === 'output' ? props.message || '' : props.thinkMessage || ''}  />
                }
            </div>
        </main>
    )
}
export default memo(MainMessage)
