import * as THREE from "three";
import { PRODUCT_PHOTOS } from "@/data/product-photos";
import type { Product } from "@/lib/types";
import { drawLabel, type Atlas } from "./textures";

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function linear(hex: string): [number, number, number] {
  const c = new THREE.Color(hex); // converts sRGB → linear working space
  return [c.r, c.g, c.b];
}

/**
 * One texture atlas for every product on the shelves: the real front photo where we have one (stretched to fill
 * its cell; the 3D model restores the aspect ratio), otherwise the generated placeholder label.
 * Photos that fail to load fall back to the generated label.
 */
export async function buildProductAtlas(products: Product[], cell: number): Promise<Atlas> {
  const cols = 16;
  const rows = Math.max(1, Math.ceil(products.length / cols));
  const canvas = document.createElement("canvas");
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext("2d")!;
  const images = await Promise.all(products.map((p) => (PRODUCT_PHOTOS[p.id] ? loadImage(PRODUCT_PHOTOS[p.id].url) : Promise.resolve(null))));
  const rects = new Map<string, [number, number, number, number]>();
  const sides = new Map<string, [number, number, number]>();
  const photos = new Set<string>();
  const inset = 1.5; // texels: keeps mipmap sampling inside the cell
  products.forEach((p, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = c * cell;
    const y = r * cell;
    const img = images[i];
    if (img) {
      ctx.clearRect(x, y, cell, cell);
      ctx.drawImage(img, x, y, cell, cell);
      photos.add(p.id);
      sides.set(p.id, linear(PRODUCT_PHOTOS[p.id].side));
    } else {
      drawLabel(ctx, p, x, y, cell);
      sides.set(p.id, linear(p.packaging.color));
    }
    // CanvasTexture uses flipY, so v = 1 is the top row.
    rects.set(p.id, [
      (x + inset) / canvas.width,
      1 - (y + cell - inset) / canvas.height,
      (cell - inset * 2) / canvas.width,
      (cell - inset * 2) / canvas.height,
    ]);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return { texture, rects, sides, photos };
}
