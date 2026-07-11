import { copyText } from '../../utils/tool';
import { useRef, useState } from 'react';

function extractText(children: any): string {
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) {
        return children.map(extractText).join('');
    }
    if (children?.props?.children) {
        return extractText(children.props.children);
    }
    return '';
}

export function CodeBlock({ children, ...props }: any) {
    const [copied, setCopied] = useState(false);
    const timeoutId = useRef<NodeJS.Timeout>(undefined);

    // 正确获取代码文本
    const codeText = extractText(children);

    const handleCopy = async () => {
        if (timeoutId.current) {
            clearTimeout(timeoutId.current);
        }
        copyText(codeText);
        setCopied(true);
        timeoutId.current = setTimeout(() => {
            setCopied(false);
            clearTimeout(timeoutId.current);
        }, 3000);
    };

    return (
        <div style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            margin: '10px 0',
        }}>
            <button
                onClick={handleCopy}
                style={{
                    position: 'absolute',
                    top: '8px',
                    right: '12px',
                    zIndex: 10,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#1e1e1e',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                    cursor: 'pointer',
                }}
            >
                {copied ? '已复制' : '复制'}
            </button>

            <pre {...props} style={{ margin: 0,fontSize: '12px' }}>
                {children}
            </pre>
        </div>
    );
}