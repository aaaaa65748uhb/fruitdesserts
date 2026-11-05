import { useMemo } from 'react'
import { findBase, findExtra, findFilling, findSauce, findTopping } from '../config/catalog'
import { computeQuote } from '../engine/pricing'
import { amountLevel, saucePortions, toppingPortions, usedSauceIds, usedToppingIds } from '../engine/customization'
import { catalog } from '../config/catalog'
import { useBuilder } from '../store/builderStore'
import { useUI } from '../store/uiStore'
import { money } from '../lib/format'
import { sfx } from '../lib/audio'
import { Icon } from './icons'
import { TopBar } from './UIControls'
import { PriceLines } from './Receipt'
import { packAndAddToCart } from './packSequence'

const LVL = { light: 'light', regular: '', extra: 'extra' }

export function ReviewScreen() {
  const design = useBuilder((s) => s.design)
  const editing = useBuilder((s) => s.editingCartItemId)
  const quote = useMemo(() => computeQuote(design), [design])
  const base = findBase(design.baseId)
  const filling = findFilling(design.fillingId)

  const sauces = usedSauceIds(design).map((id) => {
    const s = findSauce(id)
    const l = amountLevel(saucePortions(design, id), catalog.pricing.sauceExtraThreshold)
    return s ? `${s.name}${LVL[l] ? ` (${LVL[l]})` : ''}` : id
  })
  const tops = usedToppingIds(design).map((id) => {
    const t = findTopping(id)
    const l = amountLevel(toppingPortions(design, id), catalog.pricing.toppingExtraThreshold)
    return t ? `${t.name}${LVL[l] ? ` (${LVL[l]})` : ''}` : id
  })
  const extras = design.extras.map((e) => findExtra(e)?.name ?? e)

  return (
    <>
      <TopBar showInspect={false} />
      <aside className="review-panel" aria-label="Review your roll">
        <div className="scroll">
          <p className="kicker">Step 3 · Review</p>
          <h2>Your creation</h2>
          <label className="name-field">
            <span className="field-label">Name your roll (optional)</span>
            <input
              className="input"
              maxLength={40}
              placeholder="e.g. The Pistachio Dream"
              value={design.name}
              onChange={(e) => useBuilder.getState().setName(e.target.value)}
            />
          </label>
          <div className="spec">
            <div className="row">
              <span className="k">Dough</span>
              <span className="v">{base.name}</span>
            </div>
            <div className="row">
              <span className="k">Filling</span>
              <span className="v">{filling ? filling.name : <span className="muted">Classic cinnamon swirl</span>}</span>
            </div>
            <div className="row">
              <span className="k">Sauces</span>
              <span className="v">{sauces.length ? sauces.join(', ') : <span className="muted">None</span>}</span>
            </div>
            <div className="row">
              <span className="k">Toppings</span>
              <span className="v">{tops.length ? tops.join(', ') : <span className="muted">None</span>}</span>
            </div>
            <div className="row">
              <span className="k">Extras</span>
              <span className="v">{extras.length ? extras.join(', ') : <span className="muted">None</span>}</span>
            </div>
          </div>
          <div className="receipt-inline" style={{ marginTop: 14 }}>
            <PriceLines design={design} editable={false} />
          </div>
        </div>
        <div className="foot">
          <button
            className="btn ghost"
            onClick={() => {
              useUI.getState().setScreen('build')
              sfx.tap()
            }}
          >
            <Icon.ArrowLeft width={18} height={18} /> Keep editing
          </button>
          <button className="btn primary" onClick={() => void packAndAddToCart()}>
            {editing ? 'Update box' : 'Box it'} · {money(quote.total)}
          </button>
        </div>
      </aside>
    </>
  )
}
