import { useUI } from '../store/uiStore'
import { useTool } from '../store/toolStore'
import { catalog } from '../config/catalog'
import { money } from '../lib/format'

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
  let title = ''
  let price = ''
  let desc = ''
  let action = ''
  if (hovered?.kind === 'sauce') {
    const s = catalog.sauces.find((x) => x.id === hovered.id)
    if (s) [title, price, desc, action] = [s.name, money(s.price), s.description, 'Click to pick up · hold to pour']
  } else if (hovered?.kind === 'topping') {
    const t = catalog.toppings.find((x) => x.id === hovered.id)
    if (t) [title, price, desc, action] = [t.name, money(t.price), t.description, 'Click to scoop · hold to sprinkle']
  } else if (hovered?.kind === 'filling') {
    const f = catalog.fillings.find((x) => x.id === hovered.id)
    if (f) [title, price, desc, action] = [f.name, money(f.price), f.description, 'Click or drag onto the roll']
  } else if (hovered?.kind === 'extra') {
    const e = catalog.extras.find((x) => x.id === hovered.id)
    if (e) [title, price, desc, action] = [e.name, e.price ? money(e.price) : 'Free', e.description, 'Click to add / remove']
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
