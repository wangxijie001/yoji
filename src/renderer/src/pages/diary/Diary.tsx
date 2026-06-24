import { useEffect, useState } from 'react'
import styles from './Diary.module.css'
import fileApi from '@renderer/api/file'
import FormatChat from '@renderer/components/format-chat'

const Diary = () => {
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    fileApi.readAgentsMd().then((md) => {
      setContent(md || '暂无内容。')
    })
  }, [])


  return (
    <main className={styles.wapper}>
      <div className={styles.content}>
        <FormatChat message={content} />
      </div>
    </main>
  )
}
export default Diary
