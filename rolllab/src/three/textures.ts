import * as THREE from 'three'
import { brand } from '../config/brand'
import { createRng } from '../lib/noise'

/**
 * Procedural textures painted on <canvas> at start-up.
 * Everything is generated in code, so the site ships zero image assets and
 * there is nothing to license.
 */

export const DISPLAY_FONT = '"Fraunces Variable", "Suez One Hebrew", Georgia, serif'
export const UI_FONT = '"DM Sans Variable", "Rubik Hebrew", system-ui, sans-serif'

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  return { c, ctx }
}

function toTexture(c: HTMLCanvasElement, opts: { srgb?: boolean; repeat?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c)
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = opts.aniso ?? 8
  t.needsUpdate = true
  return t
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed = 1) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const rng = createRng(seed)
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

const memo = new Map<string, unknown>()
function once<T>(key: string, make: () => T): T {
  if (!memo.has(key)) memo.set(key, make())
  return memo.get(key) as T
}

/* ---------------- Countertop: light oak butcher block ---------------- */

export function woodTexture(size = 2048) {
  return once(`wood:${size}`, () => {
    const W = size
    const H = size
    const { c, ctx } = makeCanvas(W, H)
    const rng = createRng(42)
    const k = W / 2048
    const rows = 12
    const rh = H / rows
    for (let r = 0; r < rows; r++) {
      const y0 = r * rh
      // staggered butcher-block joints
      let x = -rng() * 600 * k
      while (x < W) {
        const len = (500 + rng() * 900) * k
        const hue = 30 + rng() * 6
        const sat = 38 + rng() * 14
        const lig = 67 + rng() * 9
        ctx.fillStyle = `hsl(${hue} ${sat}% ${lig}%)`
        ctx.fillRect(x, y0, len, rh)
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y0, len, rh)
        ctx.clip()
        // long grain
        for (let g = 0; g < 70; g++) {
          const gy = y0 + rng() * rh
          const amp = (1 + rng() * 4) * k
          const f = (0.002 + rng() * 0.006) / k
          const ph = rng() * 10
          const dark = rng() < 0.7
          ctx.strokeStyle = dark
            ? `rgba(${110 + rng() * 30},${70 + rng() * 20},${35 + rng() * 15},${0.05 + rng() * 0.13})`
            : `rgba(255,240,215,${0.05 + rng() * 0.12})`
          ctx.lineWidth = (0.6 + rng() * 2.4) * Math.max(0.6, k)
          ctx.beginPath()
          for (let px = x; px <= x + len; px += 16 * k) {
            const py = gy + Math.sin(px * f + ph) * amp + Math.sin(px * f * 3.3 + ph * 2) * amp * 0.3
            if (px === x) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          ctx.stroke()
        }
        // occasional cathedral figure
        if (rng() < 0.45) {
          const cx = x + len * (0.3 + rng() * 0.4)
          const cy = y0 + rh * (0.3 + rng() * 0.4)
          for (let g = 0; g < 7; g++) {
            ctx.strokeStyle = `rgba(120,78,40,${0.07 + rng() * 0.06})`
            ctx.lineWidth = 1 + rng() * 1.5
            ctx.beginPath()
            ctx.ellipse(cx, cy, (40 + g * 26 + rng() * 10) * k, (6 + g * 4) * k, 0, Math.PI * 0.05, Math.PI * 0.95)
            ctx.stroke()
          }
        }
        // small pores
        for (let g = 0; g < 160; g++) {
          ctx.fillStyle = `rgba(90,55,25,${0.08 + rng() * 0.12})`
          ctx.fillRect(x + rng() * len, y0 + rng() * rh, (2 + rng() * 5) * k, 1)
        }
        ctx.restore()
        // joint
        ctx.fillStyle = 'rgba(85,52,25,0.35)'
        ctx.fillRect(x + len - 1, y0, 2, rh)
        x += len
      }
      // row seam
      ctx.fillStyle = 'rgba(80,48,22,0.45)'
      ctx.fillRect(0, y0, W, 2)
      ctx.fillStyle = 'rgba(255,240,220,0.25)'
      ctx.fillRect(0, y0 + 2, W, 1)
    }
    grain(ctx, W, H, 10, 3)
    const map = toTexture(c, { repeat: true, aniso: 16 })
    return map
  })
}

/* ---------------- Back wall: hand-made cream tiles ---------------- */

export function tileTexture() {
  return once('tiles', () => {
    const W = 1024
    const H = 1024
    const { c, ctx } = makeCanvas(W, H)
    const rng = createRng(9)
    ctx.fillStyle = '#d9cbb3'
    ctx.fillRect(0, 0, W, H)
    const cols = 4
    const rows = 8
    const tw = W / cols
    const th = H / rows
    for (let r = 0; r < rows; r++) {
      for (let k = -1; k < cols; k++) {
        const x = k * tw + (r % 2 ? tw / 2 : 0)
        const y = r * th
        const l = 88 + rng() * 5
        const g = ctx.createLinearGradient(x, y, x + tw, y + th)
        g.addColorStop(0, `hsl(38 40% ${l}%)`)
        g.addColorStop(1, `hsl(36 35% ${l - 4}%)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(x + 5, y + 5, tw - 10, th - 10, 10)
        ctx.fill()
      }
    }
    grain(ctx, W, H, 6, 5)
    return toTexture(c, { repeat: true })
  })
}

/* ---------------- Dough crumb (bump) ---------------- */

export function doughBumpTexture() {
  return once('dough', () => {
    const S = 512
    const { c, ctx } = makeCanvas(S, S)
    const rng = createRng(77)
    ctx.fillStyle = 'rgb(128,128,128)'
    ctx.fillRect(0, 0, S, S)
    // soft lumps
    for (let i = 0; i < 900; i++) {
      const x = rng() * S
      const y = rng() * S
      const r = 6 + rng() * 26
      const v = rng() < 0.5 ? 255 : 0
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(${v},${v},${v},0.09)`)
      g.addColorStop(1, `rgba(${v},${v},${v},0)`)
      ctx.fillStyle = g
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        ctx.save()
        ctx.translate(ox, oy)
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
        ctx.restore()
      }
    }
    // stretch lines along the dough sheet
    for (let i = 0; i < 260; i++) {
      const y = rng() * S
      const x = rng() * S
      ctx.strokeStyle = `rgba(${rng() < 0.5 ? 255 : 30},${rng() < 0.5 ? 255 : 30},${rng() < 0.5 ? 255 : 30},0.06)`
      ctx.lineWidth = 1 + rng() * 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 30 + rng() * 80, y + (rng() - 0.5) * 6)
      ctx.stroke()
    }
    // pores
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(20,20,20,${0.25 + rng() * 0.3})`
      ctx.beginPath()
      ctx.ellipse(rng() * S, rng() * S, 0.6 + rng() * 2.2, 0.5 + rng() * 1.2, rng() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    grain(ctx, S, S, 22, 8)
    return toTexture(c, { repeat: true, srgb: false })
  })
}

/* ---------------- Cardboard & print ---------------- */

function kraft(ctx: CanvasRenderingContext2D, W: number, H: number, base: string, seed: number) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)
  const rng = createRng(seed)
  for (let i = 0; i < W * H * 0.0016; i++) {
    ctx.strokeStyle = rng() < 0.5 ? 'rgba(120,85,45,0.06)' : 'rgba(255,250,240,0.08)'
    ctx.lineWidth = 0.6 + rng()
    const x = rng() * W
    const y = rng() * H
    const a = rng() * Math.PI
    const l = 3 + rng() * 9
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
    ctx.stroke()
  }
  grain(ctx, W, H, 9, seed + 1)
}

export function drawSwirl(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, width: number) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  const turns = 2.6
  for (let i = 0; i <= 200; i++) {
    const t = i / 200
    const a = t * turns * Math.PI * 2
    const rr = r * (0.12 + 0.88 * t)
    const x = cx + Math.cos(a) * rr
    const y = cy + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  // centred letter-spaced text
  const widths = [...text].map((ch) => ctx.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1)
  let px = x - total / 2
  ctx.textAlign = 'left'
  ;[...text].forEach((ch, i) => {
    ctx.fillText(ch, px, y)
    px += widths[i] + spacing
  })
}

export function boxLidTopTexture() {
  return once('lidTop', () => {
    const S = 1024
    const { c, ctx } = makeCanvas(S, S)
    const P = brand.palette
    kraft(ctx, S, S, '#F2E4CA', 21)
    // pistachio band
    ctx.fillStyle = P.pistachio
    ctx.fillRect(0, S * 0.73, S, S * 0.11)
    ctx.fillStyle = '#F7EEDC'
    ctx.font = `700 34px ${UI_FONT}`
    ctx.textBaseline = 'middle'
    spaced(ctx, 'FRESH  ·  WARM  ·  MADE BY YOU', S / 2, S * 0.785, 6)
    // frame
    ctx.strokeStyle = P.cinnamon
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.roundRect(46, 46, S - 92, S - 92, 34)
    ctx.stroke()
    drawSwirl(ctx, S / 2, S * 0.3, 110, P.cinnamon, 26)
    ctx.fillStyle = P.cinnamonDeep
    ctx.textAlign = 'center'
    ctx.font = `900 150px ${DISPLAY_FONT}`
    ctx.fillText('ROLL LAB', S / 2, S * 0.56)
    ctx.font = `600 32px ${UI_FONT}`
    ctx.fillStyle = P.cinnamon
    spaced(ctx, 'CINNAMON ROLLS, BAKED TO YOUR RULES', S / 2, S * 0.65, 5)
    ctx.font = `500 26px ${UI_FONT}`
    spaced(ctx, 'EST. 2026', S / 2, S * 0.9, 8)
    return toTexture(c)
  })
}

export function boxInsideTexture() {
  return once('lidInside', () => {
    const S = 1024
    const { c, ctx } = makeCanvas(S, S)
    const P = brand.palette
    kraft(ctx, S, S, '#F6ECDA', 31)
    for (let y = 40; y < S; y += 120) {
      for (let x = (y / 120) % 2 ? 100 : 40; x < S; x += 130) {
        drawSwirl(ctx, x, y, 22, 'rgba(160,110,60,0.22)', 5)
      }
    }
    ctx.fillStyle = 'rgba(246,236,218,0.92)'
    ctx.beginPath()
    ctx.roundRect(S * 0.16, S * 0.36, S * 0.68, S * 0.28, 40)
    ctx.fill()
    ctx.fillStyle = P.cinnamonDeep
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `italic 600 92px ${DISPLAY_FONT}`
    ctx.fillText('Hello, gorgeous.', S / 2, S * 0.47)
    ctx.font = `600 30px ${UI_FONT}`
    ctx.fillStyle = P.cinnamon
    spaced(ctx, 'BUILT BY YOU · BAKED BY ROLL LAB', S / 2, S * 0.56, 4)
    return toTexture(c)
  })
}

export function boxSideTexture() {
  return once('boxSide', () => {
    const W = 1024
    const H = 128
    const { c, ctx } = makeCanvas(W, H)
    const P = brand.palette
    kraft(ctx, W, H, '#F2E4CA', 41)
    ctx.fillStyle = P.pistachio
    ctx.fillRect(0, H - 22, W, 10)
    ctx.fillStyle = P.cinnamon
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `900 54px ${DISPLAY_FONT}`
    ctx.fillText('ROLL LAB', W / 2, H * 0.44)
    drawSwirl(ctx, W / 2 - 190, H * 0.44, 18, P.cinnamon, 6)
    drawSwirl(ctx, W / 2 + 190, H * 0.44, 18, P.cinnamon, 6)
    return toTexture(c)
  })
}

export function plainCardboardTexture() {
  return once('cardPlain', () => {
    const S = 512
    const { c, ctx } = makeCanvas(S, S)
    kraft(ctx, S, S, '#EEDDBF', 51)
    return toTexture(c, { repeat: true })
  })
}

export function parchmentTexture() {
  return once('parchment', () => {
    const S = 1024
    const { c, ctx } = makeCanvas(S, S)
    ctx.fillStyle = '#F8F2E6'
    ctx.fillRect(0, 0, S, S)
    const rng = createRng(61)
    for (let i = 0; i < 700; i++) {
      ctx.strokeStyle = `rgba(190,165,120,${0.04 + rng() * 0.05})`
      ctx.lineWidth = 0.5 + rng()
      const x = rng() * S
      const y = rng() * S
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 60)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(176,128,78,0.16)'
    ctx.font = `700 22px ${UI_FONT}`
    ctx.textAlign = 'center'
    for (let y = 30; y < S; y += 92) {
      for (let x = (y / 92) % 2 ? 60 : 0; x < S + 60; x += 170) {
        ctx.fillText('ROLL LAB', x, y)
      }
    }
    grain(ctx, S, S, 7, 62)
    return toTexture(c, { repeat: true })
  })
}

export function stickerTexture() {
  return once('sticker', () => {
    const S = 512
    const { c, ctx } = makeCanvas(S, S)
    const P = brand.palette
    ctx.clearRect(0, 0, S, S)
    ctx.fillStyle = P.pistachio
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#F7EEDC'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, S / 2 - 30, 0, Math.PI * 2)
    ctx.stroke()
    drawSwirl(ctx, S / 2, S * 0.42, 62, '#F7EEDC', 16)
    ctx.fillStyle = '#F7EEDC'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `800 58px ${DISPLAY_FONT}`
    ctx.fillText('MADE', S / 2, S * 0.66)
    ctx.font = `700 34px ${UI_FONT}`
    spaced(ctx, 'BY YOU', S / 2, S * 0.76, 8)
    return toTexture(c)
  })
}

/* ---------------- Printed labels ---------------- */

export interface LabelSpec {
  title: string
  price: string
  accent: string
  kicker?: string
  /** Right-to-left layout (Hebrew). */
  rtl?: boolean
}

/** Wrap-around squeeze-bottle label. */
export function bottleLabelTexture(spec: LabelSpec) {
  return once(`bottle:${spec.title}:${spec.rtl ? 'r' : 'l'}`, () => {
    const W = 512
    const H = 320
    const { c, ctx } = makeCanvas(W, H)
    const P = brand.palette
    ctx.fillStyle = '#FBF5EA'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = spec.accent
    ctx.fillRect(0, 0, W, 54)
    ctx.fillRect(0, H - 22, W, 22)
    ctx.fillStyle = '#FBF5EA'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `800 30px ${UI_FONT}`
    spaced(ctx, 'ROLL LAB', W / 2, 29, 8)
    ctx.fillStyle = P.ink
    if (spec.rtl) ctx.direction = 'rtl'
    const words = spec.title.split(' ')
    ctx.font = `800 70px ${DISPLAY_FONT}`
    if (words.length > 1 && ctx.measureText(spec.title).width > W * 0.84) {
      ctx.font = `800 58px ${DISPLAY_FONT}`
      ctx.fillText(words.slice(0, -1).join(' '), W / 2, 112)
      ctx.fillText(words[words.length - 1], W / 2, 170)
    } else {
      ctx.fillText(spec.title, W / 2, 140)
    }
    ctx.fillStyle = P.cinnamon
    ctx.font = `700 50px ${UI_FONT}`
    ctx.fillText(spec.price, W / 2, 242)
    grain(ctx, W, H, 6, 4)
    return toTexture(c)
  })
}

/** Small printed card placed in front of trays / ramekins (mirrors for Hebrew). */
export function cardLabelTexture(spec: LabelSpec) {
  return once(`card:${spec.title}:${spec.kicker ?? ''}:${spec.price}:${spec.rtl ? 'r' : 'l'}`, () => {
    const W = 512
    const H = 208
    const { c, ctx } = makeCanvas(W, H)
    const P = brand.palette
    const rtl = !!spec.rtl
    ctx.fillStyle = '#FCF7EE'
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, 26)
    ctx.fill()
    ctx.fillStyle = spec.accent
    ctx.beginPath()
    ctx.roundRect(rtl ? W - 40 : 22, 26, 18, H - 52, 9)
    ctx.fill()
    ctx.textBaseline = 'middle'
    ctx.direction = rtl ? 'rtl' : 'ltr'
    const textX = rtl ? W - 62 : 62
    ctx.textAlign = rtl ? 'right' : 'left'
    ctx.fillStyle = P.cinnamon
    ctx.font = `700 28px ${UI_FONT}`
    ctx.fillText((spec.kicker ?? '').toUpperCase(), textX, 50)
    ctx.fillStyle = P.ink
    let size = 64
    ctx.font = `800 ${size}px ${UI_FONT}`
    while (ctx.measureText(spec.title).width > W - 210 && size > 36) {
      size -= 2
      ctx.font = `800 ${size}px ${UI_FONT}`
    }
    ctx.fillText(spec.title, textX, 122)
    ctx.direction = 'ltr'
    ctx.textAlign = rtl ? 'left' : 'right'
    ctx.fillStyle = P.cinnamonDeep
    ctx.font = `800 68px ${DISPLAY_FONT}`
    ctx.fillText(spec.price, rtl ? 26 : W - 26, 124)
    grain(ctx, W, H, 5, 12)
    return toTexture(c)
  })
}

/** Brushed stainless roughness map. */
export function brushedTexture() {
  return once('brushed', () => {
    const S = 512
    const { c, ctx } = makeCanvas(S, S)
    ctx.fillStyle = 'rgb(110,110,110)'
    ctx.fillRect(0, 0, S, S)
    const rng = createRng(88)
    for (let i = 0; i < 1600; i++) {
      const v = 70 + rng() * 120
      ctx.strokeStyle = `rgba(${v},${v},${v},0.35)`
      ctx.lineWidth = 0.5 + rng()
      const y = rng() * S
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(S, y + (rng() - 0.5) * 2)
      ctx.stroke()
    }
    return toTexture(c, { repeat: true, srgb: false })
  })
}
