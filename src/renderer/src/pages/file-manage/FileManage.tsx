import { Button, Modal } from 'antd'
import styles from './FileManage.module.css'
import fileApi from '@renderer/api/file'
import { useState } from 'react'


const { confirm } = Modal;

const ParamShow = () => {
    const [exportLoading, setExportLoading] = useState(false)
    const [importLoading, setImportLoading] = useState(false)

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
                <div><Button type="primary" ghost loading={exportLoading} onClick={handleExport}>导出记忆体</Button></div>
                <div><Button type="primary" loading={importLoading} onClick={handleImport}>导入记忆体</Button></div>
            </div>
        </main>
    )
}
export default ParamShow
