import styles from './ParamShow.module.css'
import { useEffect, useState } from 'react'
import { StackedLine } from '../../components/index'
import emotionApi from '@renderer/api/emotion'
import dayjs from 'dayjs'
import FormatChat from '@renderer/components/format-chat'
import { Button, Drawer } from 'antd'
import { EmotionState } from '@shared/types'
import { useOutletContext } from 'react-router-dom'
import { HomeContextType } from '../home/Home'


type HormoneKey = 'dopamine' | 'serotonin' | 'gaba' | 'cortisol' | 'adrenaline' | 'oxytocin' | 'endorphin' | 'melatonin'

const HORMONE_KEYS: HormoneKey[] = [
    'dopamine', 'serotonin', 'gaba', 'cortisol',
    'adrenaline', 'oxytocin', 'endorphin', 'melatonin'
]

const CHINESE_LABELS: Record<HormoneKey, [string, string,string]> = {
    dopamine: ['多巴胺', '兴奋/好奇，驱动力来源 | 低：提不起劲 | 高：兴奋得不行','#1677ff'],
    serotonin: ['血清素', '心理满足/安宁，情绪稳定器 | 低：焦虑不安 | 高：幸福知足','#52c41a'],
    gaba: ['GABA', '身体松弛度，缓解紧张 | 低：浑身紧绷 | 高：像泡温泉一样松弛','#262626'],
    cortisol: ['皮质醇', '慢性压力指标，长期应激 | 低：毫无压力 | 高：高度紧张','#ff9900'],
    adrenaline: ['肾上腺素', '急性应激，瞬间爆发力 | 低：心如止水 | 高：心跳加速','#69b1ff'],
    oxytocin: ['催产素', '信任/依恋，亲密关系纽带 | 低：保持距离 | 高：深深依恋','#fadb14'],
    endorphin: ['内啡肽', '愉悦/舒适，天然镇痛剂 | 低：笑不出来 | 高：看什么都顺眼','#f759ab'],
    melatonin: ['褪黑素', '困倦/昼夜节律，睡眠开关 | 低：精神抖擞 | 高：昏昏欲睡','#9254de']
}

const ParamShow = () => {
    const { isEmotionSystemEnabled, changeEmotionSystemEnabled } = useOutletContext<HomeContextType>()
    const [option, setOption] = useState<any>({
        title: { text: '激素水平' },
        series: [],
        xAxis: { type: 'category', boundaryGap: false, data: [] }
    })
    const [emotionLog, setEmotionLog] = useState<EmotionState[]>([])
    const [currentEmotion, setCurrentEmotion] = useState<string>('')
    const [openLog, setOpenLog] = useState<boolean>(false)


    useEffect(() => {
        loadEmotionLog()
    }, [])

    const loadEmotionLog = () => {
        emotionApi.getLog(60).then((res) => {
            if (res.length === 0) return
            setEmotionLog(res)
            setCurrentEmotion(res[0].emotion || '')

            const timeLabels: string[] = []
            const dataMap: Record<HormoneKey, number[]> = { dopamine: [], serotonin: [], gaba: [], cortisol: [], adrenaline: [], oxytocin: [], endorphin: [], melatonin: [] }

            // res 是 id DESC 顺序（最新在前），unshift 反转为时间升序
            res.forEach((item) => {
                timeLabels.unshift(dayjs(item.created_at).format('MM/DD HH:mm:ss'))
                HORMONE_KEYS.forEach((key) => dataMap[key].unshift(item[key]))
            })

            setOption({
                ...option,
                xAxis: { type: 'category', boundaryGap: false, data: timeLabels },
                series: HORMONE_KEYS.map((key) => ({
                    name: CHINESE_LABELS[key][0],
                    description: CHINESE_LABELS[key][1],
                    type: 'line',
                    data: dataMap[key],
                    smooth: true
                }))
            })
        })
    }
    


    return (
        <main className={styles.wapper}>
            <div className={styles.chartWapper}>
                <Button type='primary' ghost onClick={changeEmotionSystemEnabled}>{isEmotionSystemEnabled ? '关闭' : '开启'}情绪系统</Button>
                <StackedLine option={option} />
            </div>
            <hr />
            <div className={styles.emotionWapper}>
                <h3>当前情绪</h3>
                
                <Button
                    type='primary'
                    ghost
                    className='iconfont icon-cocos-rizhi1'
                    onClick={() => setOpenLog(true)}
                />
                <div>
                    {isEmotionSystemEnabled ? <FormatChat message={currentEmotion} /> : "状态平稳，毫无波澜，没有特殊情感"}
                </div>
            </div>
            <Drawer
                size='100%'
                placement='bottom'
                onClose={() => setOpenLog(false)}
                closable={false}
                open={openLog}
                getContainer={false}
                destroyOnHidden
                style={{ background: 'var(--default-drawer-bg)'}}
                styles={{ body: { padding: ' 0 20px' } }}

            >
                <div className={styles.emotionLog}>
                    <div><i className='iconfont icon-cocos-xia' onClick={() => setOpenLog(false)} /></div>
                    <ul >
                        {emotionLog.map((item) => (
                            <li key={item.id}>
                                <div>{item.created_at ? dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss') : ''}</div>
                                <div>{item.description.replace('\n\n','\n')}</div>
                                <div className={styles.hormoneLevel}>
                                    {
                                        HORMONE_KEYS.map((key) => (
                                            <span style={{ color: CHINESE_LABELS[key][2] }} key={key}>{CHINESE_LABELS[key][0]}: {item[key]}</span>
                                        ))
                                    }
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

            </Drawer>
        </main>
    )
}
export default ParamShow
