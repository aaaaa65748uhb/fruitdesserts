import { useEffect, useMemo, useRef, useState } from 'react'
import { catalog, findFilling, findSauce, findTopping } from '../config/catalog'
import { computeQuote } from '../engine/pricing'
import { amountLevel, isDesignEmpty, saucePortions, toppingCount, toppingPortions } from '../engine/customization'
import { useBuilder } from '../store/builderStore'
import { useCart } from '../store/cartStore'
import { useTool, type Flow, type PourPattern, type Spread } from '../store/toolStore'
import { useUI } from '../store/uiStore'
import { money } from '../lib/format'
import { sfx } from '../lib/audio'
import { interaction, quickAddTopping } from '../three/interaction'
import { scatterPieces } from '../three/Topping3D'
import { DoughSwatch, Icon, Swirl } from './icons'
import { Receipt } from './Receipt'

/* ------------------------------------------------------------------ */
/*  Top bar                                                            */
/* ------------------------------------------------------------------ */

export function TopBar({ showInspect = true }: { showInspect?: boolean }) {
  const muted = useUI((s) => s.muted)
  const toggleMuted = useUI((s) => s.toggleMuted)
  const inspect = useUI((s) => s.inspect)
  const setInspect = useUI((s) => s.setInspect)
  const setCartOpen = useUI((s) => s.setCartOpen)
  const count = useCart((s) => s.items.reduce((a, i) => a + i.quantity, 0))
  const [bump, setBump] = useState(false)
  const prev = useRef(count)
  useEffect(() => {
    if (count > prev.current) {
      setBump(true)
      const t = setTimeout(() => setBump(false), 600)
      prev.current = count
      return () => clearTimeout(t)
    }
    prev.current = count
  }, [count])

  return (
    <header className="topbar">
      <div className="logo logo-pill">
        <Swirl size={34} bg="#F4EAD9" />
        ROLL LAB
      </div>
      <div className="actions">
        {showInspect && (
          <button
            className={`icon-btn${inspect ? ' on' : ''}`}
            onClick={() => {
              interaction.cancel()
              setInspect(!inspect)
              sfx.tap()
            }}
            aria-pressed={inspect}
            title={inspect ? 'Back to the counter' : 'Inspect your roll in 3D'}
            aria-label={inspect ? 'Back to the counter' : 'Inspect your roll in 3D'}
          >
            <Icon.Orbit />
          </button>
        )}
        <button className="icon-btn" onClick={toggleMuted} aria-label={muted ? 'Unmute sounds' : 'Mute sounds'} title={muted ? 'Sound off' : 'Sound on'}>
          {muted ? <Icon.SoundOff /> : <Icon.SoundOn />}
        </button>
        <button className="icon-btn" onClick={() => setCartOpen(true)} aria-label={`Open cart, ${count} items`} title="Your cart">
          <Icon.Bag />
          {count > 0 && <span className={`badge${bump ? ' bump' : ''}`}>{count}</span>}
        </button>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/*  Tool card — what's in your hand                                    */
/* ------------------------------------------------------------------ */

const PATTERNS: { id: PourPattern; label: string; icon: keyof typeof Icon }[] = [
  { id: 'drizzle', label: 'Drizzle', icon: 'Drizzle' },
  { id: 'zigzag', label: 'Zigzag', icon: 'Zigzag' },
  { id: 'spiral', label: 'Swirl', icon: 'Spiral' },
  { id: 'glaze', label: 'Glaze', icon: 'Glaze' },
]
const FLOWS: { id: Flow; label: string }[] = [
  { id: 'thin', label: 'Thin' },
  { id: 'medium', label: 'Medium' },
  { id: 'thick', label: 'Thick' },
]
const SPREADS: { id: Spread; label: string }[] = [
  { id: 'pinch', label: 'Pinch' },
  { id: 'handful', label: 'Handful' },
]

function AmountMeter({ portions, threshold, extra }: { portions: number; threshold: number; extra: number }) {
  const max = threshold * 1.6
  const lvl = amountLevel(portions, threshold)
  return (
    <div className="meter">
      <span>Amount</span>
      <span className="bar">
        <i style={{ width: `${Math.min(100, (portions / max) * 100)}%`, background: lvl === 'extra' ? '#C9883F' : undefined }} />
        <span className="mark" style={{ left: `${(threshold / max) * 100}%` }} title="Extra charge from here" />
      </span>
      <span className={`lvl ${lvl}`}>
        {lvl === 'extra' ? `Extra +${money(extra)}` : lvl === 'light' ? 'Light' : 'Regular'}
      </span>
    </div>
  )
}

function ToolControls() {
  const held = useTool((s) => s.held)
  const pattern = useTool((s) => s.pattern)
  const flow = useTool((s) => s.flow)
  const spread = useTool((s) => s.spread)
  const overRoll = useTool((s) => s.overRoll)
  const active = useTool((s) => s.active)
  const design = useBuilder((s) => s.design)
  const t = useTool.getState()
  if (!held) return null

  const putBack = (
    <button className="btn small ghost" onClick={() => interaction.cancel()} aria-label="Put it back">
      Put back <Icon.Close width={14} height={14} />
    </button>
  )
  const hint = (verb: string, tool: string, activeText: string) => (
    <p className="tool-hint" aria-live="polite">
      <span className="pulse" />
      {active ? (
        <span>
          <b>{activeText}</b>
        </span>
      ) : overRoll ? (
        <span>
          <b>Press &amp; hold</b> to {verb}
        </span>
      ) : (
        <span>
          Move the {tool} over the roll, then <b>press &amp; hold</b>
        </span>
      )}
    </p>
  )

  if (held.kind === 'sauce') {
    const s = findSauce(held.id)
    if (!s) return null
    const portions = saucePortions(design, s.id)
    const auto = pattern === 'zigzag' || pattern === 'spiral'
    return (
      <div className="tool-controls" role="region" aria-label={`Holding ${s.name}`}>
        <div className="tool-head">
          <span className="swatch" style={{ background: s.color }} />
          <div>
            <div className="title">
              {s.name} <span className="sub">· {money(s.price)}</span>
            </div>
            {hint('pour', 'bottle', auto ? 'Pouring… keep holding to finish the pattern' : pattern === 'glaze' ? 'Glazing… hold to spread it' : 'Pouring… move to drizzle, hold still to pool')}
          </div>
          <span className="spacer" />
          {portions > 0 && <AmountMeter portions={portions} threshold={catalog.pricing.sauceExtraThreshold} extra={s.extraCharge} />}
          {putBack}
        </div>
        <div className="tool-row">
          <div className="chips" role="group" aria-label="Pour pattern">
            {PATTERNS.map((p) => {
              const I = Icon[p.icon]
              return (
                <button key={p.id} className={`chip${pattern === p.id ? ' on' : ''}`} aria-pressed={pattern === p.id} onClick={() => (t.setPattern(p.id), sfx.tap())}>
                  <I /> {p.label}
                </button>
              )
            })}
          </div>
          <div className="chips" role="group" aria-label="Flow">
            <span className="label">Flow</span>
            {FLOWS.map((f) => (
              <button key={f.id} className={`chip${flow === f.id ? ' on' : ''}`} aria-pressed={flow === f.id} onClick={() => (t.setFlow(f.id), sfx.tap())}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (held.kind === 'topping') {
    const tp = findTopping(held.id)
    if (!tp) return null
    const portions = toppingPortions(design, tp.id)
    const count = toppingCount(design, tp.id)
    return (
      <div className="tool-controls" role="region" aria-label={`Holding ${tp.name}`}>
        <div className="tool-head">
          <span className="swatch" style={{ background: tp.bedColor }} />
          <div>
            <div className="title">
              {tp.name} <span className="sub">· {money(tp.price)} · {count} on your roll</span>
            </div>
            {hint('sprinkle', 'scoop', 'Sprinkling… move around to cover the roll')}
          </div>
          <span className="spacer" />
          {portions > 0 && <AmountMeter portions={portions} threshold={catalog.pricing.toppingExtraThreshold} extra={tp.extraCharge} />}
          {putBack}
        </div>
        <div className="tool-row">
          <div className="chips" role="group" aria-label="Sprinkle amount">
            <span className="label">Each sprinkle</span>
            {SPREADS.map((sp) => (
              <button key={sp.id} className={`chip${spread === sp.id ? ' on' : ''}`} aria-pressed={spread === sp.id} onClick={() => (t.setSpread(sp.id), sfx.tap())}>
                {sp.label}
              </button>
            ))}
          </div>
          <div className="chips">
            <button className="chip" onClick={() => quickAddTopping(tp.id, scatterPieces(tp, Math.round(tp.portion * 0.5)))} disabled={count >= tp.maxPieces}>
              <Icon.Sparkle /> Scatter evenly
            </button>
            {count > 0 && (
              <button className="chip" onClick={() => (useBuilder.getState().removeToppingPieces(tp.id, Math.max(1, Math.round(tp.portion / 3))), sfx.tap())}>
                <Icon.Minus /> Less
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const f = findFilling(held.id)
  return f ? (
    <div className="tool-controls">
      <div className="tool-head">
        <span className="swatch" style={{ background: f.color }} />
        <div>
          <div className="title">
            {f.name} <span className="sub">· {money(f.price)}</span>
          </div>
          <p className="tool-hint">
            <span className="pulse" /> Drop the piping bag on the roll — it’s rolled into every layer
          </p>
        </div>
      </div>
    </div>
  ) : null
}

/* ------------------------------------------------------------------ */
/*  Coach marks (first visit)                                          */
/* ------------------------------------------------------------------ */

function Coach() {
  const hint = useUI((s) => s.hint)
  const setHint = useUI((s) => s.setHint)
  const held = useTool((s) => s.held)
  const design = useBuilder((s) => s.design)
  const steps: Record<string, { n: number; text: string }> = {
    pick: { n: 1, text: 'Click a sauce bottle or an ingredient tray to pick it up' },
    pour: { n: 2, text: 'Now press & hold on the roll — drag to drizzle' },
    review: { n: 3, text: 'Looking good! Spin it by dragging, or tap Review when ready' },
  }
  useEffect(() => {
    if (!hint) return
    if (hint === 'pick' && held) setHint('pour')
    if (hint === 'pour' && (design.sauces.length > 0 || design.toppings.length > 0)) {
      setHint('review')
      setTimeout(() => {
        if (useUI.getState().hint === 'review') useUI.getState().setHint(null)
        try {
          localStorage.setItem('rolllab-coached', '1')
        } catch {
          /* ignore */
        }
      }, 5000)
    }
  }, [hint, held, design, setHint])
  if (!hint || !steps[hint]) return null
  const s = steps[hint]
  return (
    <div className="coach" role="status">
      <span className="num">{s.n}</span>
      <span>{s.text}</span>
      <button
        aria-label="Dismiss tips"
        onClick={() => {
          setHint(null)
          try {
            localStorage.setItem('rolllab-coached', '1')
          } catch {
            /* ignore */
          }
        }}
      >
        ×
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Bottom dock                                                        */
/* ------------------------------------------------------------------ */

function PriceTicker({ total }: { total: number }) {
  const [tick, setTick] = useState(0)
  const prev = useRef(total)
  useEffect(() => {
    if (prev.current !== total) setTick((t) => t + 1)
    prev.current = total
  }, [total])
  return (
    <span key={tick} className={`v${tick ? ' tick' : ''}`}>
      {money(total)}
    </span>
  )
}

function Dock() {
  const design = useBuilder((s) => s.design)
  const canUndo = useBuilder((s) => s.past.length > 0)
  const quote = useMemo(() => computeQuote(design), [design])
  const receiptOpen = useUI((s) => s.receiptOpen)
  const setReceiptOpen = useUI((s) => s.setReceiptOpen)
  const editing = useBuilder((s) => s.editingCartItemId)
  const held = useTool((s) => s.held)

  const setBase = (id: string) => {
    if (id === design.baseId) return
    useBuilder.getState().setBase(id)
    sfx.pop()
  }
  const undo = () => {
    interaction.cancel()
    useBuilder.getState().undo()
    sfx.tap()
  }
  const reset = () => {
    interaction.cancel()
    if (isDesignEmpty(design)) return
    useBuilder.getState().reset()
    useUI.getState().showToast('Fresh start — tap Undo to bring it back')
    sfx.drop()
  }
  const review = () => {
    interaction.cancel()
    useUI.getState().setReceiptOpen(false)
    useUI.getState().setScreen('review')
    sfx.tap()
  }

  return (
    <nav className={`dock${held ? ' holding' : ''}`} aria-label="Roll controls">
      {held ? (
        <div className="dough-wrap">
          <ToolControls />
        </div>
      ) : (
      <div className="dough-wrap">
        <div className="dock-section-title">1 · Choose your dough</div>
        <div className="dough-row" role="radiogroup" aria-label="Dough">
          {catalog.bases.map((b) => (
            <button
              key={b.id}
              className={`dough${design.baseId === b.id ? ' on' : ''}`}
              role="radio"
              aria-checked={design.baseId === b.id}
              onClick={() => setBase(b.id)}
              title={b.description}
            >
              <DoughSwatch dough={b.colors.dough} crust={b.colors.crust} filling={b.colors.filling} />
              <span>
                <span className="name">{b.name}</span>
                <span className="price">{money(b.price)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      )}
      <div className="dock-actions">
        <button className="icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo">
          <Icon.Undo />
        </button>
        <button className="icon-btn" onClick={reset} aria-label="Reset roll" title="Start over">
          <Icon.Reset />
        </button>
      </div>
      <div className="dock-price">
        <button
          className="price-btn"
          onClick={() => setReceiptOpen(!receiptOpen)}
          aria-expanded={receiptOpen}
          aria-label={`Total ${money(quote.total)}. Show price breakdown`}
        >
          <span className="k">{receiptOpen ? 'Hide receipt' : 'Total · receipt'}</span>
          <PriceTicker total={quote.total} />
        </button>
        <button className="btn primary" onClick={review}>
          {editing ? 'Review changes' : 'Review'} <Icon.ArrowRight width={18} height={18} />
        </button>
      </div>
    </nav>
  )
}

export function UIControls() {
  const receiptOpen = useUI((s) => s.receiptOpen)
  const inspect = useUI((s) => s.inspect)
  const packPhase = useUI((s) => s.packPhase)
  if (packPhase !== 'idle') return <TopBar showInspect={false} />
  return (
    <>
      <TopBar />
      {!inspect && <Coach />}
      {receiptOpen && <Receipt />}
      <Dock />
    </>
  )
}
