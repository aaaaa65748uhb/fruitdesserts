import * as THREE from "three";
import { formatILS } from "@/lib/format";
import { FRESHNESS_LABEL_HE } from "@/lib/freshness";
import { formatPackage } from "@/lib/units";
import type { FreshnessStatus, Product } from "@/lib/types";

/**
 * Generated artwork for the 3D store: placeholder packaging for products without a real photo (every such label
 * carries a small "איור" – illustration – mark), shelf price tags and hanging signs.
 */

const FONT = `"Rubik", "Assistant", "Segoe UI", "Arial Hebrew", Arial, sans-serif`;

export interface Atlas {
  texture: THREE.CanvasTexture;
  /** productId -> [u0, v0, du, dv] */
  rects: Map<string, [number, number, number, number]>;
  /** productId -> linear RGB colour for the sides of photo boxes (product atlases only). */
  sides?: Map<string, [number, number, number]>;
  /** Product ids whose cell holds a real photo (product atlases only). */
  photos?: Set<string>;
}

function luminance(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, weight = 700) {
  let px = startPx;
  do {
    ctx.font = `${weight} ${px}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 1;
  } while (px > 8);
  return px;
}

export function drawLabel(ctx: CanvasRenderingContext2D, p: Product, x: number, y: number, s: number) {
  const { color, accent, shape } = p.packaging;
  ctx.save();
  ctx.translate(x, y);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (shape === "produce") {
    const g = ctx.createRadialGradient(s * 0.35, s * 0.3, s * 0.05, s / 2, s / 2, s * 0.75);
    g.addColorStop(0, "#ffffff55");
    g.addColorStop(0.25, color);
    g.addColorStop(1, accent);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.restore();
    return;
  }

  // Body with soft vertical gradient
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, color);
  g.addColorStop(1, shade(color, -18));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  // Diagonal accent swoosh
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.62);
  ctx.quadraticCurveTo(s * 0.5, s * 0.5, s, s * 0.6);
  ctx.lineTo(s, s * 0.82);
  ctx.quadraticCurveTo(s * 0.5, s * 0.72, 0, s * 0.84);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Brand badge
  const onBody = luminance(color) > 150 ? "#111827" : "#ffffff";
  ctx.fillStyle = accent;
  roundRect(ctx, s * 0.14, s * 0.07, s * 0.72, s * 0.17, s * 0.08);
  ctx.fill();
  ctx.fillStyle = luminance(accent) > 150 ? "#111827" : "#ffffff";
  fitText(ctx, p.brand, s * 0.66, Math.round(s * 0.12), 800);
  ctx.fillText(p.brand, s / 2, s * 0.155);

  // Product name (up to 2 lines)
  ctx.fillStyle = onBody;
  const words = p.nameHe.split(" ");
  const lines: string[] = [];
  let cur = "";
  ctx.font = `800 ${Math.round(s * 0.16)}px ${FONT}`;
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > s * 0.88 && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 2);
  shown.forEach((line, i) => {
    fitText(ctx, line, s * 0.9, Math.round(s * 0.16), 800);
    ctx.fillText(line, s / 2, s * (shown.length === 1 ? 0.42 : 0.35 + i * 0.16));
  });

  // Size
  ctx.fillStyle = luminance(accent) > 150 ? "#111827" : "#ffffff";
  ctx.font = `600 ${Math.round(s * 0.09)}px ${FONT}`;
  ctx.fillText(formatPackage(p), s / 2, s * 0.73);

  // Illustration mark
  ctx.fillStyle = onBody;
  ctx.globalAlpha = 0.65;
  ctx.font = `500 ${Math.round(s * 0.06)}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("איור", s * 0.05, s * 0.94);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface TagInfo {
  productId: string;
  name: string;
  price?: number;
  freshness: FreshnessStatus;
}

/** Shelf-edge price tags. Prices come from the active offers and always show their data status. */
export function buildTagAtlas(tags: TagInfo[], cellW = 256, cellH = 96): Atlas {
  const cols = 8;
  const rows = Math.max(1, Math.ceil(tags.length / cols));
  const canvas = document.createElement("canvas");
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext("2d")!;
  const rects = new Map<string, [number, number, number, number]>();
  tags.forEach((t, i) => {
    const x = (i % cols) * cellW;
    const y = Math.floor(i / cols) * cellH;
    ctx.save();
    ctx.translate(x, y);
    ctx.direction = "rtl";
    ctx.fillStyle = t.freshness === "sample" ? "#fffbeb" : "#ffffff";
    ctx.fillRect(0, 0, cellW, cellH);
    ctx.fillStyle = t.freshness === "sample" ? "#f59e0b" : t.freshness === "unavailable" ? "#94a3b8" : "#047857";
    ctx.fillRect(0, 0, cellW, 10);
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    fitText(ctx, t.name, cellW * 0.5, 22, 600);
    ctx.fillText(t.name, cellW - 10, 36);
    ctx.font = `500 15px ${FONT}`;
    ctx.fillStyle = "#64748b";
    ctx.fillText(FRESHNESS_LABEL_HE[t.freshness], cellW - 10, 70);
    ctx.textAlign = "left";
    ctx.direction = "ltr";
    ctx.fillStyle = "#0f172a";
    const priceText = t.price !== undefined ? formatILS(t.price) : "—";
    fitText(ctx, priceText, cellW * 0.45, 40, 800);
    ctx.fillText(priceText, 10, 54);
    ctx.restore();
    rects.set(t.productId, [(i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows, 1 / cols, 1 / rows]);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, rects };
}

export function buildSignTexture(text: string, sub: string | undefined, color: string, width: number): THREE.CanvasTexture {
  const h = 160;
  const w = Math.round(h * (width / 0.9));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff22";
  ctx.fillRect(0, 0, w, 10);
  ctx.direction = "rtl";
  ctx.textBaseline = "middle";
  const isNumber = /^\d+$/.test(text);
  if (isNumber) {
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(w - h / 2, h / 2, h * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.font = `800 ${h * 0.42}px ${FONT}`;
    ctx.fillText(text, w - h / 2, h / 2 + 4);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    fitText(ctx, sub ?? "", w - h * 1.25, h * 0.36, 800);
    ctx.fillText(sub ?? "", w - h * 1.0, h / 2 + 2);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    fitText(ctx, text, w * 0.9, h * 0.42, 800);
    ctx.fillText(text, w / 2, sub ? h * 0.4 : h / 2);
    if (sub) {
      ctx.fillStyle = "#ffffffcc";
      fitText(ctx, sub, w * 0.9, h * 0.2, 500);
      ctx.fillText(sub, w / 2, h * 0.76);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
