import { useEffect } from 'react'
import { catalog } from '../config/catalog'
import { cloneDesign, isDesignEmpty, summarizeDesign } from '../engine/customization'
import { computeCartTotals } from '../engine/pricing'
import { useCart } from '../store/cartStore'
import { useBuilder } from '../store/builderStore'
import { useUI } from '../store/uiStore'
import { useTool } from '../store/toolStore'
import { money } from '../lib/format'
import { sfx } from '../lib/audio'
import { rollTitle } from '../checkout/order'
import { Icon, Swirl } from './icons'

export function CartDrawer() {
  const open = useUI((s) => s.cartOpen)
  const setOpen = useUI((s) => s.setCartOpen)
  const items = useCart((s) => s.items)
  const method = useCart((s) => s.form.method)
  const totals = computeCartTotals(items, method)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const buildAnother = () => {
    setOpen(false)
    const ui = useUI.getState()
    if (ui.screen !== 'build') ui.setScreen('build')
    if (!ui.lidOpen) ui.setLidOpen(true)
    sfx.tap()
  }

  const edit = (id: string) => {
    const item = useCart.getState().items.find((i) => i.id === id)
    if (!item) return
    const b = useBuilder.getState()
    if (!b.editingCartItemId && !isDesignEmpty(b.design)) {
      const ok = window.confirm('Replace the roll that’s on the counter with this one? (The counter roll isn’t in your cart yet.)')
      if (!ok) return
    }
    useTool.getState().putBack()
    b.loadDesign(cloneDesign(item.design), item.id)
    const ui = useUI.getState()
    ui.setScreen('build')
    ui.setLidOpen(true)
    setOpen(false)
    ui.showToast(`Editing ${rollTitle(item, items.indexOf(item))}`)
  }

  return (
    <>
      <div className="backdrop" onClick={() => setOpen(false)} />
      <aside className="cart" role="dialog" aria-modal="true" aria-label="Your cart">
        <div className="head">
          <h2>Your box</h2>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close cart">
            <Icon.Close />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="empty">
            <Swirl size={72} />
            <p>
              <b>Your cart is empty.</b>
              <br />
              Build a roll on the counter and box it.
            </p>
            <button className="btn primary" onClick={buildAnother}>
              Start building
            </button>
          </div>
        ) : (
          <>
            <div className="items">
              {items.map((it, i) => (
                <div className="cart-item" key={it.id}>
                  {it.thumbnail ? <img className="thumb" src={it.thumbnail} alt="" /> : <div className="thumb" />}
                  <div>
                    <div className="title">
                      <span>{rollTitle(it, i)}</span>
                      <span>{money(it.unitPrice * it.quantity)}</span>
                    </div>
                    <div className="sum">{summarizeDesign(it.design)}</div>
                    <div className="row">
                      <div className="qty" role="group" aria-label="Quantity">
                        <button aria-label="One less" onClick={() => (it.quantity > 1 ? useCart.getState().setQuantity(it.id, it.quantity - 1) : useCart.getState().remove(it.id))}>
                          <Icon.Minus />
                        </button>
                        <span aria-live="polite">{it.quantity}</span>
                        <button aria-label="One more" onClick={() => useCart.getState().setQuantity(it.id, it.quantity + 1)}>
                          <Icon.Plus />
                        </button>
                      </div>
                      <span className="dt" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                        {money(it.unitPrice)} each
                      </span>
                      <span style={{ flex: 1 }} />
                      <button className="link-btn" onClick={() => edit(it.id)}>
                        Edit
                      </button>
                      <button className="link-btn danger" onClick={() => (useCart.getState().remove(it.id), sfx.tap())}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="foot">
              <div className="kv">
                <span>Subtotal · {totals.itemCount} {totals.itemCount === 1 ? 'roll' : 'rolls'}</span>
                <b>{money(totals.subtotal)}</b>
              </div>
              <div className="note">
                {totals.freeDeliveryRemaining > 0
                  ? `Add ${money(totals.freeDeliveryRemaining)} more for free delivery (delivery ${money(catalog.fulfillment.deliveryFee)}). Pickup is always free.`
                  : 'You’ve unlocked free delivery.'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn ghost" style={{ flex: 1 }} onClick={buildAnother}>
                  Build another
                </button>
                <button
                  className="btn primary"
                  style={{ flex: 1.3 }}
                  onClick={() => {
                    setOpen(false)
                    useUI.getState().setScreen('checkout')
                    sfx.tap()
                  }}
                >
                  Checkout <Icon.ArrowRight width={18} height={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
