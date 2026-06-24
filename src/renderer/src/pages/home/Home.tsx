import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import styles from './Home.module.css'
import Menu from './components/menu/Menu'
import Image from './components/image/Image'
import { useState, useEffect, useTransition } from 'react'
import emotionApi from '@renderer/api/emotion'

const Home = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [emotionDisplay, setEmotionDisplay] = useState<{ c1: string; c2: string; display: { primary: string; secondary: string } }>({ c1: 'transparent', c2: 'transparent',display:{primary:'',secondary:''} })
  const [, startTransition] = useTransition()
  const emotionColor = new Map<string, string>([
    ['开心', '#fff3b0'],
    ['兴奋', '#ffccc7'],
    ['期待', '#d9f7be'],
    ['安心', '#fcffe6'],
    ['平静', '#e6f4ff'],
    ['好奇', '#e6fffb'],
    ['害羞', '#FFB7C5'],
    ['孤独', '#8A9AAD'],
    ['烦躁', '#B09A8E'],
    ['疲惫', '#9C9DA0'],
    ['失落', '#A8A3A0'],
    ['委屈', '#9B8E8A'],
    ['悲伤', '#4A5B6E'],
    ['愤怒', '#8B3A3A'],
    ['忧虑', '#7A8B99'],
    ['心疼', '#C4958A'],
  ])

  // 根据情绪调节背景颜色
  const changeEmotionDisplay = (display: { primary: string; secondary: string }): void => {
    const c1 = emotionColor.get(display.primary)
    const c2 = emotionColor.get(display.secondary)
    if (!c1) return
    startTransition(() => {
      setEmotionDisplay({ c1, c2: c2 || '#ffffff',display })


    })
  }

  //初次启动获取情绪并更新背景颜色
  const changeBackgroundByEmotion = async () => {
    await emotionApi.getLog(1).then((res) => {
      if (res.length <= 0) return
      if (res[0].display) {
        try {
          const emotionDisplay: any = JSON.parse(res[0].display)
          changeEmotionDisplay(emotionDisplay)
        }
        catch (err) {
          console.log(err)
        }
      }

    })
  }


  useEffect(() => {
    changeBackgroundByEmotion()
    const unsubscribe = emotionApi.onUpdated((emotion) => {
      if (emotion?.display) {
        try {
          const emotionDisplay: any = JSON.parse(emotion.display)
          changeEmotionDisplay(emotionDisplay)
        }
        catch (err) {
          console.log(err)
        }
      }
    })
    return unsubscribe  // 组件卸载自动取消
  }, [])

  return (
    <main className={styles.wapper} >
      <div className={styles.content}>
        <div className={styles.left}>
          <i
            className="iconfont icon-cocos-back"
            onClick={() => navigate(-1)}
          />
          <Menu />
        </div>
        <div className={styles.right}>
          <div className={styles.dragArea}></div>
          <div>
            <Outlet />
          </div>
        </div>
      </div>
      <div className={styles.background} style={{
        '--c1': emotionDisplay.c1,
        '--c2': emotionDisplay.c2,
      } as React.CSSProperties} />
      <i className={styles.description + ' ' + "iconfont icon-cocos-wenhao-xianxingyuankuang"} title={emotionDisplay.display.primary + ' ' + emotionDisplay.display.secondary} />
      {location.pathname === '/' && <Image emotion={emotionDisplay.display.primary} />}
    </main>
  )
}
export default Home
