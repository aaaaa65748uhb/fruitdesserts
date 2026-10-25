import * as THREE from "three";

/**
 * Procedural surface textures for the store building (floor, ceiling, shelving, cardboard, outdoors).
 * Everything is drawn on canvases at runtime, so the static build ships no extra image files for them.
 */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function finish(c: HTMLCanvasElement, opts: { repeat?: boolean; srgb?: boolean; anisotropy?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.anisotropy ?? 8;
  return t;
}

/** 2×2 large porcelain tiles (one texture repeat = 1.2 m) with subtle tone variation and grout. */
export function floorTexture(): THREE.CanvasTexture {
  const s = 1024;
  const [c, ctx] = canvas(s, s);
  const rnd = seeded(11);
  const half = s / 2;
  const tones = ["#e4e1da", "#e8e5de", "#dfdcd4", "#e6e3dc"];
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * half;
    const y = Math.floor(i / 2) * half;
    ctx.fillStyle = tones[i];
    ctx.fillRect(x, y, half, half);
    // soft mottling
    for (let k = 0; k < 900; k++) {
      ctx.globalAlpha = 0.05 + rnd() * 0.06;
      ctx.fillStyle = rnd() > 0.5 ? "#ffffff" : "#b9b3a6";
      const r = 2 + rnd() * 9;
      ctx.beginPath();
      ctx.arc(x + rnd() * half, y + rnd() * half, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // fine speckles
    for (let k = 0; k < 500; k++) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = ["#a8a196", "#c7c1b5", "#8f887c"][Math.floor(rnd() * 3)];
      ctx.fillRect(x + rnd() * half, y + rnd() * half, 1.5, 1.5);
    }
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#a9a397";
  ctx.lineWidth = 5;
  for (const p of [0, half, s]) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, s);
    ctx.moveTo(0, p);
    ctx.lineTo(s, p);
    ctx.stroke();
  }
  return finish(c, { anisotropy: 16 });
}

/** Roughness map matching the floor: polished tiles, rougher grout. */
export function floorRoughness(): THREE.CanvasTexture {
  const s = 256;
  const [c, ctx] = canvas(s, s);
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 3;
  for (const p of [0, s / 2, s]) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, s);
    ctx.moveTo(0, p);
    ctx.lineTo(s, p);
    ctx.stroke();
  }
  return finish(c, { srgb: false });
}

/** Suspended acoustic ceiling tiles (repeat = 1.2 m). */
export function ceilingTexture(): THREE.CanvasTexture {
  const s = 256;
  const [c, ctx] = canvas(s, s);
  const rnd = seeded(5);
  ctx.fillStyle = "#eef0f2";
  ctx.fillRect(0, 0, s, s);
  for (let k = 0; k < 1600; k++) {
    ctx.fillStyle = rnd() > 0.5 ? "#d9dde1" : "#f7f8f9";
    ctx.fillRect(rnd() * s, rnd() * s, 1.4, 1.4);
  }
  ctx.strokeStyle = "#b8bec6";
  ctx.lineWidth = 4;
  for (const p of [0, s / 2, s]) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, s);
    ctx.moveTo(0, p);
    ctx.lineTo(s, p);
    ctx.stroke();
  }
  return finish(c);
}

/** Perforated metal back panel of the shelving (pegboard). One repeat = 0.5 m. */
export function pegboardTexture(): THREE.CanvasTexture {
  const s = 128;
  const [c, ctx] = canvas(s, s);
  ctx.fillStyle = "#e3e6ea";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#aeb5be";
  const step = s / 10;
  for (let y = step / 2; y < s; y += step) {
    for (let x = step / 2; x < s; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return finish(c);
}

/** Corrugated cardboard with packing tape, for overstock boxes. */
export function cardboardTexture(): THREE.CanvasTexture {
  const s = 256;
  const [c, ctx] = canvas(s, s);
  const rnd = seeded(23);
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, "#c8975c");
  g.addColorStop(1, "#b9874f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  for (let k = 0; k < 2200; k++) {
    ctx.fillStyle = rnd() > 0.5 ? "#d4a46a" : "#a87843";
    ctx.globalAlpha = 0.35;
    ctx.fillRect(rnd() * s, rnd() * s, 2, 1);
  }
  ctx.globalAlpha = 1;
  // tape
  ctx.fillStyle = "#d9b98a";
  ctx.fillRect(s * 0.42, 0, s * 0.16, s);
  ctx.fillStyle = "#00000022";
  ctx.fillRect(s * 0.42, 0, 2, s);
  ctx.fillRect(s * 0.58 - 2, 0, 2, s);
  // printed marks
  ctx.strokeStyle = "#5b3a1c";
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.strokeRect(s * 0.08, s * 0.1, s * 0.26, s * 0.18);
  ctx.font = `bold ${s * 0.07}px Arial`;
  ctx.fillStyle = "#5b3a1c";
  ctx.fillText("SUPERIL", s * 0.66, s * 0.85);
  ctx.beginPath();
  ctx.moveTo(s * 0.72, s * 0.3);
  ctx.lineTo(s * 0.78, s * 0.18);
  ctx.lineTo(s * 0.84, s * 0.3);
  ctx.moveTo(s * 0.78, s * 0.18);
  ctx.lineTo(s * 0.78, s * 0.4);
  ctx.stroke();
  ctx.globalAlpha = 1;
  return finish(c, { repeat: false });
}

/** Rubber checkout conveyor belt. */
export function beltTexture(): THREE.CanvasTexture {
  const s = 64;
  const [c, ctx] = canvas(s, s);
  ctx.fillStyle = "#1f2328";
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = "#2b3036";
  for (let y = 0; y < s; y += 8) ctx.fillRect(0, y, s, 3);
  return finish(c);
}

/** Asphalt with faint aggregate, used outside the storefront. */
export function asphaltTexture(): THREE.CanvasTexture {
  const s = 256;
  const [c, ctx] = canvas(s, s);
  const rnd = seeded(31);
  ctx.fillStyle = "#5d6166";
  ctx.fillRect(0, 0, s, s);
  for (let k = 0; k < 5000; k++) {
    ctx.fillStyle = ["#6c7075", "#4f5358", "#777b80"][Math.floor(rnd() * 3)];
    ctx.fillRect(rnd() * s, rnd() * s, 1.5, 1.5);
  }
  return finish(c);
}

/** Paving stones for the sidewalk. */
export function pavingTexture(): THREE.CanvasTexture {
  const s = 128;
  const [c, ctx] = canvas(s, s);
  ctx.fillStyle = "#c9c5bd";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "#9f9a90";
  ctx.lineWidth = 2;
  for (let y = 0; y <= s; y += s / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s, y);
    ctx.stroke();
    const off = (y / (s / 4)) % 2 ? s / 4 : 0;
    for (let x = off; x <= s; x += s / 2) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + s / 4);
      ctx.stroke();
    }
  }
  return finish(c);
}

/** Vertical sky gradient for the backdrop seen through the storefront windows. */
export function skyTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(8, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#5aa8e6");
  g.addColorStop(0.55, "#a9d4f5");
  g.addColorStop(1, "#eef7ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  return finish(c, { repeat: false });
}

/** Radial soft shadow (alpha map), used as fake ambient occlusion under fixtures. */
export function softShadowTexture(): THREE.CanvasTexture {
  const s = 128;
  const [c, ctx] = canvas(s, s);
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return finish(c, { repeat: false, srgb: false });
}

/** Linear soft shadow (alpha map) for long fixtures: opaque centre line fading to both edges. */
export function stripShadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 4);
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, "#000000");
  g.addColorStop(0.35, "#ffffff");
  g.addColorStop(0.65, "#ffffff");
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 4);
  return finish(c, { repeat: false, srgb: false });
}

/** Cash register screen. */
export function posScreenTexture(lane: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 160);
  ctx.fillStyle = "#0b3b2e";
  ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = "#10b981";
  ctx.fillRect(0, 0, 256, 30);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Arial";
  ctx.fillText(`SUPERIL  ·  ${lane}`, 12, 22);
  ctx.font = "16px Arial";
  ctx.fillStyle = "#a7f3d0";
  for (let i = 0; i < 4; i++) ctx.fillRect(12, 44 + i * 22, 150 - i * 18, 10);
  ctx.fillStyle = "#fde68a";
  ctx.font = "bold 28px Arial";
  ctx.fillText("₪ 0.00", 120, 148);
  return finish(c, { repeat: false });
}
