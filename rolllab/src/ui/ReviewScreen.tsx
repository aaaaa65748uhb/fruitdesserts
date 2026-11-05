import { useMemo } from 'react'
import { catalog, findBase, findExtra, findFilling, findSauce, findTopping } from '../config/catalog'
import { computeQuote } from '../engine/pricing'
import { amountLevel, saucePortions, toppingPortions, usedSauceIds, usedToppingIds } from '../engine/customization'
import { useBuilder } from '../store/builderStore'
import { useUI } from '../store/uiStore'
import { money } from '../lib/format'
import { sfx } from '../lib/audio'
import { nameOf, useT } from '../i18n'
import { Icon } from './icons'
import { TopBar } from './UIControls'
import { PriceLines } from './Receipt'
import { packAndAddToCart } from './packSequence'

export function ReviewScreen() {
  const t = useT()
  const design = useBuilder((s) => s.design)
  const editing = useBuilder((s) => s.editingCartItemId)
  const quote = useMemo(() => computeQuote(design), [design])
  const base = findBase(design.baseId)
  const filling = findFilling(design.fillingId)

  const withLevel = (name: string, lvl: 'light' | 'regular' | 'extra') => (t.lvlSuffix[lvl] ? `${name} (${t.lvlSuffix[lvl]})` : name)
  const sauces = usedSauceIds(design).map((id) => withLevel(nameOf(findSauce(id)), amountLevel(saucePortions(design, id), catalog.pricing.sauceExtraThreshold)))
  const tops = usedToppingIds(design).map((id) => withLevel(nameOf(findTopping(id)), amountLevel(toppingPortions(design, id), catalog.pricing.toppingExtraThreshold)))
  const extras = design.extras.map((e) => nameOf(findExtra(e)))

  const row = (k: string, v: string | null, empty: string) => (
    <div className="row">
      <span className="k">{k}</span>
      <span className="v">{v ? v : <span className="muted">{empty}</span>}</span>
    </div>
  )

  return (
    <>
      <TopBar showInspect={false} />
      <aside className="review-panel" aria-label={t.yourCreation}>
        <div className="scroll">
          <p className="kicker">{t.step3}</p>
          <h2>{t.yourCreation}</h2>
          <label className="name-field" htmlFor="roll-name">
            <span className="field-label">{t.nameYourRoll}</span>
            <input
              id="roll-name"
              className="input"
              maxLength={40}
              placeholder={t.namePlaceholder}
              value={design.name}
              onChange={(e) => useBuilder.getState().setName(e.target.value)}
            />
          </label>
          <div className="spec">
            {row(t.gDough, nameOf(base), '')}
            {row(t.gFilling, filling ? nameOf(filling) : null, t.classicSwirl)}
            {row(t.gSauces, sauces.length ? sauces.join(', ') : null, t.none)}
            {row(t.gToppings, tops.length ? tops.join(', ') : null, t.none)}
            {row(t.gExtrasShort, extras.length ? extras.join(', ') : null, t.none)}
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
            <Icon.ArrowLeft width={18} height={18} /> {t.keepEditing}
          </button>
          <button className="btn primary" onClick={() => void packAndAddToCart()}>
            {editing ? t.updateBox : t.boxIt} · {money(quote.total)}
          </button>
        </div>
      </aside>
    </>
  )
}
