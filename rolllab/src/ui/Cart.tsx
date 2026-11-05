import { useEffect, useState } from 'react'
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
import { useT } from '../i18n'

export function CartDrawer() {
  const t = useT()
  const open = useUI((s) => s.cartOpen)
  const setOpen = useUI((s) => s.setCartOpen)
  const items = useCart((s) => s.items)
  const method = useCart((s) => s.form.method)
  const totals = computeCartTotals(items, method)
  const [confirmEdit, setConfirmEdit] = useState<string | null>(null)

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

  const edit = (id: string, confirmed = false) => {
    const item = useCart.getState().items.find((i) => i.id === id)
    if (!item) return
    const b = useBuilder.getState()
    if (!confirmed && !b.editingCartItemId && !isDesignEmpty(b.design)) {
      // the roll on the counter isn't boxed yet — ask inline before replacing it
      setConfirmEdit(id)
      return
    }
    setConfirmEdit(null)
    useTool.getState().putBack()
    b.loadDesign(cloneDesign(item.design), item.id)
    const ui = useUI.getState()
    ui.setScreen('build')
    ui.setLidOpen(true)
    setOpen(false)
    ui.showToast(t.editing(rollTitle(item, items.indexOf(item))))
  }

  return (
    <>
      <div className="backdrop" onClick={() => setOpen(false)} />
      <aside className="cart" role="dialog" aria-modal="true" aria-label={t.yourBox}>
        <div className="head">
          <h2>{t.yourBox}</h2>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t.closeCart}>
            <Icon.Close />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="empty">
            <Swirl size={72} />
            <p>
              <b>{t.cartEmpty}</b>
              <br />
              {t.cartEmptySub}
            </p>
            <button className="btn primary" onClick={buildAnother}>
              {t.startBuilding}
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
                      <div className="qty" role="group" aria-label={t.quantity}>
                        <button aria-label={t.oneLess} onClick={() => (it.quantity > 1 ? useCart.getState().setQuantity(it.id, it.quantity - 1) : useCart.getState().remove(it.id))}>
                          <Icon.Minus />
                        </button>
                        <span aria-live="polite">{it.quantity}</span>
                        <button aria-label={t.oneMore} onClick={() => useCart.getState().setQuantity(it.id, it.quantity + 1)}>
                          <Icon.Plus />
                        </button>
                      </div>
                      <span className="dt" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                        {t.each(money(it.unitPrice))}
                      </span>
                      <span style={{ flex: 1 }} />
                      <button className="link-btn" onClick={() => edit(it.id)}>
                        {t.edit}
                      </button>
                      <button className="link-btn danger" onClick={() => (useCart.getState().remove(it.id), sfx.tap())}>
                        {t.removeItem}
                      </button>
                    </div>
                    {confirmEdit === it.id && (
                      <div className="note" role="alert" style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                        <span>{t.replaceQ}</span>
                        <span style={{ display: 'flex', gap: 8 }}>
                          <button className="btn small primary" onClick={() => edit(it.id, true)}>
                            {t.replaceYes}
                          </button>
                          <button className="btn small ghost" onClick={() => setConfirmEdit(null)}>
                            {t.replaceNo}
                          </button>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="foot">
              <div className="kv">
                <span>{t.subtotalRolls(totals.itemCount)}</span>
                <b>{money(totals.subtotal)}</b>
              </div>
              <div className="note">
                {totals.freeDeliveryRemaining > 0
                  ? t.freeDeliveryIn(money(totals.freeDeliveryRemaining), money(catalog.fulfillment.deliveryFee))
                  : t.freeDeliveryYes}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn ghost" style={{ flex: 1 }} onClick={buildAnother}>
                  {t.buildAnother}
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
                  {t.checkout} <Icon.ArrowRight width={18} height={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
