import { useEffect, useState } from 'react'
import { MainWorkspace } from './three/MainWorkspace'
import { useUI } from './store/uiStore'
import { IntroScreen } from './ui/IntroScreen'
import { UIControls } from './ui/UIControls'
import { ReviewScreen } from './ui/ReviewScreen'
import { CartDrawer } from './ui/Cart'
import { Checkout } from './ui/Checkout'
import { Toast, Tooltip } from './ui/Toast'

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
  const [gl] = useState(webglAvailable)

  useEffect(() => {
    document.body.dataset.screen = screen
  }, [screen])

  if (!gl) {
    return (
      <div className="rl-fallback">
        <h1>ROLL LAB</h1>
        <p>Our 3D counter needs WebGL, which isn’t available in this browser. Please try a recent version of Chrome, Safari, Firefox or Edge.</p>
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
