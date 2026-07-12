import { useState, useEffect, useRef } from 'react'
import styles from './TaskMonitor.module.css'
import { Tooltip, TooltipProps } from 'antd'
import agentApi from "../../api/agent";
import { TaskRunningInfo } from '@shared/types';
import MainMessage from './components/mainMessage';
import dayjs from 'dayjs';
import ToolMessage from './components/toolMessage';


const taskStatus = {
    waiting: {
        color: '#ffa940',
        label: '等待中',
    },
    running: {
        color: '#52c41a',
        label: '运行中',
    },
    completed: {
        color: '#9254de',
        label: '完成',
    },
    stopped: {
        color: '#8c8c8c',
        label: '终止',
    },
    failed: {
        color: '#f5222d',
        label: '失败',
    }
}
const TaskMonitor = () => {
    const [taskList, setTaskList] = useState<{ taskId: string; status: string; }[]>([])
    const [taskDetail, setTaskDetail] = useState<Partial<TaskRunningInfo & { agentName: string, agentDesc: string }>>({})
    const [activeTaskId, setActiveTaskId] = useState<string>('')
    const cacheInfo = useRef<{ list: { taskId: string; status: string; }[], activeTaskId: string }>({ list: [], activeTaskId: '' })
    const timerRef = useRef<{
        list: ReturnType<typeof setInterval> | undefined,
        listFinished: boolean,
        content: ReturnType<typeof setInterval> | undefined,
        contentFinished: boolean,
    }>({ list: undefined, listFinished: true, content: undefined, contentFinished: true })

    const tooltipStyles: TooltipProps['styles'] = {
        container: {
            fontSize: 10,
        },
    }

    useEffect(() => {
        queryAsyncTaskQueue()
        return () => {
            if (timerRef.current.list) clearInterval(timerRef.current.list)
            if (timerRef.current.content) clearInterval(timerRef.current.content)
        }

    }, [])

    const queryAsyncTaskQueue = () => {

        const queryTaskQueue = () => {
            //上个查询未完成，不重复查询
            if (!timerRef.current.listFinished) return
            timerRef.current.listFinished = false
            const _cacheList = cacheInfo.current.list || []
            agentApi.queryTaskQueue().then((res: any) => {
                if (!res || res.length === 0) return
                if (!cacheInfo.current.activeTaskId) {
                    handleTaskClick(res[0].taskId)
                }
                res.forEach(item => {
                    const { taskId, status } = item || {}
                    const _index = _cacheList.findIndex(task => task.taskId === taskId)
                    if (_index === -1) {
                        setTaskList([..._cacheList, { taskId, status }])
                        cacheInfo.current.list = [..._cacheList, { taskId, status }]
                        return
                    }

                    if (_cacheList[_index].status === status) return

                    _cacheList[_index].status = status
                    setTaskList([..._cacheList])
                    cacheInfo.current.list = _cacheList
                })
            }).finally(() => {
                timerRef.current.listFinished = true
            })
        }
        if (timerRef.current.list) clearInterval(timerRef.current.list)
        queryTaskQueue()
        timerRef.current.list = setInterval(queryTaskQueue, 2000)

    }

    const queryTaskDetail = (taskId: string) => {
        const queryTaskDetail = (taskId: string) => {
            //上个查询未完成，不重复查询
            if (!timerRef.current.contentFinished) return
            timerRef.current.contentFinished = false

            agentApi.queryTaskQueue(taskId).then((res: any) => {
                const _detail = res || {}
                setTaskDetail(_detail)
                if (_detail.status === 'completed' || _detail.status === 'stopped' || _detail.status === 'failed') {
                    clearInterval(timerRef.current.content)
                }
            }).finally(() => {
                timerRef.current.contentFinished = true
            })
        }
        if (timerRef.current.content) clearInterval(timerRef.current.content)
        queryTaskDetail(taskId)
        timerRef.current.content = setInterval(() => queryTaskDetail(taskId), 1000)
    }

    const handleTaskClick = (taskId: string) => {
        cacheInfo.current.activeTaskId = taskId
        setActiveTaskId(taskId)
        setTaskDetail({})
        queryTaskDetail(taskId)
    }

    //取消异步任务
    const cancelAsyncTask = (taskId: string) => {
        const _taskId = taskId.split('async:')[1]
        agentApi.cancelTask(_taskId)
    }


    return (
        <main className={styles.wapper} >
            <div className={styles.dragArea}></div>
            <div className={styles.content}>
                <div className={styles.left}>
                    <div>任务列表</div>
                    <div className={'thin-scrollbar'}>
                        {taskList.map(item => (
                            <div
                                key={item.taskId} className={styles.taskItem}
                                style={{ background: item.taskId === activeTaskId ? 'rgba(146, 84, 222, 0.3)' : '' }}
                                onClick={() => handleTaskClick(item.taskId)}
                            >
                                <div><Tooltip styles={tooltipStyles} title={item.taskId} color='purple' trigger='hover'>{item.taskId}</Tooltip></div>
                                <div>
                                    <span style={{ color: taskStatus[item.status].color }}>• {taskStatus[item.status].label}</span>
                                    {item.taskId.startsWith('async:') && 
                                     (item.status === 'waiting' || item.status === 'running') &&
                                       <i 
                                        className='iconfont icon-cocos-zhongzhi' 
                                        title='中止任务'
                                        onClick={() => cancelAsyncTask(item.taskId)}
                                        />
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className={styles.right}>
                    <div className={styles.taskDetail}>
                        <h2>执行信息</h2>
                        <div className={styles.windowMain}>
                            <MainMessage
                                agentName={taskDetail.agentName || ''}
                                agentDesc={taskDetail.agentDesc || ''}
                                thinkMessage={taskDetail.thinkMessage || ''}
                                message={taskDetail.mainMessage || ''} />
                        </div>
                        <div className={styles.taskInfo}>
                            <div>
                                <span className={styles.taskInfoItemLabel}>创建时间: </span>
                                <span>{dayjs(taskDetail.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                            </div>
                            <div style={{ margin: '2px 0' }}>
                                <span className={styles.taskInfoItemLabel}>结束时间: </span>
                                <span>{taskDetail.endTime ? dayjs(taskDetail.endTime).format('YYYY-MM-DD HH:mm:ss') : '...'}</span>
                            </div>
                            <div><span className={styles.taskInfoItemLabel}>任务描述:</span></div>
                            <div style={{ color: '#69b1ff', marginTop: '2px' }}><span>{taskDetail.params || ''}</span></div>
                        </div>
                    </div>
                    <div
                        className={`${styles.taskRuningInfo} thin-scrollbar`}

                    >
                        <h2>工具调用</h2>
                        <div style={{ border: taskDetail.toolsMessage && taskDetail.toolsMessage.length > 0 ? 'none' : '' }}>
                            {
                                taskDetail.toolsMessage && taskDetail.toolsMessage.map(item => (
                                    <div key={item.id}>
                                        <ToolMessage {...item} />
                                    </div>
                                ))
                            }
                        </div>


                    </div>
                </div>
            </div>

        </main>
    )
}
export default TaskMonitor
