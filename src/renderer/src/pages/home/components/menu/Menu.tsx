import { memo } from 'react'
import styles from './Menu.module.css'
import { useNavigate, useLocation } from 'react-router-dom'

type MenuItem = {
  key: string
  label: string
  icon: string
  path: string
}

const menuList: MenuItem[] = [
  { key: 'home', label: '首页', icon: 'icon-cocos-shouye', path: '/' },
  { key: 'param-show', label: '情绪', icon: 'icon-cocos-canshu', path: '/param-show' },
  { key: 'diary', label: '笔记', icon: 'icon-cocos-version-list', path: '/diary' },
  { key: 'model-set', label: '模型', icon: 'icon-cocos-lujing-8', path: '/model-set' },
  { key: 'file-manage', label: '文件', icon: 'icon-cocos-resource-list', path: '/file-manage' },
]

const Menu = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const handleClick = (menu: MenuItem) => {
    navigate(menu.path)
  }

  return (
    <main className={styles.wapper}>
      <div className={styles.menulist}>
        {menuList.map((menu) => (
          <div
            onClick={() => handleClick(menu)}
            key={menu.key}
            className={location.pathname === menu.path ? styles.active : ''}
          >
            <span>
              <i className={`iconfont ${menu.icon}`} />
            </span>
            <span>{menu.label}</span>
            <span></span>
          </div>
        ))}
      </div>
    </main>
  )
}
export default memo(Menu)
