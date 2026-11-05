import { useMemo } from 'react'
import { catalog, findBase, findExtra, findFilling, findSauce, findTopping } from '../config/catalog'
import { computeQuote } from '../engine/pricing'
import { amountLevel, saucePortions, toppingCount, toppingPortions } from '../engine/customization'
import { useBuilder } from '../store/builderStore'
import { money } from '../lib/format'
import { sfx } from '../lib/audio'
import { nameOf, useT } from '../i18n'
import { quickAddTopping } from '../three/interaction'
import { scatterPieces } from '../three/Topping3D'
import type { RollDesign } from '../types'
import { Icon } from './icons'

/**
 * Line-by-line price breakdown. Interactive on the counter (adjust amounts,
 * remove items) and read-only on the review screen.
 */
export function PriceLines({ design, editable }: { design: RollDesign; editable: boolean }) {
  const t = useT()
  const quote = useMemo(() => computeQuote(design), [design])
  const b = useBuilder.getState
  const base = findBase(design.baseId)
  const lines = quote.lines

  const sauceLines = lines.filter((l) => l.kind === 'sauce')
  const toppingLines = lines.filter((l) => l.kind === 'topping')
  const extraLines = lines.filter((l) => l.kind === 'extra')
  const surcharge = lines.filter((l) => l.kind === 'surcharge')
  const filling = findFilling(design.fillingId)

  const removeBtn = (label: string, onClick: () => void) => (
    <button className="mini" aria-label={t.remove(label)} onClick={() => (onClick(), sfx.tap())}>
      <Icon.Close />
    </button>
  )

  return (
    <div>
      <div className="grp">
        <div className="grp-t">{t.gDough}</div>
        <div className="line">
          <span className="l">
            <span className="dot" style={{ background: base.colors.crust }} />
            <span className="nm">{nameOf(base)}</span>
          </span>
          <span className="amt">{money(base.price)}</span>
        </div>
        <div className="grp-t" style={{ marginTop: 6 }}>
          {t.gFilling}
        </div>
        {filling ? (
          <div className="line">
            <span className="l">
              <span className="dot" style={{ background: filling.color }} />
              <span className="nm">{nameOf(filling)}</span>
              {editable && <span className="ctrl">{removeBtn(nameOf(filling), () => b().setFilling(null))}</span>}
            </span>
            <span className="amt">{money(filling.price)}</span>
          </div>
        ) : (
          <div className="empty-note">{t.noFilling}</div>
        )}
      </div>

      <div className="grp">
        <div className="grp-t">
          {t.gSauces} · {sauceLines.length}/{catalog.limits.maxSauces}
        </div>
        {sauceLines.length === 0 && <div className="empty-note">{t.noSauces}</div>}
        {sauceLines.map((l) => {
          const s = findSauce(l.refId)
          const lvl = amountLevel(saucePortions(design, l.refId), catalog.pricing.sauceExtraThreshold)
          const nm = nameOf(s)
          return (
            <div className="line" key={l.refId}>
              <span className="l">
                <span className="dot" style={{ background: s?.color }} />
                <span className="nm">{nm}</span>
                <span className="dt">{t.levels[lvl]}</span>
                {editable && <span className="ctrl">{removeBtn(nm, () => b().removeSauce(l.refId))}</span>}
              </span>
              <span className="amt">{money(l.amount)}</span>
            </div>
          )
        })}
      </div>

      <div className="grp">
        <div className="grp-t">
          {t.gToppings} · {toppingLines.length}/{catalog.limits.maxToppings}
        </div>
        {toppingLines.length === 0 && <div className="empty-note">{t.noToppings}</div>}
        {toppingLines.map((l) => {
          const tp = findTopping(l.refId)
          if (!tp) return null
          const lvl = amountLevel(toppingPortions(design, l.refId), catalog.pricing.toppingExtraThreshold)
          const count = toppingCount(design, l.refId)
          const step = Math.max(1, Math.round(tp.portion / 3))
          const nm = nameOf(tp)
          return (
            <div className="line" key={l.refId}>
              <span className="l">
                <span className="dot" style={{ background: tp.bedColor }} />
                <span className="nm">{nm}</span>
                <span className="dt">{t.levels[lvl]}</span>
                {editable && (
                  <span className="ctrl">
                    <button className="mini" aria-label={t.fewer(nm)} onClick={() => (b().removeToppingPieces(l.refId, step), sfx.tap())}>
                      <Icon.Minus />
                    </button>
                    <button className="mini" aria-label={t.more(nm)} disabled={count >= tp.maxPieces} onClick={() => quickAddTopping(l.refId, scatterPieces(tp, step))}>
                      <Icon.Plus />
                    </button>
                    {removeBtn(nm, () => b().removeTopping(l.refId))}
                  </span>
                )}
              </span>
              <span className="amt">{money(l.amount)}</span>
            </div>
          )
        })}
      </div>

      {(extraLines.length > 0 || surcharge.length > 0) && (
        <div className="grp">
          <div className="grp-t">{t.gExtras}</div>
          {extraLines.map((l) => {
            const nm = nameOf(findExtra(l.refId))
            return (
              <div className="line" key={l.refId}>
                <span className="l">
                  <span className="nm">{nm}</span>
                  {editable && <span className="ctrl">{removeBtn(nm, () => b().toggleExtra(l.refId))}</span>}
                </span>
                <span className="amt">{l.amount ? money(l.amount) : t.free}</span>
              </div>
            )
          })}
          {surcharge.map((l) => {
            const item = findSauce(l.refId) ?? findTopping(l.refId)
            const isSauce = !!findSauce(l.refId)
            return (
              <div className="line" key={`s-${l.refId}`}>
                <span className="l">
                  <span className="nm">{t.extraOf(nameOf(item))}</span>
                  <span className="dt">{isSauce ? t.generousPour : t.doublePortion}</span>
                </span>
                <span className="amt">+{money(l.amount)}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="total">
        <span>{t.total}</span>
        <span className="v">{money(quote.total)}</span>
      </div>
    </div>
  )
}

export function Receipt() {
  const t = useT()
  const design = useBuilder((s) => s.design)
  return (
    <div className="receipt" role="region" aria-label={t.priceBreakdown}>
      <h3 lang="en">ROLL LAB</h3>
      <div className="meta">{t.receiptMeta}</div>
      <PriceLines design={design} editable />
    </div>
  )
}
