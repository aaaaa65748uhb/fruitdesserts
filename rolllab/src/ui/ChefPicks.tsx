import { useEffect, useMemo } from 'react'
import { catalog, findBase } from '../config/catalog'
import { descOf, nameOf, useT, tr } from '../i18n'
import { useBuilder } from '../store/builderStore'
import { useTool } from '../store/toolStore'
import { useUI } from '../store/uiStore'
import { money } from '../lib/format'
import { sfx, startPour, stopPour } from '../lib/audio'
import { buildPresetDesign, presetPrice, PRESET_STEP_MS } from '../three/presets'
import type { Preset } from '../types'
import { DoughSwatch, Icon } from './icons'

/** Puts a chef's pick on the counter: sauces pour in one by one, then toppings rain down. */
export function applyPreset(preset: Preset) {
  useTool.getState().putBack()
  const design = buildPresetDesign(preset, Date.now() + 250)
  useBuilder.getState().applyDesign(design)
  useUI.getState().showToast(tr().pickApplied(nameOf(preset)), 'success')
  sfx.pop()
  preset.sauces.forEach((ps, i) => {
    setTimeout(() => startPour(ps.flow === 'thick' ? 1 : ps.flow === 'thin' ? 0 : 0.5), 250 + i * PRESET_STEP_MS)
    setTimeout(() => stopPour(), 250 + i * PRESET_STEP_MS + 900)
  })
  if (preset.toppings.length) {
    const at = 250 + preset.sauces.length * PRESET_STEP_MS + 400
    setTimeout(() => sfx.sprinkle(3), at)
    setTimeout(() => sfx.sprinkle(2), at + 250)
  }
}

export function ChefPicksPanel() {
  const open = useUI((s) => s.picksOpen)
  const setOpen = useUI((s) => s.setPicksOpen)
  const t = useT()
  // real prices, computed with the pricing engine on the actual poured design
  const prices = useMemo(() => (open ? catalog.presets.map((p) => presetPrice(p)) : []), [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  return (
    <>
      <div className="picks-backdrop" onClick={() => setOpen(false)} />
      <section className="picks" role="dialog" aria-label={t.chefPicksTitle}>
        <div className="picks-head">
          <div>
            <h3>{t.chefPicksTitle}</h3>
            <p>{t.chefPicksSub}</p>
          </div>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t.close}>
            <Icon.Close />
          </button>
        </div>
        <div className="picks-list">
          {catalog.presets.map((p, i) => {
            const b = findBase(p.baseId)
            return (
              <button
                key={p.id}
                className="pick"
                onClick={() => {
                  setOpen(false)
                  applyPreset(p)
                }}
              >
                <DoughSwatch dough={b.colors.dough} crust={b.colors.crust} filling={b.colors.filling} />
                <span className="pick-body">
                  <span className="pick-name">{nameOf(p)}</span>
                  <span className="pick-desc">{descOf(p)}</span>
                </span>
                <span className="pick-price">{prices[i] != null ? money(prices[i] as number) : ''}</span>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}
