import { useState } from 'react'
import { useUI } from '../store/uiStore'
import { useBuilder } from '../store/builderStore'
import { catalog } from '../config/catalog'
import { money } from '../lib/format'
import { sfx, unlockAudio } from '../lib/audio'
import { Icon, Swirl } from './icons'

export function IntroScreen() {
  const ready = useUI((s) => s.sceneReady)
  const [leaving, setLeaving] = useState(false)
  const from = Math.min(...catalog.bases.map((b) => b.price))

  const start = () => {
    unlockAudio()
    sfx.tap()
    setLeaving(true)
    setTimeout(() => {
      const ui = useUI.getState()
      ui.setScreen('build')
      // a fresh roll drops into the box once the lid opens
      useBuilder.setState((s) => ({ rollSerial: s.rollSerial + 1 }))
      setTimeout(() => {
        useUI.getState().setLidOpen(true)
        sfx.box(true)
      }, 450)
      setTimeout(() => {
        let coached = false
        try {
          coached = !!localStorage.getItem('rolllab-coached')
        } catch {
          /* storage blocked (private mode) — just show the tips */
        }
        if (!coached) useUI.getState().setHint('pick')
      }, 1800)
    }, 520)
  }

  return (
    <div className={`intro${leaving ? ' leaving' : ''}`}>
      <div className="intro-copy">
        <div className="logo logo-top">
          <Swirl size={40} />
          ROLL LAB
        </div>
        <p className="eyebrow">Cinnamon roll atelier</p>
        <h1>
          BUILD YOUR <em>DREAM</em> ROLL
        </h1>
        <p className="lede">
          Choose your dough, pour the sauces, sprinkle the crunch. Every roll is built by you on our counter — then baked
          fresh and boxed for you.
        </p>
        <div className="cta-row">
          <button className="btn primary big" onClick={start} disabled={!ready} autoFocus>
            {ready ? (
              <>
                START CREATING <Icon.ArrowRight width={20} height={20} />
              </>
            ) : (
              <>
                Warming the oven <span className="loading-dot" />
              </>
            )}
          </button>
          <span className="from">
            from <b>{money(from)}</b>
          </span>
        </div>
        <ol className="intro-steps">
          <li>
            <span className="n">1</span> Pick your dough
          </li>
          <li>
            <span className="n">2</span> Pour &amp; sprinkle
          </li>
          <li>
            <span className="n">3</span> Box it &amp; order
          </li>
        </ol>
      </div>
    </div>
  )
}
