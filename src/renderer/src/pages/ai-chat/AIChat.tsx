import styles from "./AIChat.module.css";
import { Button, Drawer, message, Modal, Spin } from "antd";
import { useEffect, useRef, useState } from "react";
import FormatChat from "../../components/format-chat/index";
import TextArea from "antd/es/input/TextArea";
import agentApi from "../../api/agent";
import ttsApi from "../../api/tts";
import { ChatMessage, MessageHistoryQuery } from "@shared/types";
import InfiniteScroll from 'react-infinite-scroller'
import dayjs from 'dayjs'
import proactiveChat from "./proactive-chat";



type MessageItem = {
    id: string;
    content: string;
    role: "user" | "ai";
    illation?: string
    loading?: boolean;
    created_at?: number

};
type SendMessageEvent = {
    event?: React.KeyboardEvent<HTMLTextAreaElement>;
    interruptType?: ChatMessage['interruptDecision'];
    interruptMessage?: string;
    assistantMessage?: string;// 系统提示ai助手的消息
}

type TaskResult = {
    taskId: string
    description: string
    result: string
}

const AiChat = () => {
    const [inputMessage, setInputMessage] = useState("");
    const [messageList, setMessageList] = useState<MessageItem[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const curExecLogScrollRef = useRef<HTMLDivElement>(null);
    const streamRef = useRef({ message: "", illation: '', isFinish: true }); //缓存当前回复消息
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const unreadNotificationsRef = useRef<{ timer: ReturnType<typeof setTimeout> | null, message: string[] }>({ timer: null, message: [] })
    const currentAiIdRef = useRef<string>(''); // 当前正在流式输出的 AI 消息 ID
    const [hasMoreHistory, setHasMoreHistory] = useState(true)
    const [ttsEnabled, setTtsEnabled] = useState(true)
    const [isProactiveChatEnabled, setIsProactiveChatEnabled] = useState(false)
    const [interruptInfo, setInterruptInfo] = useState<{ open: boolean, info?: string; message?: string }>({ open: false })
    const [isShowCurExecLogDrawer, setIsShowCurExecLogDrawer] = useState<boolean>(false)
    const [curExecLog, setCurExecLog] = useState<{ isLoading: boolean, log: string }>({ isLoading: false, log: '' })


    useEffect(() => {
        queryChatHistory().finally(() => {
            scrollToBottom();
        });

        // 初始化 TTS 状态 + 监听变化
        ttsApi.getEnabled().then(setTtsEnabled)
        const unsubTts = ttsApi.onEnabledChanged(setTtsEnabled)

        // 监听 Agent 核心重建
        const unsubRebuild = window.api.agent.onRebuilding(({ status }) => {
            if (status === 'start') {
                message.loading({ content: 'AI 核心启动中...', key: 'agent-rebuild', duration: 12 })
            } else {
                message.destroy('agent-rebuild')
                message.success({ content: 'AI 核心已就绪', duration: 2 })
            }
        })

        //监听异步后台任务完成通知
        const unsubBackgroundTaskCompleted = window.api.agent.onBackgroundTaskCompleted(({ result }) => {
            onProactiveNotice(result)
        })
 
        // 启动主动聊天定时器,并获取当前系统是否允许主动聊天
        proactiveChat.initProactiveConfig(sendMessage, setIsProactiveChatEnabled)

        return () => {
            unsubTts();
            unsubRebuild();
            unsubBackgroundTaskCompleted();
            proactiveChat.stopTimer()
        }
    }, []);

    const scrollToBottom = () => {
        scrollRef.current && scrollRef.current?.scrollIntoView({
            behavior: "instant",
            block: "end",
        });
        curExecLogScrollRef.current && curExecLogScrollRef.current?.scrollIntoView({
            behavior: "instant",
            block: "end",
        });


    };

    const queryChatHistory = async (query?: MessageHistoryQuery) => {
        await agentApi.historyQuery(query || { limit: 30 }).then((res) => {
            const data = res || [];
            if (data.length > 0) {
                const _messageList = data.map((item) => ({
                    id: String(item.id),
                    content: item.content,
                    role: item.role === "assistant" ? "ai" : ("user" as "user" | "ai"),
                    created_at: item.created_at,
                }));
                setMessageList([..._messageList, ...messageList]);
            } else {
                if (data.length === 0) {
                    setHasMoreHistory(false)
                }
            }
        });
    };

    const openCurExecLog = () => {
        const { isFinish, illation } = streamRef.current
        setIsShowCurExecLogDrawer(!isShowCurExecLogDrawer)
        setCurExecLog({ isLoading: !isFinish, log: illation })
    }

    // 加载更多消息
    const loadMore = () => {
        const oldestId = messageList[0]?.id
        queryChatHistory({
            beforeId: oldestId ? Number(oldestId) : undefined,
            limit: 30
        })
    }


    const sendMessage = async ({ event, interruptType, interruptMessage, assistantMessage }: SendMessageEvent) => {

        const userMsg = inputMessage || interruptMessage || assistantMessage || '';
        if (event?.shiftKey || !userMsg) return;

        if (!streamRef.current.isFinish) {
            message.warning('我还在处理任务呢，等一会吧')
            return
        }
        setInputMessage("");

        const userMessage: MessageItem = {
            id: Date.now() + "user",
            content: userMsg,
            role: "user",
        };

        const aiId = Date.now() + "ai";
        currentAiIdRef.current = aiId;

        const aiMessage: MessageItem = {
            id: aiId,
            content: "",
            role: "ai",
            loading: true,
        };

        // 清除之前的定时器
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        streamRef.current = { message: "", illation: `对话时间：${new Date().toLocaleString()}\n\n`, isFinish: false };

        // 定时器：从 streamRef 读取增量并渲染
        timerRef.current = setInterval(() => {
            const { message, illation, isFinish } = streamRef.current;
            if (isFinish) {
                clearInterval(timerRef.current);
            }
            setMessageList((prev) =>
                prev.map((item) =>
                    item.id === aiId
                        ? { ...item, content: message, illation: '', loading: !isFinish }
                        : item,
                ),
            );
            setCurExecLog({ isLoading: !isFinish, log: illation })

            scrollToBottom()
        }, 200);

        let chatMessageList: ChatMessage[] = []

        if (assistantMessage) {
            setMessageList((prev) => [...prev, aiMessage]);
            chatMessageList = [{ role: "assistant", content: userMsg }]
        } else {
            setMessageList((prev) => [...prev, userMessage, aiMessage]);
            chatMessageList = [{ role: "user", interruptDecision: interruptType, content: userMsg }]
        }

        scrollToBottom()
        // setMessageList((prev) => [...prev, aiMessage]);
        // 流式请求：只负责往 streamRef 喂数据
        agentApi.chatStream(
            chatMessageList,
            {
                onChunk: (_content) => {
                    const { type, content } = _content;
                    if (type === 'result') {
                        streamRef.current.message += content;
                    } else if (type === 'requires_approval') {
                        setInterruptInfo({ open: true, info: content, message: '' })
                    } else {
                        streamRef.current.illation = streamRef.current.illation + content;
                    }
                },
                onDone: () => {
                    streamRef.current.isFinish = true;
                },
                onError: (_error) => {
                    streamRef.current.isFinish = true;
                },
            },
        );
        // 重置主动聊天定时器
        if (!assistantMessage) {
            proactiveChat.resetTimer()
        }
    };

    const onMessageInput = (str: string) => {
        if (!inputMessage && !str.trim()) return;
        setInputMessage(str);
    };

    const onUserApproval = (type: ChatMessage['interruptDecision']) => {
        if (!type) return
        const _messageStart = {
            approve: '同意',
            reject: '拒绝',
            edit: ''
        }
        setInterruptInfo({ open: false, info: '', message: '' })
        sendMessage({ interruptType: type, interruptMessage: `【${_messageStart[type]}】${interruptInfo.message}` })
    }
    //切换ai主动聊天状态
    const changeProactiveChatEnabled = (enabled: boolean) => {
        setIsProactiveChatEnabled(enabled)
        if (enabled) {
            proactiveChat.resetTimer(true)
        } else {
            proactiveChat.stopTimer(true)
        }
    }

    //主进程需要ai助手处理的消息
    const onProactiveNotice = (taskResult: string) => {
        unreadNotificationsRef.current.message.push(taskResult)
        if (unreadNotificationsRef.current.timer) {
            clearTimeout(unreadNotificationsRef.current.timer)
            unreadNotificationsRef.current.timer = null
        }

        unreadNotificationsRef.current.timer = setTimeout(() => {
            if (streamRef.current.isFinish) {
                const aiMessage = `我是你的异步任务代理助手：当前收到了异步任务执行完成的消息，
                消息列表：${JSON.stringify(unreadNotificationsRef.current.message)},
                请使用 “get_async_task_result” 工具获取任务结果
                `
                sendMessage({ assistantMessage: aiMessage })
                if (unreadNotificationsRef.current.timer) {
                    clearTimeout(unreadNotificationsRef.current.timer)
                    unreadNotificationsRef.current.timer = null
                }
            }
        }, 1000)
    }

    // 判断是否展示时间分隔。最新消息与当前时间比较，其余消息与下一条比较，间隔 >10 分钟才展示
    const showTime = (createdAt?: number, PrevCreatedAt?: number): string | null => {
        if (!createdAt) return null
        const gap = PrevCreatedAt !== undefined
            ? createdAt - PrevCreatedAt       // 非最新消息：与下一条的间隔
            : Date.now() - createdAt            // 最新消息：与当前时间的间隔
        if (gap <= 10 * 60 * 1000) return null
        const d = dayjs(createdAt)
        const now = dayjs()

        if (d.isSame(now, 'day')) return d.format('HH:mm')
        if (d.isSame(now.subtract(1, 'day'), 'day')) return '昨天 ' + d.format('HH:mm')
        if (d.isSame(now, 'year')) return d.format('MM月DD日 HH:mm')
        return d.format('YYYY年MM月DD日 HH:mm')
    }



    return (
        <main className={styles.wapper}>
            <div className={styles.content}>
                <InfiniteScroll
                    isReverse        // 聊天模式：滚到顶部 = 加载更早
                    loadMore={loadMore}
                    hasMore={hasMoreHistory}
                    useWindow={false}
                    threshold={100}
                    loader={<div key="loader">加载中...</div>}
                >
                    {messageList.map((item, index) => (
                        <div key={item.id}>
                            <div className={styles.timeShow}>{showTime(item.created_at, messageList[index - 1]?.created_at)}</div>
                            <div
                                className={item.role === "user" ? styles.userMessage : styles.aiMessage}
                            >
                                {item.role === "user" ? (
                                    <div className={styles.messageBubble}><FormatChat message={item.content} /></div>
                                ) : (
                                    <FormatChat message={item.content} illation={item.illation} />
                                )}
                                {(item.loading && (index === messageList.length - 1)) && (
                                    <span className={styles.dotWapper}>
                                        <span className={styles.dot} />
                                        <span className={styles.dot} />
                                        <span className={styles.dot} />
                                    </span>
                                )}

                            </div>
                        </div>
                    ))}
                </InfiniteScroll>
                <div ref={scrollRef} />
            </div>
            <div className={styles.footer}>
                <div className={styles.input}>
                    <TextArea
                        value={inputMessage}
                        onChange={(e: any) => onMessageInput(e.target.value)}
                        placeholder="发消息..."
                        autoSize
                        onPressEnter={(e) => sendMessage({ event: e })}
                    />
                </div>
                <div className={styles.operate}>
                    <div>
                        <i
                            className="iconfont icon-cocos-ailiaotian"
                            style={{ fontSize: 22, color: isProactiveChatEnabled ? 'var(--default-link-text-color)' : '#999', cursor: 'pointer' }}
                            onClick={() => changeProactiveChatEnabled(!isProactiveChatEnabled)}
                            title={isProactiveChatEnabled ? '主动聊天已开启' : '主动聊天已停止'}
                        />
                        <i
                            className="iconfont icon-cocos-a-shujujianguan1"
                            style={{ fontSize: 20, color: isShowCurExecLogDrawer ? 'var(--default-link-text-color)' : '#999', cursor: 'pointer' }}
                            onClick={() => openCurExecLog()}
                            title={'当前运行状态'}
                        />
                        <i
                            className="iconfont icon-cocos-yuyin"
                            style={{ fontSize: 20, color: ttsEnabled ? 'var(--default-link-text-color)' : '#999', cursor: 'pointer' }}
                            onClick={() => ttsApi.toggle().then(setTtsEnabled)}
                            title={ttsEnabled ? '语音播报已开启' : '语音播报已关闭'}
                        />
                    </div>
                    {inputMessage && !curExecLog.isLoading && (
                        <Button
                            type="primary"
                            onClick={() => sendMessage({})}
                            icon={<i className="iconfont icon-cocos-arrowTop-fill" style={{ fontSize: 20 }} />}
                        />
                    )}
                    {curExecLog.isLoading && (
                        <Button
                            type="primary"
                            onClick={() => agentApi.stop()}
                            icon={<i className="iconfont icon-cocos-zhongzhi" style={{ fontSize: 20 }} />}
                        />
                    )}
                </div>
            </div>
            <Modal
                open={interruptInfo.open}
                width={360}
                footer={null}
                closable={false}
            >
                <div className={styles.userApprovalModalContent}>
                    <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontSize: 12 }}>{interruptInfo.info}</pre>
                    <p>请确认是否执行此操作</p>
                    <TextArea
                        value={interruptInfo.message}
                        onChange={(e: any) => setInterruptInfo({ ...interruptInfo, message: e.target.value })}
                        placeholder="执行建议"
                    />
                    <div className={styles.buttonWapper}>
                        <Button color="primary" onClick={() => onUserApproval('approve')}>同意</Button>
                        <Button onClick={() => onUserApproval('reject')}>拒绝</Button>
                    </div>
                </div>
            </Modal>
            <Drawer
                size='50%'
                placement='right'
                onClose={() => setIsShowCurExecLogDrawer(false)}
                open={isShowCurExecLogDrawer}
                title={'执行日志'}
                mask={false}
                style={{ background: 'var(--default-drawer-bg)' }}
                styles={{ header: { padding: ' 8px 16px', border: 'none' }, body: { padding: ' 0 10px 0 20px' } }}

            >
                <div className={`${styles.paramsDsc} thin-scrollbar`}>
                    <div>
                        <FormatChat message={curExecLog.log} fontSize="12px" />
                        {curExecLog.isLoading && (
                            <Spin />
                        )}
                    </div>
                    <div ref={curExecLogScrollRef} />
                </div>

            </Drawer>
        </main>
    );
};
export default AiChat;
