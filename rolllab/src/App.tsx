import { useEffect, useState } from 'react'
import { MainWorkspace } from './three/MainWorkspace'
import { useUI } from './store/uiStore'
import { IntroScreen } from './ui/IntroScreen'
import { UIControls } from './ui/UIControls'
import { ReviewScreen } from './ui/ReviewScreen'
import { CartDrawer } from './ui/Cart'
import { Checkout } from './ui/Checkout'
import { Toast, Tooltip } from './ui/Toast'
import { useLang, useT } from './i18n'

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function App() {
  const screen = useUI((s) => s.screen)
  const lang = useLang((s) => s.lang)
  const t = useT()
  const [gl] = useState(webglAvailable)

  useEffect(() => {
    document.body.dataset.screen = screen
  }, [screen])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = t.dir
    document.title = t.docTitle
  }, [lang, t])

  if (!gl) {
    return (
      <div className="rl-fallback">
        <h1>ROLL LAB</h1>
        <p>{t.noWebgl}</p>
      </div>
    )
  }

  return (
    <div className="rl-app">
      <MainWorkspace />
      {screen === 'intro' && <IntroScreen />}
      {screen === 'build' && <UIControls />}
      {screen === 'review' && <ReviewScreen />}
      {screen === 'checkout' && <Checkout />}
      <CartDrawer />
      <Toast />
      <Tooltip />
    </div>
  )
}
