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
import { nameOf, useLang, useT } from '../i18n'
import { interaction, quickAddTopping } from '../three/interaction'
import { scatterPieces } from '../three/Topping3D'
import { DoughSwatch, Icon, Swirl } from './icons'
import { Receipt } from './Receipt'
import { ChefPicksPanel } from './ChefPicks'

/* ------------------------------------------------------------------ */
/*  Language toggle                                                    */
/* ------------------------------------------------------------------ */

export function LangToggle() {
  const lang = useLang((s) => s.lang)
  const setLang = useLang((s) => s.setLang)
  const t = useT()
  return (
    <button
      className="lang-btn"
      onClick={() => {
        setLang(lang === 'he' ? 'en' : 'he')
        sfx.tap()
      }}
      aria-label={t.switchLabel}
      title={t.switchLabel}
      lang={lang === 'he' ? 'en' : 'he'}
    >
      {t.switchTo}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Top bar                                                            */
/* ------------------------------------------------------------------ */

export function TopBar({ showInspect = true, showPicks = false }: { showInspect?: boolean; showPicks?: boolean }) {
  const t = useT()
  const muted = useUI((s) => s.muted)
  const toggleMuted = useUI((s) => s.toggleMuted)
  const inspect = useUI((s) => s.inspect)
  const setInspect = useUI((s) => s.setInspect)
  const setCartOpen = useUI((s) => s.setCartOpen)
  const picksOpen = useUI((s) => s.picksOpen)
  const setPicksOpen = useUI((s) => s.setPicksOpen)
  const count = useCart((s) => s.items.reduce((a, i) => a + i.quantity, 0))
  const [bump, setBump] = useState(false)
  const prev = useRef(count)
  useEffect(() => {
    if (count > prev.current) {
      setBump(true)
      const tm = setTimeout(() => setBump(false), 600)
      prev.current = count
      return () => clearTimeout(tm)
    }
    prev.current = count
  }, [count])

  return (
    <header className="topbar">
      <div className="logo logo-pill" lang="en">
        <Swirl size={34} bg="#F4EAD9" />
        ROLL LAB
      </div>
      <div className="actions">
        {showPicks && (
          <button
            className={`pill-btn${picksOpen ? ' on' : ''}`}
            onClick={() => {
              interaction.cancel()
              setPicksOpen(!picksOpen)
              sfx.tap()
            }}
            aria-expanded={picksOpen}
          >
            <Icon.Sparkle />
            <span className="pill-label">{t.chefPicks}</span>
          </button>
        )}
        <LangToggle />
        {showInspect && (
          <button
            className={`icon-btn${inspect ? ' on' : ''}`}
            onClick={() => {
              interaction.cancel()
              setInspect(!inspect)
              sfx.tap()
            }}
            aria-pressed={inspect}
            title={inspect ? t.backToCounter : t.inspect}
            aria-label={inspect ? t.backToCounter : t.inspect}
          >
            <Icon.Orbit />
          </button>
        )}
        <button className="icon-btn" onClick={toggleMuted} aria-label={muted ? t.unmute : t.mute} title={muted ? t.unmute : t.mute}>
          {muted ? <Icon.SoundOff /> : <Icon.SoundOn />}
        </button>
        <button className="icon-btn" onClick={() => setCartOpen(true)} aria-label={t.openCart(count)} title={t.yourBox}>
          <Icon.Bag />
          {count > 0 && <span className={`badge${bump ? ' bump' : ''}`}>{count}</span>}
        </button>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/*  Tool controls — what's in your hand (lives inside the dock)        */
/* ------------------------------------------------------------------ */

const PATTERNS: { id: PourPattern; icon: keyof typeof Icon }[] = [
  { id: 'drizzle', icon: 'Drizzle' },
  { id: 'zigzag', icon: 'Zigzag' },
  { id: 'spiral', icon: 'Spiral' },
  { id: 'glaze', icon: 'Glaze' },
]
const FLOWS: Flow[] = ['thin', 'medium', 'thick']
const SPREADS: Spread[] = ['pinch', 'handful']

function AmountMeter({ portions, threshold, extra }: { portions: number; threshold: number; extra: number }) {
  const t = useT()
  const max = threshold * 1.6
  const lvl = amountLevel(portions, threshold)
  return (
    <div className="meter">
      <span>{t.amount}</span>
      <span className="bar">
        <i style={{ width: `${Math.min(100, (portions / max) * 100)}%`, background: lvl === 'extra' ? '#C9883F' : undefined }} />
        <span className="mark" style={{ insetInlineStart: `${(threshold / max) * 100}%` }} title={t.extraFrom} />
      </span>
      <span className={`lvl ${lvl}`}>{lvl === 'extra' ? t.extraPlus(money(extra)) : t.levels[lvl]}</span>
    </div>
  )
}

function ToolControls() {
  const t = useT()
  const held = useTool((s) => s.held)
  const pattern = useTool((s) => s.pattern)
  const flow = useTool((s) => s.flow)
  const spread = useTool((s) => s.spread)
  const overRoll = useTool((s) => s.overRoll)
  const active = useTool((s) => s.active)
  const design = useBuilder((s) => s.design)
  const tool = useTool.getState()
  if (!held) return null

  const putBack = (
    <button className="btn small ghost" onClick={() => interaction.cancel()} aria-label={t.putBack}>
      {t.putBack} <Icon.Close width={14} height={14} />
    </button>
  )
  const hint = (verb: string, toolName: string, activeText: string) => (
    <p className="tool-hint" aria-live="polite">
      <span className="pulse" />
      {active ? (
        <span>
          <b>{activeText}</b>
        </span>
      ) : overRoll ? (
        <span>
          <b>{t.pressHold}</b> {t.pressHoldTo(verb)}
        </span>
      ) : (
        <span>
          {t.moveOver(toolName)} <b>{t.pressHold}</b>
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
      <div className="tool-controls" role="region" aria-label={nameOf(s)}>
        <div className="tool-head">
          <span className="swatch" style={{ background: s.color }} />
          <div>
            <div className="title">
              {nameOf(s)} <span className="sub">· {money(s.price)}</span>
            </div>
            {hint(t.verbPour, t.toolBottle, auto ? t.pouringAuto : pattern === 'glaze' ? t.pouringGlaze : t.pouringFree)}
          </div>
          <span className="spacer" />
          {portions > 0 && <AmountMeter portions={portions} threshold={catalog.pricing.sauceExtraThreshold} extra={s.extraCharge} />}
          {putBack}
        </div>
        <div className="tool-row">
          <div className="chips" role="group" aria-label={t.patterns.drizzle}>
            {PATTERNS.map((p) => {
              const I = Icon[p.icon]
              return (
                <button key={p.id} className={`chip${pattern === p.id ? ' on' : ''}`} aria-pressed={pattern === p.id} onClick={() => (tool.setPattern(p.id), sfx.tap())}>
                  <I /> {t.patterns[p.id]}
                </button>
              )
            })}
          </div>
          <div className="chips" role="group" aria-label={t.flow}>
            <span className="label">{t.flow}</span>
            {FLOWS.map((f) => (
              <button key={f} className={`chip${flow === f ? ' on' : ''}`} aria-pressed={flow === f} onClick={() => (tool.setFlow(f), sfx.tap())}>
                {t.flows[f]}
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
      <div className="tool-controls" role="region" aria-label={nameOf(tp)}>
        <div className="tool-head">
          <span className="swatch" style={{ background: tp.bedColor }} />
          <div>
            <div className="title">
              {nameOf(tp)} <span className="sub">· {money(tp.price)} · {t.onYourRoll(count)}</span>
            </div>
            {hint(t.verbSprinkle, t.toolScoop, t.sprinkling)}
          </div>
          <span className="spacer" />
          {portions > 0 && <AmountMeter portions={portions} threshold={catalog.pricing.toppingExtraThreshold} extra={tp.extraCharge} />}
          {putBack}
        </div>
        <div className="tool-row">
          <div className="chips" role="group" aria-label={t.eachSprinkle}>
            <span className="label">{t.eachSprinkle}</span>
            {SPREADS.map((sp) => (
              <button key={sp} className={`chip${spread === sp ? ' on' : ''}`} aria-pressed={spread === sp} onClick={() => (tool.setSpread(sp), sfx.tap())}>
                {t.spreads[sp]}
              </button>
            ))}
          </div>
          <div className="chips">
            <button className="chip" onClick={() => quickAddTopping(tp.id, scatterPieces(tp, Math.round(tp.portion * 0.5)))} disabled={count >= tp.maxPieces}>
              <Icon.Sparkle /> {t.scatter}
            </button>
            {count > 0 && (
              <button className="chip" onClick={() => (useBuilder.getState().removeToppingPieces(tp.id, Math.max(1, Math.round(tp.portion / 3))), sfx.tap())}>
                <Icon.Minus /> {t.less}
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
            {nameOf(f)} <span className="sub">· {money(f.price)}</span>
          </div>
          <p className="tool-hint">
            <span className="pulse" /> {t.pipeHint}
          </p>
        </div>
      </div>
    </div>
  ) : null
}

/* ------------------------------------------------------------------ */
/*  Coach marks (first visit)                                          */
/* ------------------------------------------------------------------ */

function rememberCoached() {
  try {
    localStorage.setItem('rolllab-coached', '1')
  } catch {
    /* ignore */
  }
}

function Coach() {
  const t = useT()
  const hint = useUI((s) => s.hint)
  const setHint = useUI((s) => s.setHint)
  const held = useTool((s) => s.held)
  const design = useBuilder((s) => s.design)
  const steps: Record<string, number> = { pick: 1, pour: 2, review: 3 }
  useEffect(() => {
    if (!hint) return
    if (hint === 'pick' && held) setHint('pour')
    if (hint === 'pour' && (design.sauces.length > 0 || design.toppings.length > 0)) {
      setHint('review')
      setTimeout(() => {
        if (useUI.getState().hint === 'review') useUI.getState().setHint(null)
        rememberCoached()
      }, 5000)
    }
  }, [hint, held, design, setHint])
  if (!hint || !(hint in steps)) return null
  return (
    <div className="coach" role="status">
      <span className="num">{steps[hint]}</span>
      <span>{t.coach[hint as keyof typeof t.coach]}</span>
      <button
        aria-label={t.dismissTips}
        onClick={() => {
          setHint(null)
          rememberCoached()
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
    if (prev.current !== total) setTick((x) => x + 1)
    prev.current = total
  }, [total])
  return (
    <span key={tick} className={`v${tick ? ' tick' : ''}`}>
      {money(total)}
    </span>
  )
}

function Dock() {
  const t = useT()
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
    useUI.getState().showToast(t.resetToast)
    sfx.drop()
  }
  const review = () => {
    interaction.cancel()
    useUI.getState().setReceiptOpen(false)
    useUI.getState().setScreen('review')
    sfx.tap()
  }

  return (
    <nav className={`dock${held ? ' holding' : ''}`} aria-label="ROLL LAB">
      {held ? (
        <div className="dough-wrap">
          <ToolControls />
        </div>
      ) : (
        <div className="dough-wrap">
          <div className="dock-section-title">{t.chooseDough}</div>
          <div className="dough-row" role="radiogroup" aria-label={t.gDough}>
            {catalog.bases.map((b) => (
              <button
                key={b.id}
                className={`dough${design.baseId === b.id ? ' on' : ''}`}
                role="radio"
                aria-checked={design.baseId === b.id}
                onClick={() => setBase(b.id)}
              >
                <DoughSwatch dough={b.colors.dough} crust={b.colors.crust} filling={b.colors.filling} />
                <span>
                  <span className="name">{nameOf(b)}</span>
                  <span className="price">{money(b.price)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="dock-actions">
        <button className="icon-btn" onClick={undo} disabled={!canUndo} aria-label={t.undo} title={t.undo}>
          <Icon.Undo />
        </button>
        <button className="icon-btn" onClick={reset} aria-label={t.reset} title={t.reset}>
          <Icon.Reset />
        </button>
      </div>
      <div className="dock-price">
        <button className="price-btn" onClick={() => setReceiptOpen(!receiptOpen)} aria-expanded={receiptOpen} aria-label={t.totalAria(money(quote.total))}>
          <span className="k">{receiptOpen ? t.hideReceipt : t.totalReceipt}</span>
          <PriceTicker total={quote.total} />
        </button>
        <button className="btn primary" onClick={review}>
          {editing ? t.reviewChanges : t.review} <Icon.ArrowRight width={18} height={18} />
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
      <TopBar showPicks={!inspect} />
      {!inspect && <Coach />}
      {receiptOpen && <Receipt />}
      <ChefPicksPanel />
      <Dock />
    </>
  )
}
