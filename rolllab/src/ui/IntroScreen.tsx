import { useState } from 'react'
import { useUI } from '../store/uiStore'
import { useBuilder } from '../store/builderStore'
import { catalog } from '../config/catalog'
import { money } from '../lib/format'
import { sfx, unlockAudio } from '../lib/audio'
import { nameOf, useT } from '../i18n'
import type { Preset } from '../types'
import { Icon, Swirl } from './icons'
import { applyPreset } from './ChefPicks'
import { LangToggle } from './UIControls'

export function IntroScreen() {
  const ready = useUI((s) => s.sceneReady)
  const t = useT()
  const [leaving, setLeaving] = useState(false)
  const from = Math.min(...catalog.bases.map((b) => b.price))

  const start = (preset?: Preset) => {
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
      if (preset) {
        setTimeout(() => applyPreset(preset), 2100)
        return
      }
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
      <div className="intro-lang">
        <LangToggle />
      </div>
      <div className="intro-copy">
        <div className="logo logo-top">
          <Swirl size={40} />
          ROLL LAB
        </div>
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>
          {t.h1Pre} <em>{t.h1Em}</em> {t.h1Post}
        </h1>
        <p className="lede">{t.lede}</p>
        <div className="cta-row">
          <button className="btn primary big" onClick={() => start()} disabled={!ready} autoFocus>
            {ready ? (
              <>
                {t.start} <Icon.ArrowRight width={20} height={20} />
              </>
            ) : (
              <>
                {t.warming} <span className="loading-dot" />
              </>
            )}
          </button>
          <span className="from">
            {t.from} <b>{money(from)}</b>
          </span>
        </div>
        <div className="intro-picks" aria-label={t.orPick}>
          <span className="intro-picks-label">{t.orPick}</span>
          <div className="intro-picks-row">
            {catalog.presets.slice(0, 3).map((p) => (
              <button key={p.id} className="chip" disabled={!ready} onClick={() => start(p)}>
                <Icon.Sparkle /> {nameOf(p)}
              </button>
            ))}
          </div>
        </div>
        <ol className="intro-steps">
          {t.steps.map((s, i) => (
            <li key={s}>
              <span className="n">{i + 1}</span> {s}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
