/**
 * FilePreview — 文件预览组件
 *
 * Electron 环境下 fetch(blobUrl) 会报 ERR_FILE_NOT_FOUND，
 * 所以通过 additionalContext 把 Blob 传给渲染器，渲染器用 Blob.text() 读内容。
 */




import styles from './index.module.css'

export interface FilePreviewProps {
  file: File
  fileName: string
  mimeType?: string
}


const FilePreview = ({ file, fileName, mimeType }: FilePreviewProps) => {
  // const mt = mimeType || 'application/octet-stream'
  // const blob = useMemo(() => toBlob(src, mt), [src, mt])
  console.log(file,fileName,mimeType)
  return (
    <div className={styles.container}>

    </div>
  )
}

export default FilePreview
