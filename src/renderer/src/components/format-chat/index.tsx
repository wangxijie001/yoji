import ReactMarkdown from "react-markdown";
import rehypePrism from "rehype-prism-plus"; //支持代码高亮
import remarkGfm from "remark-gfm"; //支持表格
import "prism-themes/themes/prism-material-oceanic.css";
import { CodeBlock } from "./code";
import { tableBlock } from "./table";
import { memo, useEffect, useRef } from "react";
import { Image } from "antd";

interface ChatMsg {
    message: string;
    illation?: string;
    fontSize?: string;
    illationFontSize?: string;
}

const FormatChat = (props: ChatMsg) => {
    const { message, illation, fontSize, illationFontSize } = props;
    const scrollRef = useRef<HTMLDivElement>(null);

    const buildFontSize = (type:'message' | 'illation') => {
        if(type === 'illation') {
            return illationFontSize || "12px"
        }
        return fontSize || "14px"
    }

    const scrollToBottom = () => {
        scrollRef.current?.scrollIntoView({
            behavior: "instant",
            block: "end",
        });
    };

    useEffect(() => {
        scrollToBottom();
    }, [illation]);



    return (
        <>
            {illation && (
                <div style={{ margin: "10px  12px 30px", fontSize: buildFontSize('illation'), lineHeight: "20px", color: "#666666", overflow: 'auto', maxHeight: '800px' }}>
                    <ReactMarkdown
                        components={{
                            p: ({ children }) => <div style={{ margin: "6px 0", fontSize: buildFontSize('illation'), lineHeight: "20px" }}>{children}</div>,
                            img: ({ src }) => src ? <Image width={160} style={{ borderRadius: 6 }} alt="basic" src={src} referrerPolicy="no-referrer" /> : '【图片地址参数为空】',
                            ul: ({ children }) => <ul style={{ margin: "6px 16px" }}>{children}</ul>,
                            li: ({ children }) => <li style={{ margin: "6px 0", fontSize: buildFontSize('illation'), lineHeight: "20px" }}>{children}</li>,
                            ol: ({ children }) => <ol style={{ margin: "6px 16px", fontSize: buildFontSize('illation') }}>{children}</ol>,
                            pre: ({ children }) => <pre style={{ backgroundColor: 'rgb(242, 242, 242, 0.2)' }}>{children}</pre>,
                            code: ({ children }) => <code style={{ backgroundColor: 'rgb(242, 242, 242, 0.2)', fontSize: buildFontSize('illation'), lineHeight: "16px" }}>{children}</code>,
                            ...tableBlock,
                        }}
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[[rehypePrism, { showLineNumbers: true }]]}>
                        {illation}
                    </ReactMarkdown>
                    <div ref={scrollRef} />
                </div>
            )}
            <div style={{ fontSize: fontSize || "14px"}}>
                <ReactMarkdown
                    components={{
                        p: ({ children }) => <div style={{ margin: "6px 0", fontSize: buildFontSize('message'), lineHeight: "26px" }}>{children}</div>,
                        img: ({ src }) => src ? <Image width={160} style={{ borderRadius: 6, display: 'block' }} alt="basic" src={src} referrerPolicy="no-referrer" /> : '【图片地址参数为空】',
                        ul: ({ children }) => <ul style={{ margin: "6px 18px" }}>{children}</ul>,
                        li: ({ children }) => <li style={{ margin: "6px 0", fontSize: buildFontSize('message'), lineHeight: "26px" }}>{children}</li>,
                        ol: ({ children }) => <ol style={{ margin: "6px 18px", fontSize: buildFontSize('message') }}>{children}</ol>,
                        ...tableBlock,
                        pre: CodeBlock,
                    }}
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[[rehypePrism, { showLineNumbers: true }]]}>
                    {message}
                </ReactMarkdown>
            </div>
        </>
    );
};
export default memo(FormatChat);
