import ReactMarkdown from "react-markdown";
import rehypePrism from "rehype-prism-plus"; //支持代码高亮
import remarkGfm from "remark-gfm"; //支持表格
import "prism-themes/themes/prism-material-oceanic.css";
import { CodeBlock } from "./code";
import { tableBlock } from "./table";
import { useEffect, useRef } from "react";
import { Image } from "antd";

interface ChatMsg {
    message: string;
    illation?: string
}

const FormatChat = (props: ChatMsg) => {
    const { message, illation } = props;
    const scrollRef = useRef<HTMLDivElement>(null);

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
                <div style={{ margin: "10px  12px 30px", fontSize: "12px", lineHeight: "20px", color: "#666666", overflow: 'auto', maxHeight: '800px' }}>
                    <ReactMarkdown
                        components={{
                            p: ({ children }) => <div style={{ margin: "6px 0", fontSize: "12px", lineHeight: "20px"}}>{children}</div>,
                            img: ({ src }) => <Image width={160} style={{ borderRadius: 6 }} alt="basic" src={src} />,
                            ul: ({ children }) => <ul style={{ margin: "6px 16px" }}>{children}</ul>,
                            li: ({ children }) => <li style={{ margin: "6px 0", fontSize: "12px", lineHeight: "20px" }}>{children}</li>,
                            ol: ({ children }) => <ol style={{ margin: "6px 16px", fontSize: "12px" }}>{children}</ol>,
                            pre: ({ children }) => <pre style={{ backgroundColor: 'rgb(242, 242, 242, 0.2)' }}>{children}</pre>,
                            code: ({ children }) => <code style={{ backgroundColor: 'rgb(242, 242, 242, 0.2)', fontSize: "12px", lineHeight: "16px" }}>{children}</code>,
                            ...tableBlock,
                        }}
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[[rehypePrism, { showLineNumbers: true }]]}>
                        {illation}
                    </ReactMarkdown>
                    <div ref={scrollRef} />
                </div>
            )}

            <ReactMarkdown
                components={{
                    p: ({ children }) => <p style={{ margin: "6px 0", fontSize: "15px", lineHeight: "26px" }}>{children}</p>,
                    img: ({ src }) => <div><Image width={160} style={{ borderRadius: 6 }} alt="basic" src={src} /></div>,
                    ul: ({ children }) => <ul style={{ margin: "6px 18px" }}>{children}</ul>,
                    li: ({ children }) => <li style={{ margin: "6px 0", fontSize: "15px", lineHeight: "26px" }}>{children}</li>,
                    ol: ({ children }) => <ol style={{ margin: "6px 18px", fontSize: "15px" }}>{children}</ol>,
                    ...tableBlock,
                    pre: CodeBlock,
                }}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[[rehypePrism, { showLineNumbers: true }]]}>
                {message}
            </ReactMarkdown>

        </>
    );
};
export default FormatChat;
