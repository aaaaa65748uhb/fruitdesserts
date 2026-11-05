import { useMemo } from 'react'
import { catalog, findBase, findExtra, findFilling, findSauce, findTopping } from '../config/catalog'
import { computeQuote } from '../engine/pricing'
import { amountLevel, saucePortions, toppingCount, toppingPortions } from '../engine/customization'
import { useBuilder } from '../store/builderStore'
import { money } from '../lib/format'
import { sfx } from '../lib/audio'
import { quickAddTopping } from '../three/interaction'
import { scatterPieces } from '../three/Topping3D'
import type { RollDesign } from '../types'
import { Icon } from './icons'

const LEVEL_LABEL = { light: 'Light', regular: 'Regular', extra: 'Extra' }

/**
 * Line-by-line price breakdown. Interactive on the counter (adjust amounts,
 * remove items) and read-only on the review screen.
 */
export function PriceLines({ design, editable }: { design: RollDesign; editable: boolean }) {
  const quote = useMemo(() => computeQuote(design), [design])
  const b = useBuilder.getState
  const base = findBase(design.baseId)
  const lines = quote.lines

  const sauceLines = lines.filter((l) => l.kind === 'sauce')
  const toppingLines = lines.filter((l) => l.kind === 'topping')
  const extraLines = lines.filter((l) => l.kind === 'extra')
  const surcharge = lines.filter((l) => l.kind === 'surcharge')
  const filling = findFilling(design.fillingId)

  return (
    <div>
      <div className="grp">
        <div className="grp-t">Dough</div>
        <div className="line">
          <span className="l">
            <span className="dot" style={{ background: base.colors.crust }} />
            <span className="nm">{base.name}</span>
          </span>
          <span className="amt">{money(base.price)}</span>
        </div>
        <div className="grp-t" style={{ marginTop: 6 }}>
          Filling
        </div>
        {filling ? (
          <div className="line">
            <span className="l">
              <span className="dot" style={{ background: filling.color }} />
              <span className="nm">{filling.name}</span>
              {editable && (
                <span className="ctrl">
                  <button className="mini" aria-label={`Remove ${filling.name}`} onClick={() => (b().setFilling(null), sfx.tap())}>
                    <Icon.Close />
                  </button>
                </span>
              )}
            </span>
            <span className="amt">{money(filling.price)}</span>
          </div>
        ) : (
          <div className="empty-note">Classic swirl — add a filling from the ramekins.</div>
        )}
      </div>

      <div className="grp">
        <div className="grp-t">
          Sauces · {sauceLines.length}/{catalog.limits.maxSauces}
        </div>
        {sauceLines.length === 0 && <div className="empty-note">Pick up a bottle and press & hold on the roll.</div>}
        {sauceLines.map((l) => {
          const s = findSauce(l.refId)
          const lvl = amountLevel(saucePortions(design, l.refId), catalog.pricing.sauceExtraThreshold)
          return (
            <div className="line" key={l.refId}>
              <span className="l">
                <span className="dot" style={{ background: s?.color }} />
                <span className="nm">{l.label}</span>
                <span className="dt">{LEVEL_LABEL[lvl]}</span>
                {editable && (
                  <span className="ctrl">
                    <button className="mini" aria-label={`Remove ${l.label}`} onClick={() => (b().removeSauce(l.refId), sfx.tap())}>
                      <Icon.Close />
                    </button>
                  </span>
                )}
              </span>
              <span className="amt">{money(l.amount)}</span>
            </div>
          )
        })}
      </div>

      <div className="grp">
        <div className="grp-t">
          Toppings · {toppingLines.length}/{catalog.limits.maxToppings}
        </div>
        {toppingLines.length === 0 && <div className="empty-note">Scoop from a tray and sprinkle over the roll.</div>}
        {toppingLines.map((l) => {
          const t = findTopping(l.refId)
          if (!t) return null
          const lvl = amountLevel(toppingPortions(design, l.refId), catalog.pricing.toppingExtraThreshold)
          const count = toppingCount(design, l.refId)
          const step = Math.max(1, Math.round(t.portion / 3))
          return (
            <div className="line" key={l.refId}>
              <span className="l">
                <span className="dot" style={{ background: t.bedColor }} />
                <span className="nm">{l.label}</span>
                <span className="dt">{LEVEL_LABEL[lvl]}</span>
                {editable && (
                  <span className="ctrl">
                    <button className="mini" aria-label={`Less ${l.label}`} onClick={() => (b().removeToppingPieces(l.refId, step), sfx.tap())}>
                      <Icon.Minus />
                    </button>
                    <button
                      className="mini"
                      aria-label={`More ${l.label}`}
                      disabled={count >= t.maxPieces}
                      onClick={() => quickAddTopping(l.refId, scatterPieces(t, step))}
                    >
                      <Icon.Plus />
                    </button>
                    <button className="mini" aria-label={`Remove ${l.label}`} onClick={() => (b().removeTopping(l.refId), sfx.tap())}>
                      <Icon.Close />
                    </button>
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
          <div className="grp-t">Extras & extra charges</div>
          {extraLines.map((l) => (
            <div className="line" key={l.refId}>
              <span className="l">
                <span className="nm">{findExtra(l.refId)?.name}</span>
                {editable && (
                  <span className="ctrl">
                    <button className="mini" aria-label={`Remove ${l.label}`} onClick={() => (b().toggleExtra(l.refId), sfx.tap())}>
                      <Icon.Close />
                    </button>
                  </span>
                )}
              </span>
              <span className="amt">{l.amount ? money(l.amount) : 'Free'}</span>
            </div>
          ))}
          {surcharge.map((l) => (
            <div className="line" key={`s-${l.refId}`}>
              <span className="l">
                <span className="nm">{l.label}</span>
                <span className="dt">{l.detail}</span>
              </span>
              <span className="amt">+{money(l.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="total">
        <span>Total</span>
        <span className="v">{money(quote.total)}</span>
      </div>
    </div>
  )
}

export function Receipt() {
  const design = useBuilder((s) => s.design)
  return (
    <div className="receipt" role="region" aria-label="Price breakdown">
      <h3>ROLL LAB</h3>
      <div className="meta">Your roll · live receipt</div>
      <PriceLines design={design} editable />
    </div>
  )
}
