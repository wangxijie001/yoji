import { Button, Modal } from 'antd'
import styles from './FileManage.module.css'
import fileApi from '@renderer/api/file'
import { useEffect, useRef, useState } from 'react'
import type { FileEntry } from '@shared/types'
import { CaretRightOutlined, FileTextFilled, FileUnknownFilled, FolderOpenFilled } from '@ant-design/icons'
import { formatTime } from '@renderer/utils/tool'
// import { FilePreview } from '@renderer/components'

const { confirm } = Modal;

const ParamShow = () => {
    const [exportLoading, setExportLoading] = useState(false)
    const [importLoading, setImportLoading] = useState(false)
    const [dirList, setDirList] = useState<{ key: string; active: string; isFile?: boolean; list: FileEntry[] }[]>([])
    const [fileData, setFileData] = useState<({ content: ArrayBuffer; fileName: string; mimeType: string } & FileEntry) | null>(null)
    const dirListRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        loadDirList()
    }, [])


    const scrollToEnd = () => {
        if (dirListRef.current) {
            dirListRef.current.scrollTo({ left: dirListRef.current.scrollWidth, behavior: 'smooth' })
        }
    }

    const loadDirList = async (dirWapperIndex?: number, dirKey?: string) => {
        const res = await fileApi.listDir(dirKey)

        if (!dirKey) {
            setDirList([{ key: '/', active: '', list: res || [] }])
        } else if (dirWapperIndex !== undefined) {
            setDirList([...dirList.slice(0, dirWapperIndex + 1), { key: dirKey, active: '', list: res || [] }])
            // 等 DOM 更新后滚动到最右侧
            setTimeout(() => scrollToEnd(), 0)
        }
    }

    const dirItemClick = (dirWapperIndex: number, fileInfo: FileEntry) => {
        if (dirList[dirWapperIndex].active === fileInfo.name) return

        dirList[dirWapperIndex].active = fileInfo.name
        setDirList([...dirList])
        const { isDirectory, relativePath } = fileInfo

        if (isDirectory) {
            loadDirList(dirWapperIndex, relativePath)
        } else {
            setDirList([...dirList.slice(0, dirWapperIndex + 1), { key: relativePath, isFile: true, active: '', list: [] }])
            setTimeout(() => scrollToEnd(), 0)
            // 读取文件内容用于预览
            fileApi.readFile(fileInfo.fullPath).then((data) => {
                if (data) setFileData({ ...data, ...fileInfo })
            })
        }

    }

    /** 文件名中间省略，类似 Finder：very_long_name.txt → very...name.txt */
    const ellipsisFileStr = (str: string, maxLength: number) => {
        if (str.length <= maxLength) return str
        const lastDot = str.lastIndexOf('.')
        const hasExt = lastDot > 0 && lastDot < str.length - 1
        const name = hasExt ? str.slice(0, lastDot) : str
        const ext = hasExt ? str.slice(lastDot) : ''
        // 剩余可用长度（扣除扩展名和 ... ）
        const available = maxLength - ext.length - 3
        if (available <= 2) return str.slice(0, maxLength - 3) + '...'
        const headLen = Math.ceil(available / 2)
        const tailLen = Math.floor(available / 2)
        return name.slice(0, headLen) + '...' + name.slice(-tailLen) + ext
    }

    const handleExport = async () => {
        setExportLoading(true)
        await fileApi.exportFile('all').finally(() => {
            setExportLoading(false)
        })
    }

    const handleImport = async () => {
        confirm({
            title: '确认导入记忆体?',
            className: 'custom-model-style',
            // icon: <ExclamationCircleFilled />,
            content: '导入记忆体后，当前记忆体将被替换，你的对话伴侣的情绪，性格，行为，记忆等将被覆盖，是否继续?',
            okText: '继续',
            cancelText: '取消',
            onOk: async () => {
                setImportLoading(true)
                await fileApi.importFile('all').finally(() => {
                    setImportLoading(false)
                })
            },
            onCancel() {
                console.log('取消');
            },
        });

    }


    return (
        <main className={styles.wapper}>
            <div className={styles.fileManage}>
                <Button type="primary" loading={importLoading} onClick={() => loadDirList()}>刷新</Button>
                <Button type="primary" loading={importLoading} onClick={handleImport}>导入记忆体</Button>
                <Button type="primary" ghost loading={exportLoading} onClick={handleExport}>导出记忆体</Button>
            </div>
            <hr />
            <div className={`${styles.dirList} thin-scrollbar`} ref={dirListRef}>
                {dirList.map((item, dirWapperIndex) => (
                    (!item.isFile ?
                        <div key={item.key} className={`${styles.dirWapper} thin-scrollbar`}>
                            {
                                item.list && item.list.map((file) => (
                                    <div key={file.name} className={`${styles.dirItem} ${file.name === item.active ? styles.active : ''}`} onClick={() => dirItemClick(dirWapperIndex, file)}>
                                        <span>{file.isDirectory ? <FolderOpenFilled /> : <FileTextFilled />}</span>
                                        <span title={file.name}>{ellipsisFileStr(file.name, 13)}</span>
                                        <span>{file.isDirectory && <CaretRightOutlined />}</span>
                                    </div>
                                ))
                            }
                        </div> :
                        <div key={item.key} className={`${styles.fileWapper} thin-scrollbar`}>
                            <div className={styles.filePreview}>
                                <div className={styles.previewIcon}>
                                    <div ><FileUnknownFilled style={{ fontSize: 50, color: '#6e6e6e' }} /></div>
                                    <div>{fileData?.mimeType}</div>
                                </div>
                            </div>
                            <div className={styles.fileInfo}>
                                <div>{fileData?.fileName}</div>
                                <div>{fileData?.fileName.split('.').pop()} - {fileData?.size} 字节</div>
                                <div className={styles.infoHeader}>
                                    <span>信息</span>
                                    <span><Button title="打开文件所在目录" type='text' className={'iconfont icon-cocos-resource-list'} size="small" onClick={() => fileData?.fullPath && fileApi.showFileInFolder(fileData.fullPath)}></Button></span>
                                </div>
                                <div><span>创建时间</span><span>{formatTime(fileData?.createdAt)}</span></div>
                                <hr />
                                <div><span>修改时间</span><span>{formatTime(fileData?.modifiedAt)}</span></div>
                            </div>
                        </div>)

                ))}
            </div>
        </main>
    )
}
export default ParamShow
