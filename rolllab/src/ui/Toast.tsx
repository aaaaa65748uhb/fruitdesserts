import { useUI } from '../store/uiStore'
import { useTool } from '../store/toolStore'
import { catalog } from '../config/catalog'
import { money } from '../lib/format'
import { descOf, nameOf, useT } from '../i18n'

export function Toast() {
  const toast = useUI((s) => s.toast)
  if (!toast) return null
  return (
    <div key={toast.id} className={`toast ${toast.tone}`} role="status" aria-live="polite">
      {toast.text}
    </div>
  )
}

/** Hover card for 3D objects. Positioned every frame by TooltipTracker. */
export function Tooltip() {
  const hovered = useTool((s) => s.hovered)
  const t = useT()
  let title = ''
  let price = ''
  let desc = ''
  let action = ''
  if (hovered?.kind === 'sauce') {
    const s = catalog.sauces.find((x) => x.id === hovered.id)
    if (s) [title, price, desc, action] = [nameOf(s), money(s.price), descOf(s), t.tipSauce]
  } else if (hovered?.kind === 'topping') {
    const tp = catalog.toppings.find((x) => x.id === hovered.id)
    if (tp) [title, price, desc, action] = [nameOf(tp), money(tp.price), descOf(tp), t.tipTopping]
  } else if (hovered?.kind === 'filling') {
    const f = catalog.fillings.find((x) => x.id === hovered.id)
    if (f) [title, price, desc, action] = [nameOf(f), money(f.price), descOf(f), t.tipFilling]
  } else if (hovered?.kind === 'extra') {
    const e = catalog.extras.find((x) => x.id === hovered.id)
    if (e) [title, price, desc, action] = [nameOf(e), e.price ? money(e.price) : t.free, descOf(e), t.tipExtra]
  }
  return (
    <div id="rl-tooltip" className="rl-tooltip" aria-hidden="true">
      {title && (
        <>
          <div className="t">
            <span>{title}</span>
            <span>{price}</span>
          </div>
          <div className="d">{desc}</div>
          <div className="a">{action}</div>
        </>
      )}
    </div>
  )
}
