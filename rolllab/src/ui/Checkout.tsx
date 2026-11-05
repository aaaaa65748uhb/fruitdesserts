import { useMemo, useState } from 'react'
import { brand } from '../config/brand'
import { catalog } from '../config/catalog'
import { summarizeDesign } from '../engine/customization'
import { computeCartTotals } from '../engine/pricing'
import { useCart } from '../store/cartStore'
import { useUI } from '../store/uiStore'
import { money } from '../lib/format'
import { sfx } from '../lib/audio'
import { validateCheckout, type FormErrors } from '../lib/validation'
import { buildOrder, orderText, pickupAddress, rollTitle, slotLabel } from '../checkout/order'
import { useT } from '../i18n'
import { paymentProvider } from '../checkout/paymentProvider'
import type { CheckoutForm, OrderPayload } from '../types'
import { Icon } from './icons'
import { TopBar } from './UIControls'

type Stage = { kind: 'form' } | { kind: 'not_configured'; order: OrderPayload } | { kind: 'error'; message: string }

export function Checkout() {
  const t = useT()
  const items = useCart((s) => s.items)
  const form = useCart((s) => s.form)
  const update = useCart((s) => s.updateForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof CheckoutForm, boolean>>>({})
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: 'form' })
  const totals = computeCartTotals(items, form.method)
  const liveErrors = useMemo(() => validateCheckout(form), [form])

  const back = () => {
    useUI.getState().setScreen('build')
    sfx.tap()
  }

  const err = (k: keyof CheckoutForm) => {
    const key = touched[k] || errors[k] ? liveErrors[k] : undefined
    return key ? t.errors[key] : undefined
  }
  const blur = (k: keyof CheckoutForm) => () => setTouched((t) => ({ ...t, [k]: true }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = validateCheckout(form)
    setErrors(v)
    setTouched({ name: true, phone: true, street: true, city: true, pickupSlot: true, notes: true })
    if (Object.keys(v).length) {
      sfx.nope()
      const first = document.querySelector<HTMLElement>('.input.err, .textarea.err')
      first?.focus()
      return
    }
    if (!items.length) return
    setBusy(true)
    const order = buildOrder(items, form)
    const res = await paymentProvider.start(order)
    setBusy(false)
    if (res.status === 'redirect') {
      window.location.assign(res.url)
    } else if (res.status === 'not_configured') {
      setStage({ kind: 'not_configured', order })
    } else {
      setStage({ kind: 'error', message: res.message })
    }
  }

  if (stage.kind === 'not_configured') return <NotConfigured order={stage.order} onBack={() => setStage({ kind: 'form' })} />

  return (
    <div className="checkout">
      <TopBar showInspect={false} />
      <form className="checkout-inner" onSubmit={submit} noValidate>
        <section className="card">
          <button type="button" className="link-btn" onClick={back} style={{ padding: 0, marginBottom: 12 }}>
            {t.back}
          </button>
          <p className="kicker">{t.step4}</p>
          <h2>{t.almostYours}</h2>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">{t.fullName}</span>
              <input
                className={`input${err('name') ? ' err' : ''}`}
                autoComplete="name"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                onBlur={blur('name')}
                aria-invalid={!!err('name')}
              />
              {err('name') && <span className="err-msg">{err('name')}</span>}
            </label>
            <label className="field">
              <span className="field-label">{t.phone}</span>
              <input
                className={`input${err('phone') ? ' err' : ''}`}
                type="tel"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                placeholder="050-123-4567"
                value={form.phone}
                onChange={(e) => update({ phone: e.target.value })}
                onBlur={blur('phone')}
                aria-invalid={!!err('phone')}
              />
              {err('phone') && <span className="err-msg">{err('phone')}</span>}
            </label>

            <div className="field full">
              <span className="field-label">{t.howGet}</span>
              <div className="segmented" role="radiogroup" aria-label={t.howGet}>
                <button type="button" role="radio" aria-checked={form.method === 'pickup'} className={`seg${form.method === 'pickup' ? ' on' : ''}`} onClick={() => update({ method: 'pickup' })}>
                  <b>{t.pickup}</b>
                  <span>{t.pickupSub(pickupAddress())}</span>
                </button>
                <button type="button" role="radio" aria-checked={form.method === 'delivery'} className={`seg${form.method === 'delivery' ? ' on' : ''}`} onClick={() => update({ method: 'delivery' })}>
                  <b>{t.delivery}</b>
                  <span>{t.deliverySub(money(catalog.fulfillment.deliveryFee), money(catalog.fulfillment.freeDeliveryOver))}</span>
                </button>
              </div>
            </div>

            {form.method === 'delivery' ? (
              <>
                <label className="field full">
                  <span className="field-label">{t.street}</span>
                  <input
                    className={`input${err('street') ? ' err' : ''}`}
                    autoComplete="street-address"
                    value={form.street}
                    onChange={(e) => update({ street: e.target.value })}
                    onBlur={blur('street')}
                    aria-invalid={!!err('street')}
                  />
                  {err('street') && <span className="err-msg">{err('street')}</span>}
                </label>
                <label className="field">
                  <span className="field-label">{t.city}</span>
                  <input
                    className={`input${err('city') ? ' err' : ''}`}
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={(e) => update({ city: e.target.value })}
                    onBlur={blur('city')}
                    aria-invalid={!!err('city')}
                  />
                  {err('city') && <span className="err-msg">{err('city')}</span>}
                </label>
                <label className="field">
                  <span className="field-label">{t.apartment}</span>
                  <input className="input" value={form.apartment} onChange={(e) => update({ apartment: e.target.value })} />
                </label>
              </>
            ) : (
              <label className="field full">
                <span className="field-label">{t.pickupTime}</span>
                <select className="select" value={form.pickupSlot} onChange={(e) => update({ pickupSlot: e.target.value })}>
                  {catalog.fulfillment.pickupSlots.map((s) => (
                    <option key={s} value={s}>
                      {slotLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field full">
              <span className="field-label">{t.notes}</span>
              <textarea
                className={`textarea${err('notes') ? ' err' : ''}`}
                maxLength={400}
                placeholder={t.notesPlaceholder}
                value={form.notes}
                onChange={(e) => update({ notes: e.target.value })}
                onBlur={blur('notes')}
              />
              {err('notes') && <span className="err-msg">{err('notes')}</span>}
            </label>
          </div>
        </section>

        <aside className="card">
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 24, margin: '0 0 8px' }}>{t.summary}</h3>
          {items.length === 0 && <p className="empty-note">{t.emptyCartNote}</p>}
          {items.map((it, i) => (
            <div className="summary-item" key={it.id}>
              {it.thumbnail ? <img src={it.thumbnail} alt="" /> : <div className="ph" />}
              <div>
                <div className="n">
                  {it.quantity}× {rollTitle(it, i)}
                </div>
                <div className="s">{summarizeDesign(it.design)}</div>
              </div>
              <b>{money(it.unitPrice * it.quantity)}</b>
            </div>
          ))}
          <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
            <div className="kv">
              <span>{t.subtotal}</span>
              <b>{money(totals.subtotal)}</b>
            </div>
            <div className="kv">
              <span>{form.method === 'delivery' ? t.delivery : t.pickup}</span>
              <b>{totals.deliveryFee ? money(totals.deliveryFee) : t.free}</b>
            </div>
          </div>
          <div className="summary-total">
            <span>{t.total}</span>
            <span className="v">{money(totals.total)}</span>
          </div>

          {!paymentProvider.configured && (
            <div className="pay-placeholder" style={{ marginTop: 16 }}>
              <span className="tag">{t.payNotConnected}</span>
              <div>{t.payNotConnectedBody(!!brand.orderWhatsApp)}</div>
            </div>
          )}
          {stage.kind === 'error' && (
            <p className="err-msg" role="alert" style={{ marginTop: 12 }}>
              {stage.message}
            </p>
          )}
          <button className="btn primary big" type="submit" disabled={busy || items.length === 0} style={{ width: '100%', marginTop: 16 }}>
            {busy ? t.preparing : paymentProvider.configured ? t.pay(money(totals.total)) : t.continue}
            {!busy && <Icon.ArrowRight width={20} height={20} />}
          </button>
        </aside>
      </form>
    </div>
  )
}

function NotConfigured({ order, onBack }: { order: OrderPayload; onBack: () => void }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const text = orderText(order)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      sfx.tap()
    } catch {
      setCopied(false)
    }
  }
  const download = () => {
    const blob = new Blob([JSON.stringify(order, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${order.reference}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <div className="checkout">
      <TopBar showInspect={false} />
      <div className="result">
        <div className="card">
          <div className="pay-placeholder">
            <span className="tag">{t.placeholderTag}</span>
            <div>
              <b>{t.placeholderBody(!!brand.orderWhatsApp).split('. ')[0]}.</b>{' '}
              {t.placeholderBody(!!brand.orderWhatsApp).split('. ').slice(1).join('. ')}
            </div>
          </div>
          <p className="ref" style={{ marginTop: 18 }}>
            {t.orderDraft(order.reference)}
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--ui)', fontSize: 14, lineHeight: 1.5, background: 'var(--paper-2)', border: '1.5px solid var(--line)', borderRadius: 14, padding: 14 }}>
            {text}
          </pre>
          <div className="btns">
            <button className="btn ghost" onClick={onBack}>
              {t.backToCheckout}
            </button>
            <button className="btn" onClick={copy}>
              {copied ? (
                <>
                  <Icon.Check width={16} height={16} /> {t.copied}
                </>
              ) : (
                t.copyOrder
              )}
            </button>
            <button className="btn" onClick={download}>
              {t.downloadOrder}
            </button>
            {brand.orderWhatsApp && (
              <a
                className="btn pistachio"
                href={`https://wa.me/${brand.orderWhatsApp}?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noreferrer"
              >
                {t.sendWhatsApp}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
