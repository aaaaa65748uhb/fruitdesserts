import { computeQuote } from '../engine/pricing'
import { cloneDesign } from '../engine/customization'
import { useBuilder } from '../store/builderStore'
import { useCart } from '../store/cartStore'
import { useUI } from '../store/uiStore'
import { sfx } from '../lib/audio'
import { runtime } from '../three/runtime'
import { tr } from '../i18n'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

let running = false

/**
 * The packing choreography: snapshot → lid closes → seal sticker (+ ribbon)
 * → the box slides off to the cart → a new box arrives with a fresh roll.
 */
export async function packAndAddToCart() {
  if (running) return
  running = true
  try {
    const ui = useUI.getState()
    const builder = useBuilder.getState()
    const design = cloneDesign(builder.design)
    const total = computeQuote(design).total
    const thumbnail = runtime.snapshot ? await runtime.snapshot() : null
    const editingId = builder.editingCartItemId

    ui.setScreen('build')
    ui.setReceiptOpen(false)
    ui.setPackPhase('closing')
    sfx.box(false)
    await wait(1050)
    useUI.getState().setPackPhase('sealed')
    sfx.sticker()
    await wait(950)
    if (editingId) useCart.getState().replace(editingId, design, total, thumbnail)
    else useCart.getState().add(design, total, thumbnail)
    useUI.getState().setPackPhase('leaving')
    sfx.chime()
    await wait(900)
    useUI.getState().setLidOpen(false)
    useBuilder.getState().startNewRoll()
    useUI.getState().setPackPhase('arriving')
    await wait(1000)
    useUI.getState().setPackPhase('idle')
    await wait(250)
    useUI.getState().setLidOpen(true)
    sfx.box(true)
    useUI.getState().showToast(editingId ? tr().cartUpdated : tr().boxed, 'success')
    await wait(500)
    useUI.getState().setCartOpen(true)
  } finally {
    running = false
  }
}
