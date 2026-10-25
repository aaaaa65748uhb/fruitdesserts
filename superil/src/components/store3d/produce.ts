import * as THREE from "three";

/**
 * Procedural fruit & vegetable models (loose produce has no packaging photo). Each model is roughly unit-sized
 * (diameter ≈ 1 along its short axis) and is scaled per facing by the layout. Colours are baked as vertex colours.
 */

type Rgb = [number, number, number];

function hex(c: string): Rgb {
  const col = new THREE.Color(c);
  return [col.r, col.g, col.b];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function noise3(x: number, y: number, z: number) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

/** Smooth-ish value noise good enough for bumps and blush. */
function smoothNoise(x: number, y: number, z: number, f: number) {
  return (
    Math.sin(x * f) * Math.cos(y * f * 1.3) * 0.5 +
    Math.sin(z * f * 0.9 + y * f * 0.7) * 0.35 +
    Math.cos(x * f * 1.7 + z * f * 1.1) * 0.15
  );
}

function colorize(g: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3) => Rgb) {
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    colors.set(fn(p, n), i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

function displace(g: THREE.BufferGeometry, fn: (p: THREE.Vector3) => number) {
  const pos = g.getAttribute("position");
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const len = p.length() || 1;
    const k = fn(p.clone().divideScalar(len));
    p.multiplyScalar(k);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  return g;
}

function sphere(detail: "high" | "low") {
  return detail === "high" ? new THREE.SphereGeometry(0.5, 14, 10) : new THREE.SphereGeometry(0.5, 9, 6);
}

const BUILDERS: Record<string, (d: "high" | "low") => THREE.BufferGeometry> = {
  tomatoes: (d) => {
    const g = displace(sphere(d), (u) => 1 - 0.12 * Math.abs(u.y) ** 1.5 + 0.03 * Math.cos(Math.atan2(u.z, u.x) * 5) * (1 - Math.abs(u.y)));
    g.scale(1, 0.82, 1);
    const red = hex("#d62d20");
    const deep = hex("#9e1b14");
    const green = hex("#3f7d2c");
    return colorize(g, (p) => (p.y > 0.36 && Math.hypot(p.x, p.z) < 0.16 ? green : mix(red, deep, 0.3 + 0.3 * smoothNoise(p.x, p.y, p.z, 9))));
  },
  cucumbers: (d) => {
    const g = new THREE.CapsuleGeometry(0.28, 1.5, d === "high" ? 6 : 3, d === "high" ? 12 : 8);
    g.rotateZ(Math.PI / 2);
    const dark = hex("#2f5d1e");
    const light = hex("#6b9a3a");
    return colorize(g, (p) => mix(dark, light, Math.max(0, Math.sin(Math.atan2(p.z, p.y) * 6)) * 0.35 + noise3(p.x, p.y, p.z) * 0.15));
  },
  onions: (d) => {
    const g = displace(sphere(d), (u) => (u.y > 0 ? 1 + 0.35 * u.y ** 6 : 1 - 0.08 * u.y ** 2));
    g.scale(1, 0.92, 1);
    const gold = hex("#c98a3a");
    const brown = hex("#8a5420");
    return colorize(g, (p) => mix(gold, brown, 0.3 + 0.4 * Math.abs(Math.sin(Math.atan2(p.z, p.x) * 9)) * 0.5 + 0.2 * p.y));
  },
  potatoes: (d) => {
    const g = displace(sphere(d), (u) => 1 + 0.08 * smoothNoise(u.x, u.y, u.z, 3.1) + 0.03 * noise3(u.x, u.y, u.z));
    g.scale(1.25, 0.8, 0.95);
    const tan = hex("#b88b55");
    const dark = hex("#7d5a32");
    return colorize(g, (p) => mix(tan, dark, Math.max(0, smoothNoise(p.x, p.y, p.z, 14)) * 0.6 + noise3(p.x * 3, p.y, p.z) * 0.15));
  },
  carrots: (d) => {
    const g = new THREE.CylinderGeometry(0.26, 0.03, 1.9, d === "high" ? 10 : 6, d === "high" ? 6 : 3);
    g.rotateZ(Math.PI / 2);
    const orange = hex("#ee7a17");
    const green = hex("#3e8e2f");
    return colorize(g, (p) => (p.x > 0.88 ? green : mix(orange, hex("#c85a0c"), Math.abs(Math.sin(p.x * 40)) * 0.25)));
  },
  "peppers-red": (d) => {
    const g = displace(sphere(d), (u) => 1 + 0.07 * Math.cos(Math.atan2(u.z, u.x) * 4) * (1 - u.y * u.y) - (u.y < -0.6 ? 0.15 * (-u.y - 0.6) : 0));
    g.scale(1, 1.15, 1);
    const red = hex("#c81d1d");
    const green = hex("#2f6b25");
    return colorize(g, (p) => (p.y > 0.5 && Math.hypot(p.x, p.z) < 0.1 ? green : mix(red, hex("#ff4d3d"), Math.max(0, p.x + p.z) * 0.3)));
  },
  bananas: (d) => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.9, 0.15, 0), new THREE.Vector3(0, -0.35, 0), new THREE.Vector3(0.9, 0.15, 0));
    const g = new THREE.TubeGeometry(curve, d === "high" ? 16 : 8, 0.2, d === "high" ? 7 : 5, false);
    // taper the ends
    const pos = g.getAttribute("position");
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const t = (p.x + 0.9) / 1.8;
      const c = curve.getPoint(Math.min(1, Math.max(0, t)));
      const k = 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
      pos.setXYZ(i, c.x + (p.x - c.x) * k, c.y + (p.y - c.y) * k, c.z + (p.z - c.z) * k);
    }
    g.computeVertexNormals();
    const yellow = hex("#f2cf2c");
    const brown = hex("#5a3b17");
    return colorize(g, (q) => (Math.abs(q.x) > 0.82 ? brown : mix(yellow, hex("#d9b21c"), noise3(q.x, q.y, q.z) * 0.3)));
  },
  "apples-pink": (d) => {
    const g = displace(sphere(d), (u) => 1 - 0.18 * Math.max(0, u.y) ** 8 - 0.12 * Math.max(0, -u.y) ** 6);
    g.scale(1, 0.9, 1);
    const pink = hex("#d8424c");
    const blush = hex("#f2b44c");
    return colorize(g, (p) => mix(pink, blush, Math.max(0, smoothNoise(p.x, p.y, p.z, 4)) * 0.55));
  },
  oranges: (d) => {
    const g = displace(sphere(d), (u) => 1 + 0.012 * noise3(u.x * 9, u.y * 9, u.z * 9));
    const orange = hex("#f28c13");
    return colorize(g, (p) => mix(orange, hex("#e2700a"), noise3(p.x * 7, p.y * 7, p.z * 7) * 0.35));
  },
  avocado: (d) => {
    const g = displace(sphere(d), (u) => (u.y > 0 ? 1 - 0.28 * u.y : 1) + 0.03 * noise3(u.x * 5, u.y * 5, u.z * 5));
    g.scale(0.9, 1.3, 0.9);
    const dark = hex("#2e3d16");
    return colorize(g, (p) => mix(dark, hex("#4b5d23"), noise3(p.x * 9, p.y * 9, p.z * 9) * 0.5));
  },
  lemons: (d) => {
    const g = displace(sphere(d), (u) => 1 + 0.18 * Math.max(0, Math.abs(u.x) - 0.85) * 6);
    g.scale(1.2, 0.95, 0.95);
    const yellow = hex("#f5e04a");
    return colorize(g, (p) => mix(yellow, hex("#e2c72a"), noise3(p.x * 8, p.y * 8, p.z * 8) * 0.3));
  },
  lettuce: (d) => {
    const g = displace(d === "high" ? new THREE.SphereGeometry(0.5, 18, 12) : new THREE.SphereGeometry(0.5, 10, 7), (u) => 1 + 0.09 * Math.sin(Math.atan2(u.z, u.x) * 9 + u.y * 6) * (0.5 + u.y * 0.5));
    g.scale(1.1, 1.6, 1.1);
    const green = hex("#5f9d34");
    const pale = hex("#b6d77a");
    return colorize(g, (p) => mix(green, pale, Math.max(0, -p.y * 1.2 + 0.2) + noise3(p.x * 5, p.y * 5, p.z * 5) * 0.15));
  },
};

/** Geometry with vertex colours for a produce product, or a generic coloured sphere if no model exists. */
export function produceGeometry(productId: string, fallbackColor: string, detail: "high" | "low"): THREE.BufferGeometry {
  const build = BUILDERS[productId];
  if (build) return build(detail);
  const base = hex(fallbackColor);
  return colorize(sphere(detail), (p) => mix(base, [base[0] * 0.75, base[1] * 0.75, base[2] * 0.75], 0.5 - p.y * 0.5));
}
