import { useUI } from '../store/uiStore'

/**
 * Tiny synthesized sound kit (Web Audio API).
 * No audio files — every sound is generated, so nothing to license or load.
 * Sounds are deliberately soft; the mute button silences everything.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (useUI.getState().muted) return null
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
    const len = ctx.sampleRate * 1.5
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Call from a user gesture (e.g. the start button) so browsers allow audio. */
export function unlockAudio() {
  audio()
}

function env(g: GainNode, t: number, attack: number, peak: number, decay: number) {
  g.gain.cancelScheduledValues(t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', glideTo?: number, delay = 0) {
  const c = audio()
  if (!c || !master) return
  const t = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur)
  env(g, t, 0.005, vol, dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function noiseBurst(dur: number, vol: number, filterType: BiquadFilterType, freq: number, q = 1, delay = 0) {
  const c = audio()
  if (!c || !master || !noiseBuffer) return
  const t = c.currentTime + delay
  const src = c.createBufferSource()
  src.buffer = noiseBuffer
  src.playbackRate.value = 0.8 + Math.random() * 0.4
  const f = c.createBiquadFilter()
  f.type = filterType
  f.frequency.value = freq
  f.Q.value = q
  const g = c.createGain()
  env(g, t, 0.004, vol, dur)
  src.connect(f).connect(g).connect(master)
  src.start(t, Math.random() * 1.2)
  src.stop(t + dur + 0.05)
}

export const sfx = {
  /** Soft wooden tap — UI clicks, selection. */
  tap() {
    tone(720, 0.07, 0.08, 'sine', 420)
    noiseBurst(0.03, 0.04, 'bandpass', 2400, 2)
  },
  /** Plastic lift — picking up a bottle or scoop. */
  pick() {
    tone(380, 0.09, 0.07, 'triangle', 620)
    noiseBurst(0.05, 0.05, 'highpass', 3000)
  },
  /** Setting something back down. */
  drop() {
    tone(240, 0.12, 0.09, 'sine', 140)
    noiseBurst(0.05, 0.05, 'lowpass', 900)
  },
  /** Bouncy pop — swapping the dough. */
  pop() {
    tone(300, 0.16, 0.1, 'sine', 760)
    tone(900, 0.08, 0.03, 'triangle', 1200, 0.05)
  },
  /** Creamy squish — filling. */
  squish() {
    noiseBurst(0.22, 0.09, 'lowpass', 700, 4)
    tone(180, 0.2, 0.05, 'sine', 120)
  },
  /** Tiny crumbs landing. */
  sprinkle(intensity = 1) {
    const n = Math.min(5, 1 + Math.round(intensity * 2))
    for (let i = 0; i < n; i++) {
      noiseBurst(0.018, 0.035 + Math.random() * 0.03, 'bandpass', 3800 + Math.random() * 3000, 3, i * 0.018 + Math.random() * 0.01)
    }
  },
  /** Cardboard flap. */
  box(open: boolean) {
    noiseBurst(0.16, 0.12, 'lowpass', open ? 900 : 600, 1.2)
    tone(open ? 140 : 110, 0.18, 0.12, 'sine', open ? 90 : 70)
  },
  /** Sticker slap. */
  sticker() {
    noiseBurst(0.06, 0.08, 'bandpass', 1600, 1.5)
    tone(520, 0.08, 0.04, 'triangle', 300)
  },
  /** Pleasant two-note chime — added to cart. */
  chime() {
    tone(659, 0.35, 0.07, 'sine')
    tone(988, 0.5, 0.06, 'sine', undefined, 0.11)
    tone(1318, 0.5, 0.025, 'triangle', undefined, 0.11)
  },
  /** Error / limit reached. */
  nope() {
    tone(220, 0.12, 0.06, 'triangle', 180)
    tone(196, 0.14, 0.05, 'triangle', 160, 0.1)
  },
}

/* ---------------- Continuous pour loop ---------------- */

let pourSrc: AudioBufferSourceNode | null = null
let pourGain: GainNode | null = null
let pourFilter: BiquadFilterNode | null = null
let lfo: OscillatorNode | null = null

export function startPour(thickness = 0.5) {
  const c = audio()
  if (!c || !master || !noiseBuffer || pourSrc) return
  const t = c.currentTime
  pourSrc = c.createBufferSource()
  pourSrc.buffer = noiseBuffer
  pourSrc.loop = true
  pourFilter = c.createBiquadFilter()
  pourFilter.type = 'bandpass'
  pourFilter.frequency.value = 520 - thickness * 220
  pourFilter.Q.value = 3.5
  pourGain = c.createGain()
  pourGain.gain.setValueAtTime(0.0001, t)
  pourGain.gain.exponentialRampToValueAtTime(0.11, t + 0.08)
  // slow wobble gives a glossy "squeeze" texture
  lfo = c.createOscillator()
  lfo.frequency.value = 5.5
  const lfoGain = c.createGain()
  lfoGain.gain.value = 140
  lfo.connect(lfoGain).connect(pourFilter.frequency)
  pourSrc.connect(pourFilter).connect(pourGain).connect(master)
  pourSrc.start()
  lfo.start()
  // squeeze click
  tone(160, 0.08, 0.06, 'sine', 110)
}

export function stopPour() {
  if (!ctx || !pourSrc || !pourGain) return
  const t = ctx.currentTime
  pourGain.gain.cancelScheduledValues(t)
  pourGain.gain.setValueAtTime(pourGain.gain.value, t)
  pourGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  const s = pourSrc
  const l = lfo
  s.stop(t + 0.15)
  l?.stop(t + 0.15)
  pourSrc = null
  pourGain = null
  pourFilter = null
  lfo = null
}

useUI.subscribe((s, prev) => {
  if (s.muted && !prev.muted) stopPour()
})
