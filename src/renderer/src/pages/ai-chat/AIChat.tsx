import styles from "./AIChat.module.css";
import { Button } from "antd";
import { useEffect, useRef, useState } from "react";
import FormatChat from "../../components/format-chat/index";
import TextArea from "antd/es/input/TextArea";
import agentApi from "../../api/agent";
import { MessageHistoryQuery } from "@shared/types";
import InfiniteScroll from 'react-infinite-scroller'
import dayjs from 'dayjs'



type MessageItem = {
    id: string;
    content: string;
    role: "user" | "ai";
    illation?: string
    loading?: boolean;
    created_at?: number

};
const AiChat = () => {
    const [inputMessage, setInputMessage] = useState("");
    const [messageList, setMessageList] = useState<MessageItem[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const streamRef = useRef({ message: "", illation: '', isFinish: false }); //缓存当前回复消息
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const currentAiIdRef = useRef<string>(''); // 当前正在流式输出的 AI 消息 ID
    const [hasMore, setHasMore] = useState(true)


    useEffect(() => {
        queryChatHistory().finally(() => {
            scrollToBottom();
        });

    }, []);

    const scrollToBottom = () => {
        scrollRef.current?.scrollIntoView({
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
                    setHasMore(false)
                }
            }
        });
    };

    // 加载更多消息
    const loadMore = () => {
        const oldestId = messageList[0]?.id
        queryChatHistory({
            beforeId: oldestId ? Number(oldestId) : undefined,
            limit: 30
        })
    }

    // const setAiMessageInfo = (message: string) => {
    //     const aiMessage: MessageItem = {
    //         id: Date.now() + "ai",
    //         content: message,
    //         role: "ai",
    //         loading: false,
    //     };
    //     const timer = setTimeout(() => {
    //         setMessageList((prev) => [...prev, aiMessage]);
    //         clearTimeout(timer);
    //     }, 500);

    // };

    const sendMessage = async (event?: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const userMsg = inputMessage;
        if (event?.shiftKey || !userMsg) return;
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
                        ? { ...item, content: message, illation, loading: !isFinish }
                        : item,
                ),
            );
            scrollToBottom()
        }, 100);

        setMessageList((prev) => [...prev, userMessage, aiMessage]);
        scrollToBottom()
        // setMessageList((prev) => [...prev, aiMessage]);
        // 流式请求：只负责往 streamRef 喂数据
        agentApi.chatStream(
            [{ role: "user", content: userMsg }],
            // [{ role: "system", content: userMsg }],
            {
                onChunk: (_content) => {
                    const { type, content } = _content;
                    if (type === 'result') {
                        streamRef.current.message += content;
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
    };

    const onMessageInput = (str: string) => {
        if (!inputMessage && !str.trim()) return;
        setInputMessage(str);
    };

    // 判断是否展示时间分隔。最新消息与当前时间比较，其余消息与下一条比较，间隔 >10 分钟才展示
    const showTime = (createdAt?: number, PrevCreatedAt?: number): string | null => {
        if (!createdAt) return null
        const gap = PrevCreatedAt !== undefined
            ?  createdAt - PrevCreatedAt       // 非最新消息：与下一条的间隔
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
                    hasMore={hasMore}
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
                        onPressEnter={sendMessage}
                    />
                </div>
                <div className={styles.operate}>
                    <div >
                    </div>
                    {inputMessage && (
                        <Button
                            type="primary"
                            onClick={() => sendMessage()}
                            icon={<i className="iconfont icon-cocos-arrowTop-fill" style={{ fontSize: 20 }} />}
                        />
                    )}
                </div>
            </div>
        </main>
    );
};
export default AiChat;
