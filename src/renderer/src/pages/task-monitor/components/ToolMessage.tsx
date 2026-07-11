import { memo, useState, type ReactNode } from 'react'
import styles from './Message.module.css'
import FormatChat from '@renderer/components/format-chat'
import { Tooltip, TooltipProps } from 'antd'
import { Image } from 'antd'

// 定义文本部分
type ContentTextPart = {
  type: "text";
  text: string;
};

// 定义图片部分（根据你的截图，image_url 里只有一个 url 或类似对象）
type ContentImagePart = {
  type: "image_url";
  image_url: {
    url: string;          // 图片的 Base64 或 在线链接
    detail?: "low" | "high" | "auto"; // OpenAI 可选参数，可省略
  };
};

// 最终的 Content 类型：由文本和图片组成的数组
type Content = string | Array<ContentTextPart | ContentImagePart>;
const ToolMessage = (props: { id: string; name: string; params: string; content: Content }) => {
    const [isLarge, setIsLarge] = useState(false)

    const tooltipStyles: TooltipProps['styles'] = {
        container: {
            fontSize: 10
        }
    }

    const buildMessage = (content: Content): ReactNode => {
        if (!Array.isArray(content)) {
            return <FormatChat fontSize={'10px'} message={content} />
        }

        return content.map((item, index) => {
            switch (item.type) {
                case 'text':
                    return <FormatChat key={index} fontSize={'10px'} message={item.text} />
                case 'image_url':
                    return <Image key={index} alt="basic" src={item.image_url.url} referrerPolicy="no-referrer" />
                default:
                    return <span key={index}>{JSON.stringify(item)}</span>
            }
        })
    }
    return (
        <main className={`${styles.toolMessage} ${isLarge ? styles.largeWapper : ''}`}>
            <div>
                <span>
                    <Tooltip styles={tooltipStyles} title={props.name || ''} placement="bottom">
                        {props.name || ''}
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
            <div>
                <Tooltip styles={tooltipStyles} title={props.params || ''} placement="bottom">
                    参数：{props.params || ''}
                </Tooltip>
            </div>
            <div className={'thin-scrollbar'}>
                {buildMessage(props.content)} 
            </div>
        </main>
    )
}
export default memo(ToolMessage)
