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

export type GeometryGroup = "box" | "cyl" | "sphere";

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

export interface StoreLayout {
  bounds: AABB;
  colliders: AABB[];
  mapRects: MapRect[];
  blocks: ProductBlock[];
  signs: Sign[];
  boxes: Record<"metal" | "white" | "wood" | "dark" | "accent" | "glass" | "glow", BoxSpec[]>;
  spawn: { x: number; z: number; yaw: number };
  aisles: { number: number; label: string; category: CategoryId; x: number }[];
  zones: { id: string; label: string; x: number; z: number; yaw: number }[];
  lights: [number, number, number][];
}

export const STORE_BOUNDS: AABB = { minX: -31, maxX: 31, minZ: -30, maxZ: 32 };
export const EYE_HEIGHT = 1.62;
export const PLAYER_RADIUS = 0.3;

const GONDOLA_XS = [-24, -18, -12, -6, 0, 6, 12, 18, 24];
const GONDOLA_HALF_DEPTH = 0.65;
const RUN_Z0 = -22;
const RUN_Z1 = 6;
const SHELF_LEVELS = [0.12, 0.55, 0.98, 1.41];
const FRIDGE_LEVELS = [0.3, 0.75, 1.2, 1.65];

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

/** Physical size of a facing [width along shelf, height, depth]. */
export function productDims(p: Product): { group: GeometryGroup; w: number; h: number; d: number } {
  const { shape } = p.packaging;
  const grams = p.packageUnit === "kg" ? p.packageSize * 1000 : p.packageUnit === "g" ? p.packageSize : 0;
  const ml = p.packageUnit === "l" ? p.packageSize * 1000 : p.packageUnit === "ml" ? p.packageSize : 0;
  const multi = (p.multipack ?? 1) > 1;
  switch (shape) {
    case "bottle": {
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
    case "produce":
      return { group: "sphere", w: 0.085, h: 0.085, d: 0.085 };
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

export function buildStoreLayout(products: Product[]): StoreLayout {
  const blocks: ProductBlock[] = [];
  const colliders: AABB[] = [];
  const mapRects: MapRect[] = [];
  const signs: Sign[] = [];
  const boxes: StoreLayout["boxes"] = { metal: [], white: [], wood: [], dark: [], accent: [], glass: [], glow: [] };
  const lights: [number, number, number][] = [];
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
    // Structure
    boxes.white.push({ pos: [gx, 1.0, zMid], size: [0.08, 2.0, runLen], color: "#f1f5f9" }); // back divider
    boxes.dark.push({ pos: [gx, 0.05, zMid], size: [GONDOLA_HALF_DEPTH * 2, 0.1, runLen], color: "#334155" }); // kick plate
    for (const lvl of [...SHELF_LEVELS, 1.84]) {
      boxes.metal.push({ pos: [gx, lvl - 0.015, zMid], size: [GONDOLA_HALF_DEPTH * 2, 0.03, runLen], color: "#e2e8f0" });
    }
    // Price rails (colored shelf edges)
    for (const lvl of SHELF_LEVELS) {
      for (const side of [-1, 1]) {
        boxes.accent.push({ pos: [gx + side * (GONDOLA_HALF_DEPTH + 0.005), lvl - 0.035, zMid], size: [0.01, 0.05, runLen], color: "#047857" });
      }
    }
    boxes.accent.push({ pos: [gx, 2.12, zMid], size: [0.1, 0.24, runLen], color: "#047857" }); // header
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
      boxes.white.push({ pos: [gx, 0.95, zEdge + end * 0.04], size: [1.3, 1.9, 0.08], color: "#fef3c7" });
      boxes.dark.push({ pos: [gx, 0.1, zc], size: [1.3, 0.2, 0.6], color: "#78350f" });
      for (const lvl of [0.35, 0.8, 1.25, 1.7]) boxes.metal.push({ pos: [gx, lvl - 0.015, zc], size: [1.3, 0.03, 0.6], color: "#fde68a" });
      boxes.accent.push({ pos: [gx, 2.0, zc], size: [1.3, 0.22, 0.6], color: "#f59e0b" });
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
    for (let x = x0 + 1.4; x < x1; x += 1.4) boxes.metal.push({ pos: [x, 1.2, fridgeZ + 0.02], size: [0.05, 2.15, 0.05], color: "#94a3b8" });
    boxes.glass.push({ pos: [xc, 1.2, fridgeZ + 0.03], size: [len, 2.15, 0.02], color: "#dbeafe" });
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
  boxes.glass.push({ pos: [drinksX - 0.03, 1.2, (RUN_Z0 + RUN_Z1) / 2], size: [0.02, 2.15, runLen], color: "#dbeafe" });
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
    boxes.wood.push({ pos: [cx, 0.4, cz], size: [w, 0.8, d], color: "#a16207" });
    boxes.wood.push({ pos: [cx, 0.83, cz], size: [w - 0.12, 0.06, d - 0.12], color: "#78350f" });
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
            pos: [cx - (nx - 1) * r / 2 + ix * r + layer * r * 0.0, 0.86 + r / 2 + layer * r * 0.8, cz - (nz - 1) * r / 2 + iz * r],
            rotY: (ix * 7 + iz * 13) % 6,
            scale: [r * (0.92 + ((ix + iz) % 3) * 0.04), r * 0.95, r],
          });
        }
      }
    }
    blocks.push({
      index: blocks.length,
      productId: p.id,
      group: "sphere",
      facings,
      bounds: { min: [cx - w / 2, 0.8, cz - d / 2], max: [cx + w / 2, 1.1, cz + d / 2] },
      tag: { pos: [cx, 1.25, cz + d / 2 - 0.035], rotY: 0, scale: [0.46, 0.17] },
      viewpoint: { x: cx, z: cz + d / 2 + 1.3, yaw: 0, pitch: Math.atan2(0.95 - EYE_HEIGHT, 1.3 + d / 2) },
      zoneLabel: "פירות וירקות",
    });
    // Small price sign card on a stick
    boxes.white.push({ pos: [cx, 1.25, cz + d / 2 - 0.05], size: [0.5, 0.28, 0.02], color: "#ffffff" });
  });
  signs.push({ text: "פירות וירקות", sub: "טרי מהשדה", pos: [-19, 3.3, 12.6], rotY: 0, width: 5, color: "#16a34a", doubleSided: true });

  // ── Checkout counters ──
  const checkoutXs = [7, 12, 17, 22];
  checkoutXs.forEach((x, i) => {
    const z0 = 14;
    const z1 = 19;
    const zc = (z0 + z1) / 2;
    boxes.dark.push({ pos: [x, 0.45, zc], size: [0.9, 0.9, z1 - z0], color: "#1e293b" });
    boxes.dark.push({ pos: [x, 0.91, zc - 0.6], size: [0.7, 0.02, 3.4], color: "#0f172a" }); // belt
    boxes.white.push({ pos: [x, 1.05, z1 - 0.6], size: [0.5, 0.3, 0.4], color: "#e2e8f0" }); // register
    boxes.accent.push({ pos: [x + 0.5, 1.25, z1 - 0.2], size: [0.06, 2.5, 0.06], color: "#94a3b8" }); // pole
    boxes.glow.push({ pos: [x + 0.5, 2.6, z1 - 0.2], size: [0.4, 0.4, 0.12], color: i % 2 ? "#fde68a" : "#bbf7d0" });
    colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z0, maxZ: z1 });
    mapRects.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z0, maxZ: z1, kind: "checkout", color: "#475569" });
  });
  signs.push({ text: "קופות", sub: "תודה שקניתם אצלנו", pos: [14.5, 3.3, 13], rotY: 0, width: 5, color: "#0f172a", doubleSided: true });

  // ── Entrance, cart corral and doors ──
  boxes.glass.push({ pos: [0, 1.4, b.maxZ - 0.05], size: [6, 2.8, 0.06], color: "#bfdbfe" });
  boxes.metal.push({ pos: [0, 2.85, b.maxZ - 0.05], size: [6.2, 0.12, 0.12], color: "#64748b" });
  boxes.dark.push({ pos: [0, 0.01, b.maxZ - 1.2], size: [4, 0.02, 1.6], color: "#334155" }); // door mat
  colliders.push({ minX: -8.4, maxX: -4.6, minZ: 28.6, maxZ: 30.8 });
  mapRects.push({ minX: -8.4, maxX: -4.6, minZ: 28.6, maxZ: 30.8, kind: "corral", color: "#cbd5e1" });

  // ── Ceiling lights over aisles and open areas ──
  for (let x = -27; x <= 27; x += 6) for (let z = -26; z <= 28; z += 4.5) lights.push([x, 4.45, z]);

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
  };
}
