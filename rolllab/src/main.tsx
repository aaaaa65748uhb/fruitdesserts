import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/wght-italic.css'
import '@fontsource-variable/dm-sans/index.css'
import './styles.css'
import { App } from './App'

/**
 * Fonts are loaded before the first render because the 3D labels, box print
 * and stickers are painted with them onto canvases.
 */
async function boot() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('900 64px "Fraunces Variable"'),
        document.fonts.load('italic 600 64px "Fraunces Variable"'),
        document.fonts.load('700 32px "DM Sans Variable"'),
        document.fonts.load('800 32px "DM Sans Variable"'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ])
  } catch {
    /* fall back to system fonts */
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
