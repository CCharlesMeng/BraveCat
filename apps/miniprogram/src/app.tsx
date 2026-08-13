import type { PropsWithChildren } from 'react'
import './app.scss'

/** 页面即视图；全局编排（controller 单例、端口接线）在 src/game/controller.ts。 */
function App({ children }: PropsWithChildren) {
  return children
}

export default App
