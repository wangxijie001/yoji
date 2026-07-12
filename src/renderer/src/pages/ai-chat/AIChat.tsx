import styles from "./AIChat.module.css";
import { Button, message, Modal } from "antd";
import { useEffect, useRef, useState, } from "react";
import { useOutletContext } from "react-router-dom";
import FormatChat from "../../components/format-chat/index";
import TextArea from "antd/es/input/TextArea";
import agentApi from "../../api/agent";
import ttsApi from "../../api/tts";
import { ChatMessage, MessageHistoryQuery } from "@shared/types";
import InfiniteScroll from 'react-infinite-scroller'
import dayjs from 'dayjs'
import proactiveChat from "./proactive-chat";
import { HomeContextType } from "../home/Home";
import { useVoiceDialogue } from './voice-dialogue'
import browserWindowApi from "@renderer/api/browser-window";
import { envConfig } from "@renderer/api/config";



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
    humanMessage?: string;
    interruptType?: ChatMessage['interruptDecision'];
    interruptMessage?: string;
    assistantMessage?: string;// 系统提示ai助手的消息
}

const AiChat = () => {
    const { miniWindow } = useOutletContext<HomeContextType>()
    const [inputMessage, setInputMessage] = useState("");
    const [messageList, setMessageList] = useState<MessageItem[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const curExecLogScrollRef = useRef<HTMLDivElement>(null);
    const streamRef = useRef({ message: "", illation: '', isFinish: true }); //缓存当前回复消息
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const unreadNotificationsRef = useRef<{ timer: ReturnType<typeof setTimeout> | null, message: string[] }>({ timer: null, message: [] })//异步任务执行通知延时器
    const currentAiIdRef = useRef<string>(''); // 当前正在流式输出的 AI 消息 ID
    const [hasMoreHistory, setHasMoreHistory] = useState(true)
    const [ttsEnabled, setTtsEnabled] = useState(false)
    const [isProactiveChatEnabled, setIsProactiveChatEnabled] = useState(false)
    const [isDeepThinkEnabled, setIsDeepThinkEnabled] = useState(false)
    const [interruptInfo, setInterruptInfo] = useState<{ open: boolean, info?: string; message?: string }>({ open: false })

    const [isRunningChat, setIsRunningChat] = useState<boolean>(false)

    // 语音交互
    const {
        isListening: isListeningVoice,
        recordingVoice: isRecordingVoice,
        startListening,
        stopListening,
        isSupported,
    } = useVoiceDialogue({
        onWake: () => { },
        onMessage: (text) => {
            setInputMessage(text)
        },
        onMessageFinal: (text) => {
            sendMessage({ humanMessage: text })
        },
    })



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
        // 初始化深度思考状态
        changeDeepThinkEnabled()

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

    const changeOpenCurExecLog = () => {
        browserWindowApi.open('/task-monitor')
    }


    // 加载更多消息
    const loadMore = () => {
        const oldestId = messageList[0]?.id
        queryChatHistory({
            beforeId: oldestId ? Number(oldestId) : undefined,
            limit: 30
        })
    }


    const sendMessage = async ({ event, humanMessage, interruptType, interruptMessage, assistantMessage }: SendMessageEvent) => {

        const userMsg = inputMessage || humanMessage || interruptMessage || assistantMessage || '';
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
        streamRef.current = { message: "", illation: '', isFinish: false };

        // 定时器：从 streamRef 读取增量并渲染
        timerRef.current = setInterval(() => {
            const { message, illation, isFinish } = streamRef.current;
            if (isFinish) {
                clearInterval(timerRef.current);
            }
            setMessageList((prev) =>
                prev.map((item) =>
                    item.id === aiId
                        ? { ...item, content: message, illation:isDeepThinkEnabled ? illation :  '', loading: !isFinish }
                        : item,
                ),
            );

            setIsRunningChat(!isFinish)

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
                    } else if(type === 'think') {
                        streamRef.current.illation += content;
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

    //切换语音交互状态
    const changeVoiceDialogueEnabled = () => {
        if (isListeningVoice) {
            stopListening()
            return
        }
        message.success('语音对话已开启,说出 “小优” 即可唤醒')
        startListening()
    }

    //切换深度思考状态 不传参数时根据配置文件获取当前状态
    const changeDeepThinkEnabled = async (enabled?: boolean) => {
        if(enabled === undefined) {
            const _enabled = (await envConfig.get<boolean>('isDeepThinkEnabled')) || false
            setIsDeepThinkEnabled(_enabled)
            return
        }

        setIsDeepThinkEnabled(enabled)

        if (enabled) {
           envConfig.set('isDeepThinkEnabled', true)
           message.success('深度思考已开启')
        } else {
            envConfig.set('isDeepThinkEnabled', false)
            message.success('深度思考已关闭')
        }
        // 更新agent版本,触发重新加载agent
        agentApi.updateVersion()
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
                                    <div className={styles.messageBubble}><FormatChat fontSize={`${miniWindow.chatFontSize || 14}px`} message={item.content} /></div>
                                ) : (
                                    <FormatChat 
                                        message={item.content} 
                                        fontSize={miniWindow.chatFontSize ? miniWindow.chatFontSize + 'px' : '14px'} 
                                        illationFontSize={miniWindow.chatFontSize ? miniWindow.chatFontSize - 2 + 'px' : '12px'}
                                        illation={item.illation} />
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
                            style={{ color: isProactiveChatEnabled ? 'var(--default-link-text-color)' : '' }}
                            onClick={() => changeProactiveChatEnabled(!isProactiveChatEnabled)}
                            title={isProactiveChatEnabled ? '主动聊天已开启' : '主动聊天已停止'}
                        />
                        <i
                            className="iconfont icon-cocos-a-shujujianguan1"
                            // style={{ color: isShowCurExecLogDrawer ? 'var(--default-link-text-color)' : '' }}
                            onClick={() => changeOpenCurExecLog()}
                            title={'当前运行状态'}
                        />
                        <i
                            className="iconfont icon-cocos-yuyin"
                            style={{ color: ttsEnabled ? 'var(--default-link-text-color)' : '' }}
                            onClick={() => ttsApi.toggle().then(setTtsEnabled)}
                            title={ttsEnabled ? '语音播报已开启' : '语音播报已关闭'}
                        />
                        {isSupported && (
                            <i
                                className={`iconfont icon-cocos-maikefeng`}
                                style={{ color: isListeningVoice ? 'var(--default-link-text-color)' : '' }}
                                onClick={() => changeVoiceDialogueEnabled()}
                                title={isListeningVoice ? '语音对话已开启(说出 ‘小优’ 即可唤醒)' : '语音对话已关闭'}
                            />
                        )}
                        <i
                            className="iconfont icon-cocos-shendusikao"
                            style={{ color: isDeepThinkEnabled ? 'var(--default-link-text-color)' : '' }}
                            onClick={() => changeDeepThinkEnabled(!isDeepThinkEnabled)}
                            title={isDeepThinkEnabled ? '深度思考已开启' : '深度思考已关闭'}
                        />

                    </div>
                    {inputMessage && !isRunningChat && (
                        <Button
                            type="primary"
                            onClick={() => sendMessage({})}
                            icon={<i className="iconfont icon-cocos-arrowTop-fill" style={{ fontSize: 20 }} />}
                        />
                    )}
                    {isRunningChat && (
                        <Button
                            type="primary"
                            onClick={() => { agentApi.stop() }}
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
            {isRecordingVoice && <div className={styles.recordingVoice}>
                <i className={`iconfont icon-cocos-maikefeng`} />
            </div>}
        </main>
    );
};
export default AiChat;
