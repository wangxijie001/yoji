import type { RouteObject } from 'react-router-dom'
import Home from './pages/home/Home'
import AiChat from './pages/ai-chat/AIChat'
import ModalSet from './pages/modal-set/ModaSet'
import ParamShow from './pages/param-show/ParamShow'
import Diary from './pages/diary/Diary'
import FileManage from './pages/file-manage/FileManage'
import McpManage from './pages/mcp-manage/McpManage'
import Workshop from './pages/workshop/Workshop'
import TaskMonitor from './pages/task-monitor/TaskMonitor'

// 路由配置——后续新增页面只需加一条记录，导航和路由自动同步
const routes: (RouteObject & { label: string })[] = [
  {
    path: '/', element: <Home />, label: '首页',
    children: [
      {
        index: true,  //  人工智能聊天
        element: <AiChat />
      },
      {
        path: 'model-set',
        element: <ModalSet />
      },
      {
        path: 'param-show',
        element: <ParamShow />
      },
      {
        path: 'diary',
        element: <Diary />
      },
      {
        path: 'file-manage',
        element: <FileManage />
      },
      {
        path: 'file-manage/:fileId',
        element: <FileManage />
      },
      {
        path: 'mcp-manage',
        element: <McpManage />
      },
      {
        path: 'workshop',
        element: <Workshop />
      }
    ]
  },
  {
    path: '/task-monitor',
    element: <TaskMonitor />,
    label: '任务监控',
  },

]

export default routes
