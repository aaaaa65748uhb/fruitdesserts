import { PRODUCT_PHOTOS } from "@/data/product-photos";
import type { CategoryId, Product } from "@/lib/types";

/**
 * Pure layout of the 3D supermarket (meters; y up; the entrance is at +z, the back wall at -z).
 * Everything here is deterministic and free of Three.js so it can be unit-tested.
 */

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BoxSpec {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
}

/**
 * box/cyl: generated label artwork; photo: box with the real front photo; round: lathe model shaped from the
 * photo's silhouette (bottles, cans, jars, tubs); produce: procedural fruit & vegetable models.
 */
export type GeometryGroup = "box" | "cyl" | "sphere" | "photo" | "round" | "produce";

export interface Facing {
  pos: [number, number, number];
  rotY: number;
  scale: [number, number, number];
}

/** A block of identical facings of one product on one shelf level (or one produce crate). */
export interface ProductBlock {
  index: number;
  productId: string;
  group: GeometryGroup;
  facings: Facing[];
  /** Bounding box used for cheap ray picking. */
  bounds: { min: [number, number, number]; max: [number, number, number] };
  /** Where the shelf price tag goes (null for produce, which uses a sign). */
  tag: { pos: [number, number, number]; rotY: number; scale?: [number, number] } | null;
  /** Rows behind the front facing (rendering only): count and offset per row. */
  depth: { rows: number; step: [number, number] };
  /** A good place to stand to look at this block. */
  viewpoint: { x: number; z: number; yaw: number; pitch: number };
  zoneLabel: string;
}

export interface Sign {
  text: string;
  sub?: string;
  pos: [number, number, number];
  rotY: number;
  width: number;
  color: string;
  doubleSided: boolean;
}

export interface MapRect extends AABB {
  kind: "gondola" | "fridge" | "wall-shelf" | "produce" | "checkout" | "corral" | "endcap";
  color: string;
}

export type BoxMaterial = "metal" | "white" | "wood" | "dark" | "accent" | "glass" | "glow" | "peg" | "card" | "rail" | "chrome" | "crate";

/** A ceiling light fixture (long fluorescent/LED batten). */
export interface LightFixture {
  pos: [number, number, number];
  length: number;
  rotY: number;
}

export interface Checkout {
  x: number;
  z0: number;
  z1: number;
  lane: number;
}

export interface StoreLayout {
  bounds: AABB;
  colliders: AABB[];
  mapRects: MapRect[];
  blocks: ProductBlock[];
  signs: Sign[];
  boxes: Record<BoxMaterial, BoxSpec[]>;
  spawn: { x: number; z: number; yaw: number };
  aisles: { number: number; label: string; category: CategoryId; x: number }[];
  zones: { id: string; label: string; x: number; z: number; yaw: number }[];
  lights: LightFixture[];
  checkouts: Checkout[];
  /** Storefront (z = bounds.maxZ): glass between these x ranges, the door gap in the middle. */
  storefront: { windows: [number, number][]; door: [number, number] };
}

export const STORE_BOUNDS: AABB = { minX: -31, maxX: 31, minZ: -30, maxZ: 32 };
export const EYE_HEIGHT = 1.62;
export const PLAYER_RADIUS = 0.3;

const GONDOLA_XS = [-24, -18, -12, -6, 0, 6, 12, 18, 24];
const GONDOLA_HALF_DEPTH = 0.65;
const SECTION = 1.4;
const TOP_SHELF = 1.84;
const RUN_Z0 = -22;
const RUN_Z1 = 6;
const SHELF_LEVELS = [0.12, 0.55, 0.98, 1.41];
const FRIDGE_LEVELS = [0.3, 0.75, 1.2, 1.65];
/** Products are stocked up to this many rows deep (only the front row is interactive). */
export const MAX_DEPTH_ROWS = 4;

const CARE_IDS = new Set(["shampoo-hawaii", "head-shoulders", "toothpaste-colgate", "deodorant-dove", "soap-hands"]);

export const AISLES: { number: number; label: string; category: CategoryId; filter?: (p: Product) => boolean }[] = [
  { number: 1, label: "חטיפים וממתקים", category: "snacks" },
  { number: 2, label: "משקאות", category: "drinks" },
  { number: 3, label: "פסטה, אורז וקטניות", category: "pasta-rice" },
  { number: 4, label: "שימורים, רטבים ותבלינים", category: "canned-sauces" },
  { number: 5, label: "בוקר, קפה ואפייה", category: "breakfast-baking" },
  { number: 6, label: "ניקיון וכביסה", category: "cleaning-care", filter: (p) => !CARE_IDS.has(p.id) },
  { number: 7, label: "טיפוח אישי", category: "cleaning-care", filter: (p) => CARE_IDS.has(p.id) },
  { number: 8, label: "מוצרים לבית", category: "home" },
];

/** Approximate size (m) of one fruit/vegetable along its short axis, for the produce models. */
const PRODUCE_SIZE: Record<string, number> = {
  tomatoes: 0.075, cucumbers: 0.09, onions: 0.075, potatoes: 0.075, carrots: 0.1, "peppers-red": 0.085, bananas: 0.11,
  "apples-pink": 0.078, oranges: 0.08, avocado: 0.075, lemons: 0.065, lettuce: 0.15,
};

/** Physical size of a facing [width along shelf, height, depth]. With a photo, the width follows its aspect ratio. */
export function productDims(p: Product): { group: GeometryGroup; w: number; h: number; d: number } {
  const base = packagingDims(p);
  const photo = PRODUCT_PHOTOS[p.id];
  if (!photo || base.group === "sphere") return base.group === "sphere" ? { ...base, group: "produce" } : base;
  const w = Math.min(base.h * 2.2, Math.max(base.h * 0.25, base.h * photo.aspect));
  if (photo.cutout && photo.profile && base.group === "cyl") return { group: "round", w, h: base.h, d: w };
  return { group: "photo", w, h: base.h, d: base.d };
}

function packagingDims(p: Product): { group: GeometryGroup; w: number; h: number; d: number } {
  const { shape } = p.packaging;
  const grams = p.packageUnit === "kg" ? p.packageSize * 1000 : p.packageUnit === "g" ? p.packageSize : 0;
  const ml = p.packageUnit === "l" ? p.packageSize * 1000 : p.packageUnit === "ml" ? p.packageSize : 0;
  const multi = (p.multipack ?? 1) > 1;
  switch (shape) {
    case "bottle": {
      if (multi) return { group: "box", w: 0.27, h: 0.33, d: 0.18 }; // shrink-wrapped pack of bottles
      if (ml >= 3000) return { group: "cyl", w: 0.15, h: 0.3, d: 0.15 };
      if (ml >= 1400) return { group: "cyl", w: 0.092, h: 0.32, d: 0.092 };
      if (ml >= 700) return { group: "cyl", w: 0.08, h: 0.27, d: 0.08 };
      return { group: "cyl", w: 0.066, h: 0.2, d: 0.066 };
    }
    case "can":
      return multi ? { group: "box", w: 0.2, h: 0.125, d: 0.135 } : { group: "cyl", w: 0.066, h: 0.125, d: 0.066 };
    case "jar":
      return { group: "cyl", w: 0.085, h: 0.13, d: 0.085 };
    case "tub":
      return multi ? { group: "box", w: 0.2, h: 0.09, d: 0.07 } : { group: "cyl", w: 0.095, h: 0.075, d: 0.095 };
    case "carton":
      return { group: "box", w: 0.075, h: 0.23, d: 0.075 };
    case "roll":
      return { group: "box", w: 0.36, h: 0.32, d: 0.24 };
    case "loaf":
      return { group: "box", w: 0.26, h: 0.12, d: 0.12 };
    case "bag":
      if (grams >= 1000) return { group: "box", w: 0.17, h: 0.25, d: 0.09 };
      if (multi) return { group: "box", w: 0.24, h: 0.27, d: 0.1 };
      return { group: "box", w: 0.2, h: 0.28, d: 0.08 };
    case "produce": {
      const r = PRODUCE_SIZE[p.id] ?? 0.085;
      return { group: "sphere", w: r, h: r, d: r };
    }
    case "box":
    default:
      if (grams > 0 && grams <= 110) return { group: "box", w: 0.13, h: 0.18, d: 0.03 };
      if (grams >= 600) return { group: "box", w: 0.23, h: 0.33, d: 0.08 };
      if (p.category === "cleaning-care" && grams >= 2000) return { group: "box", w: 0.3, h: 0.3, d: 0.17 };
      return { group: "box", w: 0.19, h: 0.26, d: 0.07 };
  }
}

interface Face {
  origin: [number, number]; // x,z of the face line start
  dir: [number, number]; // unit vector along the face
  normal: [number, number]; // unit vector pointing to the aisle
  length: number;
  levels: number[];
  shelfDepth: number;
  products: Product[];
  colWidth: number;
  zoneLabel: string;
}

/** Deterministic pseudo-random value in [-1, 1] for produce piles. */
function jitter(a: number, b: number, c: number) {
  const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

function rotYForNormal(nx: number, nz: number) {
  return Math.atan2(nx, nz);
}

function fillFace(face: Face, blocks: ProductBlock[]) {
  if (!face.products.length) return;
  const margin = 0.2;
  const usable = face.length - margin * 2;
  const cols = Math.max(1, Math.floor(usable / face.colWidth));
  const colW = usable / cols;
  const pairs = face.levels.length >= 4 ? 2 : 1;
  const levelsPerPair = face.levels.length / pairs;
  const rotY = rotYForNormal(face.normal[0], face.normal[1]);
  let k = 0;
  for (let c = 0; c < cols; c++) {
    for (let pair = 0; pair < pairs; pair++) {
      const product = face.products[k++ % face.products.length];
      const dims = productDims(product);
      for (let li = 0; li < levelsPerPair; li++) {
        const level = face.levels[pair * levelsPerPair + li];
        const n = Math.max(1, Math.floor((colW - 0.06) / (dims.w + 0.015)));
        const used = n * (dims.w + 0.015) - 0.015;
        const startS = margin + c * colW + (colW - used) / 2 + dims.w / 2;
        const inset = dims.d / 2 + 0.03;
        const facings: Facing[] = [];
        const min: [number, number, number] = [Infinity, level, Infinity];
        const max: [number, number, number] = [-Infinity, level + dims.h, -Infinity];
        for (let i = 0; i < n; i++) {
          const s = startS + i * (dims.w + 0.015);
          const x = face.origin[0] + face.dir[0] * s - face.normal[0] * inset;
          const z = face.origin[1] + face.dir[1] * s - face.normal[1] * inset;
          facings.push({
            pos: [x, level + dims.h / 2, z],
            rotY,
            scale: [dims.w, dims.h, dims.d],
          });
          const hw = Math.abs(face.dir[0]) * dims.w / 2 + Math.abs(face.normal[0]) * dims.d / 2;
          const hd = Math.abs(face.dir[1]) * dims.w / 2 + Math.abs(face.normal[1]) * dims.d / 2;
          min[0] = Math.min(min[0], x - hw);
          max[0] = Math.max(max[0], x + hw);
          min[2] = Math.min(min[2], z - hd);
          max[2] = Math.max(max[2], z + hd);
        }
        const step = dims.d + 0.012;
        const rows = Math.max(1, Math.min(MAX_DEPTH_ROWS, Math.floor((face.shelfDepth - 0.04) / step)));
        const midS = margin + c * colW + colW / 2;
        const tagX = face.origin[0] + face.dir[0] * midS + face.normal[0] * 0.012;
        const tagZ = face.origin[1] + face.dir[1] * midS + face.normal[1] * 0.012;
        blocks.push({
          index: blocks.length,
          productId: product.id,
          group: dims.group,
          facings,
          bounds: { min, max },
          tag: { pos: [tagX, Math.max(0.05, level - 0.035), tagZ], rotY },
          depth: { rows, step: [-face.normal[0] * step, -face.normal[1] * step] },
          viewpoint: {
            x: face.origin[0] + face.dir[0] * midS + face.normal[0] * 1.6,
            z: face.origin[1] + face.dir[1] * midS + face.normal[1] * 1.6,
            yaw: rotY, // camera yaw whose forward vector is -normal (looking at the shelf)
            pitch: Math.atan2(level + dims.h / 2 - EYE_HEIGHT, 1.6),
          },
          zoneLabel: face.zoneLabel,
        });
      }
    }
  }
}

function byCategory(products: Product[], cat: CategoryId, filter?: (p: Product) => boolean) {
  return products.filter((p) => p.category === cat && (!filter || filter(p)));
}

/** Splits a list in two halves, so the two faces of an aisle show different products. */
function halves<T>(list: T[]): [T[], T[]] {
  if (list.length < 2) return [list, list];
  const a: T[] = [];
  const b: T[] = [];
  list.forEach((x, i) => (i % 2 === 0 ? a : b).push(x));
  return [a, b];
}

/** Glass doors with dark frames and chrome handles along a refrigerated wall. */
function fridgeDoors(boxes: StoreLayout["boxes"], origin: [number, number], dir: [number, number], normal: [number, number], length: number) {
  const at = (s: number, out: number): [number, number] => [origin[0] + dir[0] * s + normal[0] * out, origin[1] + dir[1] * s + normal[1] * out];
  const along = (w: number, h: number, t: number): [number, number, number] => [Math.abs(dir[0]) * w + Math.abs(normal[0]) * t, h, Math.abs(dir[1]) * w + Math.abs(normal[1]) * t];
  const doors = Math.max(1, Math.round(length / 1.4));
  const doorW = length / doors;
  const [mx, mz] = at(length / 2, 0.03);
  boxes.glass.push({ pos: [mx, 1.26, mz], size: along(length, 2.0, 0.015), color: "#dbeafe" });
  for (const y of [0.25, 2.27]) boxes.dark.push({ pos: [mx, y, mz], size: along(length, 0.05, 0.06), color: "#2b3036" });
  for (let i = 0; i <= doors; i++) {
    const [px, pz] = at(i * doorW, 0.03);
    boxes.dark.push({ pos: [px, 1.26, pz], size: along(0.06, 2.06, 0.06), color: "#2b3036" });
    if (i < doors) {
      const [hx, hz] = at(i * doorW + doorW - 0.13, 0.08);
      boxes.chrome.push({ pos: [hx, 1.25, hz], size: along(0.025, 0.85, 0.025), color: "#e5e7eb" });
    }
  }
  const [lx, lz] = at(length / 2, -0.15);
  boxes.glow.push({ pos: [lx, 2.2, lz], size: along(length, 0.03, 0.05), color: "#ffffff" });
}

/** Cardboard stock boxes stacked on top of a gondola run (deterministic). */
function overstock(boxes: StoreLayout["boxes"], x: number, z0: number, z1: number, depth: number, seed: number) {
  let s = 1 + seed * 7919;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const tints = ["#ffffff", "#f3e9dc", "#e9dccb", "#fff7ed"];
  let z = z0 + 0.3;
  while (z < z1 - 0.5) {
    if (rnd() < 0.18) {
      z += 0.6 + rnd() * 0.8; // gap
      continue;
    }
    const w = 0.42 + rnd() * 0.3;
    const h = 0.26 + rnd() * 0.2;
    const d = Math.min(depth, 0.45 + rnd() * 0.35);
    const zc = z + w / 2;
    boxes.card.push({ pos: [x + (rnd() - 0.5) * 0.06, TOP_SHELF + h / 2, zc], size: [d, h, w], color: tints[Math.floor(rnd() * tints.length)] });
    if (rnd() < 0.4) {
      const h2 = 0.2 + rnd() * 0.15;
      boxes.card.push({ pos: [x + (rnd() - 0.5) * 0.08, TOP_SHELF + h + h2 / 2, zc + (rnd() - 0.5) * 0.08], size: [d * 0.9, h2, w * 0.85], color: tints[Math.floor(rnd() * tints.length)] });
    }
    z += w + 0.04 + rnd() * 0.1;
  }
}

export function buildStoreLayout(products: Product[]): StoreLayout {
  const blocks: ProductBlock[] = [];
  const colliders: AABB[] = [];
  const mapRects: MapRect[] = [];
  const signs: Sign[] = [];
  const boxes: StoreLayout["boxes"] = { metal: [], white: [], wood: [], dark: [], accent: [], glass: [], glow: [], peg: [], card: [], rail: [], chrome: [], crate: [] };
  const lights: LightFixture[] = [];
  const checkouts: Checkout[] = [];
  const b = STORE_BOUNDS;

  // ── Outer walls (thin colliders just outside the floor) ──
  colliders.push(
    { minX: b.minX - 1, maxX: b.minX, minZ: b.minZ - 1, maxZ: b.maxZ + 1 },
    { minX: b.maxX, maxX: b.maxX + 1, minZ: b.minZ - 1, maxZ: b.maxZ + 1 },
    { minX: b.minX - 1, maxX: b.maxX + 1, minZ: b.minZ - 1, maxZ: b.minZ },
    { minX: b.minX - 1, maxX: b.maxX + 1, minZ: b.maxZ, maxZ: b.maxZ + 1 },
  );

  // ── Gondolas (double-sided shelving) + end caps ──
  const aisleProducts = AISLES.map((a) => byCategory(products, a.category, a.filter));
  const bakery = byCategory(products, "bakery");
  const drinks = byCategory(products, "drinks");
  const runLen = RUN_Z1 - RUN_Z0;

  GONDOLA_XS.forEach((gx, gi) => {
    const zMid = (RUN_Z0 + RUN_Z1) / 2;
    // Structure: perforated back panel, uprights at every section, metal shelves with white price strips, kick plate.
    boxes.peg.push({ pos: [gx, 1.0, zMid], size: [0.05, 2.0, runLen], color: "#ffffff" });
    for (let z = RUN_Z0; z <= RUN_Z1 + 1e-6; z += SECTION) boxes.dark.push({ pos: [gx, 1.01, z], size: [0.12, 2.02, 0.05], color: "#4b5563" });
    boxes.dark.push({ pos: [gx, 0.06, zMid], size: [GONDOLA_HALF_DEPTH * 2, 0.12, runLen], color: "#4b5563" });
    for (const lvl of [...SHELF_LEVELS.slice(1), TOP_SHELF]) {
      boxes.metal.push({ pos: [gx, lvl - 0.012, zMid], size: [GONDOLA_HALF_DEPTH * 2 - 0.02, 0.024, runLen], color: "#d9dde3" });
    }
    for (const lvl of SHELF_LEVELS) {
      for (const side of [-1, 1]) {
        boxes.rail.push({ pos: [gx + side * (GONDOLA_HALF_DEPTH + 0.004), lvl - 0.03, zMid], size: [0.008, 0.046, runLen], color: "#f8fafc" });
      }
    }
    overstock(boxes, gx, RUN_Z0, RUN_Z1, GONDOLA_HALF_DEPTH * 2 - 0.1, gi);
    colliders.push({ minX: gx - GONDOLA_HALF_DEPTH, maxX: gx + GONDOLA_HALF_DEPTH, minZ: RUN_Z0 - 0.75, maxZ: RUN_Z1 + 0.75 });
    mapRects.push({ minX: gx - GONDOLA_HALF_DEPTH, maxX: gx + GONDOLA_HALF_DEPTH, minZ: RUN_Z0, maxZ: RUN_Z1, kind: "gondola", color: "#94a3b8" });

    // West face (normal -x): aisle gi (1-based) or bakery corridor for the first gondola
    const westProducts = gi === 0 ? halves(bakery)[1] : halves(aisleProducts[gi - 1])[1];
    const westLabel = gi === 0 ? "מאפייה" : `מעבר ${gi} – ${AISLES[gi - 1].label}`;
    fillFace(
      { origin: [gx - GONDOLA_HALF_DEPTH, RUN_Z0], dir: [0, 1], normal: [-1, 0], length: runLen, levels: SHELF_LEVELS, shelfDepth: 0.6, products: westProducts, colWidth: 1.35, zoneLabel: westLabel },
      blocks,
    );
    // East face (normal +x): aisle gi+1 or cold drinks corridor for the last gondola
    const eastProducts = gi === GONDOLA_XS.length - 1 ? halves(drinks)[0] : halves(aisleProducts[gi])[0];
    const eastLabel = gi === GONDOLA_XS.length - 1 ? "משקאות" : `מעבר ${gi + 1} – ${AISLES[gi].label}`;
    fillFace(
      { origin: [gx + GONDOLA_HALF_DEPTH, RUN_Z0], dir: [0, 1], normal: [1, 0], length: runLen, levels: SHELF_LEVELS, shelfDepth: 0.6, products: eastProducts, colWidth: 1.35, zoneLabel: eastLabel },
      blocks,
    );

    // End caps on both ends, featuring products from a neighboring aisle
    const capSource = aisleProducts[Math.min(gi, AISLES.length - 1)];
    for (const end of [-1, 1] as const) {
      const zEdge = end < 0 ? RUN_Z0 : RUN_Z1;
      const zc = zEdge + end * 0.35;
      boxes.peg.push({ pos: [gx, 1.0, zEdge + end * 0.04], size: [1.3, 2.0, 0.06], color: "#ffffff" });
      boxes.dark.push({ pos: [gx, 0.1, zc], size: [1.3, 0.2, 0.6], color: "#4b5563" });
      for (const side of [-1, 1]) boxes.dark.push({ pos: [gx + side * 0.63, 1.05, zc], size: [0.04, 2.1, 0.6], color: "#4b5563" });
      for (const lvl of [0.8, 1.25, 1.7]) boxes.metal.push({ pos: [gx, lvl - 0.012, zc], size: [1.24, 0.024, 0.58], color: "#d9dde3" });
      for (const lvl of [0.35, 0.8, 1.25, 1.7]) boxes.rail.push({ pos: [gx, lvl - 0.03, zc + end * 0.295], size: [1.24, 0.046, 0.008], color: "#fef3c7" });
      boxes.accent.push({ pos: [gx, 2.18, zc], size: [1.3, 0.3, 0.6], color: "#dc2626" });
      mapRects.push({ minX: gx - 0.65, maxX: gx + 0.65, minZ: Math.min(zEdge, zEdge + end * 0.7), maxZ: Math.max(zEdge, zEdge + end * 0.7), kind: "endcap", color: "#f59e0b" });
      const pick = capSource.length ? [capSource[(gi * 3 + (end > 0 ? 1 : 0)) % capSource.length], capSource[(gi * 3 + 2) % capSource.length]] : [];
      fillFace(
        {
          origin: end > 0 ? [gx + 0.6, zEdge + 0.65] : [gx - 0.6, zEdge - 0.65],
          dir: end > 0 ? [-1, 0] : [1, 0],
          normal: [0, end],
          length: 1.2,
          levels: [0.35, 0.8, 1.25, 1.7],
          shelfDepth: 0.5,
          products: pick,
          colWidth: 0.8,
          zoneLabel: "תצוגת קצה – מומלצים",
        },
        blocks,
      );
    }
  });

  // ── Back wall: refrigerated dairy ──
  const fridgeZ = -28.6;
  const dairy = byCategory(products, "dairy");
  const dairyAlt = byCategory(products, "dairy-alt");
  for (const [x0, x1, list, label] of [
    [-28, -0.5, dairy, "חלב, גבינות וביצים"],
    [0.5, 28, dairyAlt, "מוצרי חלב ותחליפים"],
  ] as const) {
    const len = x1 - x0;
    const xc = (x0 + x1) / 2;
    boxes.white.push({ pos: [xc, 2.27, fridgeZ - 0.7], size: [len, 0.06, 1.4], color: "#f8fafc" });
    boxes.white.push({ pos: [x0 - 0.03, 1.15, fridgeZ - 0.7], size: [0.06, 2.3, 1.4], color: "#f8fafc" });
    boxes.white.push({ pos: [x1 + 0.03, 1.15, fridgeZ - 0.7], size: [0.06, 2.3, 1.4], color: "#f8fafc" });
    boxes.glow.push({ pos: [xc, 1.15, fridgeZ - 1.38], size: [len, 2.1, 0.02], color: "#e0f2fe" });
    boxes.dark.push({ pos: [xc, 0.12, fridgeZ - 0.05], size: [len, 0.24, 0.1], color: "#1e293b" });
    boxes.accent.push({ pos: [xc, 2.38, fridgeZ - 0.6], size: [len, 0.28, 1.2], color: "#2563eb" });
    for (const lvl of FRIDGE_LEVELS) boxes.metal.push({ pos: [xc, lvl - 0.015, fridgeZ - 0.6], size: [len, 0.03, 1.1], color: "#cbd5e1" });
    fridgeDoors(boxes, [x0, fridgeZ], [1, 0], [0, 1], len);
    mapRects.push({ minX: x0, maxX: x1, minZ: fridgeZ - 1.4, maxZ: fridgeZ, kind: "fridge", color: "#60a5fa" });
    fillFace(
      { origin: [x0, fridgeZ], dir: [1, 0], normal: [0, 1], length: len, levels: FRIDGE_LEVELS, shelfDepth: 1.1, products: list, colWidth: 1.4, zoneLabel: `מקררים – ${label}` },
      blocks,
    );
    signs.push({ text: label, sub: "מקררים", pos: [xc, 3.1, fridgeZ - 0.3], rotY: 0, width: 6, color: "#2563eb", doubleSided: false });
  }
  colliders.push({ minX: -31, maxX: 31, minZ: -31, maxZ: fridgeZ });

  // ── West wall: bakery racks ──
  const bakeryX = -30;
  boxes.wood.push({ pos: [bakeryX - 0.95, 1.1, (RUN_Z0 + RUN_Z1) / 2], size: [0.1, 2.2, runLen], color: "#b7835a" });
  boxes.wood.push({ pos: [bakeryX - 0.5, 2.25, (RUN_Z0 + RUN_Z1) / 2], size: [1.0, 0.1, runLen], color: "#7c4a26" });
  for (const lvl of SHELF_LEVELS) boxes.wood.push({ pos: [bakeryX - 0.3, lvl - 0.02, (RUN_Z0 + RUN_Z1) / 2], size: [0.6, 0.04, runLen], color: "#9a6b45" });
  colliders.push({ minX: -31, maxX: bakeryX, minZ: RUN_Z0, maxZ: RUN_Z1 });
  mapRects.push({ minX: -31, maxX: bakeryX, minZ: RUN_Z0, maxZ: RUN_Z1, kind: "wall-shelf", color: "#d6a77a" });
  fillFace(
    { origin: [bakeryX, RUN_Z0], dir: [0, 1], normal: [1, 0], length: runLen, levels: SHELF_LEVELS, shelfDepth: 0.6, products: halves(bakery)[0], colWidth: 1.5, zoneLabel: "מאפייה" },
    blocks,
  );
  signs.push({ text: "מאפייה", sub: "לחמים ומאפים טריים", pos: [-27.3, 3.2, RUN_Z1 + 0.8], rotY: 0, width: 4.2, color: "#b45309", doubleSided: true });

  // ── East wall: cold drinks fridges ──
  const drinksX = 30;
  boxes.white.push({ pos: [drinksX + 0.5, 2.27, (RUN_Z0 + RUN_Z1) / 2], size: [1.0, 0.06, runLen], color: "#f8fafc" });
  boxes.dark.push({ pos: [drinksX + 0.5, 0.12, (RUN_Z0 + RUN_Z1) / 2], size: [1.0, 0.24, runLen], color: "#1e293b" });
  boxes.glow.push({ pos: [drinksX + 0.98, 1.15, (RUN_Z0 + RUN_Z1) / 2], size: [0.02, 2.1, runLen], color: "#e0f2fe" });
  for (const lvl of FRIDGE_LEVELS) boxes.metal.push({ pos: [drinksX + 0.5, lvl - 0.015, (RUN_Z0 + RUN_Z1) / 2], size: [0.95, 0.03, runLen], color: "#cbd5e1" });
  fridgeDoors(boxes, [drinksX, RUN_Z0], [0, 1], [-1, 0], runLen);
  boxes.accent.push({ pos: [drinksX + 0.4, 2.38, (RUN_Z0 + RUN_Z1) / 2], size: [1.2, 0.28, runLen], color: "#0ea5e9" });
  colliders.push({ minX: drinksX, maxX: 31, minZ: RUN_Z0, maxZ: RUN_Z1 });
  mapRects.push({ minX: drinksX, maxX: 31, minZ: RUN_Z0, maxZ: RUN_Z1, kind: "fridge", color: "#60a5fa" });
  fillFace(
    { origin: [drinksX, RUN_Z1], dir: [0, -1], normal: [-1, 0], length: runLen, levels: FRIDGE_LEVELS, shelfDepth: 0.9, products: halves(drinks)[1], colWidth: 1.4, zoneLabel: "מקררי משקאות" },
    blocks,
  );
  signs.push({ text: "משקאות קרים", sub: "מקררים", pos: [27.3, 3.2, RUN_Z1 + 0.8], rotY: 0, width: 4.2, color: "#0284c7", doubleSided: true });

  // ── Aisle signs ──
  const aisles = AISLES.map((a, i) => ({ number: a.number, label: a.label, category: a.category, x: (GONDOLA_XS[i] + GONDOLA_XS[i + 1]) / 2 }));
  for (const a of aisles) {
    signs.push({ text: `${a.number}`, sub: a.label, pos: [a.x, 3.25, RUN_Z1 + 0.6], rotY: 0, width: 3.4, color: "#047857", doubleSided: true });
    signs.push({ text: `${a.number}`, sub: a.label, pos: [a.x, 3.25, RUN_Z0 - 0.6], rotY: 0, width: 3.4, color: "#047857", doubleSided: true });
  }

  // ── Produce area (front-left) ──
  const produce = byCategory(products, "produce");
  const crateCols = 4;
  produce.forEach((p, i) => {
    const col = i % crateCols;
    const row = Math.floor(i / crateCols);
    const cx = -26 + col * 4.6;
    const cz = 15 + row * 3.6;
    const w = 2.2;
    const d = 1.3;
    boxes.wood.push({ pos: [cx, 0.4, cz], size: [w, 0.8, d], color: "#b07a45" });
    boxes.wood.push({ pos: [cx, 0.83, cz], size: [w - 0.12, 0.06, d - 0.12], color: "#7a4a22" });
    // Green produce crates sitting on the table
    for (const side of [-1, 1]) {
      boxes.crate.push({ pos: [cx, 0.92, cz + side * (d / 2 - 0.08)], size: [w - 0.14, 0.2, 0.03], color: i % 3 === 2 ? "#1d4ed8" : "#15803d" });
      boxes.crate.push({ pos: [cx + side * (w / 2 - 0.08), 0.92, cz], size: [0.03, 0.2, d - 0.14], color: i % 3 === 2 ? "#1d4ed8" : "#15803d" });
    }
    boxes.crate.push({ pos: [cx, 0.92, cz], size: [0.03, 0.18, d - 0.16], color: i % 3 === 2 ? "#1d4ed8" : "#15803d" });
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    mapRects.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, kind: "produce", color: "#4ade80" });
    const dims = productDims(p);
    const r = dims.w;
    const facings: Facing[] = [];
    const nx = Math.floor((w - 0.2) / r);
    const nz = Math.floor((d - 0.2) / r);
    for (let layer = 0; layer < 2; layer++) {
      for (let ix = layer; ix < nx - layer; ix++) {
        for (let iz = layer; iz < nz - layer; iz++) {
          facings.push({
            pos: [
              cx - (nx - 1) * r / 2 + ix * r + jitter(ix, iz, layer) * r * 0.25,
              0.86 + r / 2 + layer * r * 0.8 + Math.abs(jitter(iz, ix, layer + 3)) * r * 0.2,
              cz - (nz - 1) * r / 2 + iz * r + jitter(iz + 5, ix, layer) * r * 0.25,
            ],
            rotY: (ix * 7 + iz * 13 + layer * 3) % 6.28,
            scale: [r * (0.92 + ((ix + iz) % 3) * 0.04), r * 0.95, r],
          });
        }
      }
    }
    blocks.push({
      index: blocks.length,
      productId: p.id,
      group: dims.group,
      facings,
      bounds: { min: [cx - w / 2, 0.8, cz - d / 2], max: [cx + w / 2, 1.1, cz + d / 2] },
      tag: { pos: [cx, 1.25, cz + d / 2 - 0.035], rotY: 0, scale: [0.46, 0.17] },
      depth: { rows: 1, step: [0, 0] },
      viewpoint: { x: cx, z: cz + d / 2 + 1.3, yaw: 0, pitch: Math.atan2(0.95 - EYE_HEIGHT, 1.3 + d / 2) },
      zoneLabel: "פירות וירקות",
    });
    // Small price sign card on a stick
    boxes.white.push({ pos: [cx, 1.25, cz + d / 2 - 0.05], size: [0.5, 0.28, 0.02], color: "#ffffff" });
  });
  signs.push({ text: "פירות וירקות", sub: "טרי מהשדה", pos: [-19, 3.3, 12.6], rotY: 0, width: 5, color: "#16a34a", doubleSided: true });

  // ── Checkout counters ──
  const checkoutXs = [7, 12, 17, 22];
  const impulse = byCategory(products, "snacks").filter((p) => p.packaging.shape === "box" && productDims(p).w <= 0.14);
  checkoutXs.forEach((x, i) => {
    const z0 = 14;
    const z1 = 19;
    const zc = (z0 + z1) / 2;
    boxes.white.push({ pos: [x, 0.44, zc], size: [0.9, 0.88, z1 - z0], color: "#f1f5f9" }); // counter body
    boxes.accent.push({ pos: [x, 0.7, zc], size: [0.91, 0.12, z1 - z0 + 0.01], color: "#047857" }); // brand stripe
    boxes.dark.push({ pos: [x, 0.04, zc], size: [0.92, 0.08, z1 - z0 + 0.02], color: "#374151" }); // plinth
    boxes.chrome.push({ pos: [x, 0.9, zc], size: [0.94, 0.04, z1 - z0 + 0.04], color: "#cbd5e1" }); // steel top
    boxes.dark.push({ pos: [x, 0.925, z0 + 3.75], size: [0.5, 0.012, 0.36], color: "#111827" }); // scanner glass
    boxes.dark.push({ pos: [x - 0.36, 1.0, z0 + 3.4], size: [0.12, 0.16, 0.18], color: "#1f2937" }); // card terminal
    boxes.chrome.push({ pos: [x + 0.5, 1.4, z1 - 0.2], size: [0.05, 2.8, 0.05], color: "#9ca3af" }); // lane pole
    boxes.glow.push({ pos: [x + 0.5, 2.85, z1 - 0.2], size: [0.42, 0.3, 0.1], color: i % 2 ? "#fde68a" : "#bbf7d0" });
    checkouts.push({ x, z0, z1, lane: i + 1 });
    // Impulse rack with small snacks at the start of each lane
    const rackX = x - 0.95;
    boxes.dark.push({ pos: [rackX, 0.7, z0 + 0.8], size: [0.3, 1.4, 1.2], color: "#4b5563" });
    for (const lvl of [0.45, 0.85, 1.25]) boxes.metal.push({ pos: [rackX - 0.2, lvl - 0.012, z0 + 0.8], size: [0.12, 0.024, 1.16], color: "#d9dde3" });
    colliders.push({ minX: rackX - 0.3, maxX: rackX + 0.15, minZ: z0 + 0.2, maxZ: z0 + 1.4 });
    mapRects.push({ minX: rackX - 0.3, maxX: rackX + 0.15, minZ: z0 + 0.2, maxZ: z0 + 1.4, kind: "endcap", color: "#f59e0b" });
    const small = impulse.length ? [impulse[(i * 2) % impulse.length], impulse[(i * 2 + 1) % impulse.length]] : [];
    fillFace(
      { origin: [rackX - 0.15, z0 + 0.2], dir: [0, 1], normal: [-1, 0], length: 1.2, levels: [0.45, 0.85, 1.25], shelfDepth: 0.12, products: small, colWidth: 1.2, zoneLabel: `קופה ${i + 1}` },
      blocks,
    );
    colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z0, maxZ: z1 });
    mapRects.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z0, maxZ: z1, kind: "checkout", color: "#475569" });
  });
  signs.push({ text: "קופות", sub: "תודה שקניתם אצלנו", pos: [14.5, 3.3, 13], rotY: 0, width: 5, color: "#0f172a", doubleSided: true });

  // ── Entrance, cart corral and doors ──
  boxes.dark.push({ pos: [0, 0.01, b.maxZ - 1.2], size: [4, 0.02, 1.6], color: "#334155" }); // door mat
  colliders.push({ minX: -8.4, maxX: -4.6, minZ: 28.6, maxZ: 30.8 });
  mapRects.push({ minX: -8.4, maxX: -4.6, minZ: 28.6, maxZ: 30.8, kind: "corral", color: "#cbd5e1" });

  // ── Ceiling light battens: along every aisle, and in rows over the open areas ──
  const lightY = 4.45;
  for (const x of [-27.3, ...aisles.map((a) => a.x), 27.3]) {
    for (let z = RUN_Z0 + 1.6; z < RUN_Z1; z += 3.4) lights.push({ pos: [x, lightY, z], length: 2.4, rotY: 0 });
  }
  for (let x = -27; x <= 27.01; x += 4.5) {
    lights.push({ pos: [x, lightY, -25.4], length: 2.4, rotY: Math.PI / 2 });
    for (let z = 9.5; z <= 29; z += 4) lights.push({ pos: [x, lightY, z], length: 2.4, rotY: Math.PI / 2 });
  }

  const zones = [
    { id: "entrance", label: "כניסה", x: 0, z: 29.5, yaw: 0 },
    ...aisles.map((a) => ({ id: `aisle-${a.number}`, label: `מעבר ${a.number} – ${a.label}`, x: a.x, z: RUN_Z1 + 2, yaw: 0 })),
    { id: "dairy", label: "מקררי חלב", x: -8, z: -24.5, yaw: 0 },
    { id: "bakery", label: "מאפייה", x: -27.3, z: RUN_Z1 + 2, yaw: 0 },
    { id: "drinks-fridge", label: "מקררי משקאות", x: 27.3, z: RUN_Z1 + 2, yaw: 0 },
    { id: "produce", label: "פירות וירקות", x: -15, z: 10, yaw: Math.PI },
    { id: "checkout", label: "קופות", x: 14.5, z: 22, yaw: 0 },
  ];

  return {
    bounds: b,
    colliders,
    mapRects,
    blocks,
    signs,
    boxes,
    spawn: { x: 0, z: 29.5, yaw: 0 },
    aisles,
    zones,
    lights,
    checkouts,
    storefront: { windows: [[b.minX + 0.5, -3.4], [3.4, b.maxX - 0.5]], door: [-3, 3] },
  };
}
