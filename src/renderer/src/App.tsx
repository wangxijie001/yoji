import { HashRouter, useRoutes } from 'react-router-dom'
import routes from './routes'
import { ConfigProvider } from 'antd'
import { customAntdVar } from './assets/custom-antd-var'

function AppRoutes(): React.JSX.Element {
  const element = useRoutes(routes)
  return <>{element}</>
}

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <ConfigProvider theme={customAntdVar}>
        <AppRoutes />
      </ConfigProvider>
    </HashRouter>
  )
}

export default App
