import { describe, expect, it } from "vitest";
import { SEED_PRODUCTS } from "@/data/seed-products";
import { buildStoreLayout, EYE_HEIGHT, PLAYER_RADIUS } from "@/components/store3d/layout";
import { moveWithCollisions, pickBlock, rayBox } from "@/components/store3d/physics";

const layout = buildStoreLayout(SEED_PRODUCTS);

describe("3D store layout", () => {
  it("has 8 numbered aisles and the required zones", () => {
    expect(layout.aisles.map((a) => a.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const zoneIds = layout.zones.map((z) => z.id);
    for (const z of ["entrance", "dairy", "bakery", "produce", "checkout", "drinks-fridge"]) expect(zoneIds).toContain(z);
  });
  it("places every non-'other' seed product on a shelf", () => {
    const placed = new Set(layout.blocks.map((b) => b.productId));
    for (const p of SEED_PRODUCTS) expect(placed.has(p.id)).toBe(true);
  });
  it("spawns the player in free space", () => {
    const [x, z] = moveWithCollisions(layout.spawn.x, layout.spawn.z, 0, 0, PLAYER_RADIUS, layout.colliders);
    expect(x).toBeCloseTo(layout.spawn.x);
    expect(z).toBeCloseTo(layout.spawn.z);
  });
});

describe("collision", () => {
  it("cannot walk through a gondola even at high speed", () => {
    // Aisle 1 is between gondolas at x=-24 and x=-18; walk hard toward x=-18 shelf.
    let x = -21;
    let z = -8;
    for (let i = 0; i < 200; i++) [x, z] = moveWithCollisions(x, z, 0.5, 0, PLAYER_RADIUS, layout.colliders);
    expect(x).toBeLessThanOrEqual(-18 - 0.65 - PLAYER_RADIUS + 1e-6);
  });
  it("cannot leave the building through the walls", () => {
    let x = 0;
    let z = 25;
    for (let i = 0; i < 200; i++) [x, z] = moveWithCollisions(x, z, 0, 1, PLAYER_RADIUS, layout.colliders);
    expect(z).toBeLessThan(layout.bounds.maxZ);
  });
  it("cannot walk through checkout counters or produce tables", () => {
    let x = 7;
    let z = 22;
    for (let i = 0; i < 100; i++) [x, z] = moveWithCollisions(x, z, 0, -0.5, PLAYER_RADIUS, layout.colliders);
    expect(z).toBeGreaterThanOrEqual(19 + PLAYER_RADIUS - 1e-6);
  });
});

describe("product picking", () => {
  it("ray-box intersection works", () => {
    expect(rayBox([0, 0, 0], [1, 0, 0], [2, -1, -1], [3, 1, 1])).toBeCloseTo(2);
    expect(rayBox([0, 0, 0], [-1, 0, 0], [2, -1, -1], [3, 1, 1])).toBeNull();
  });
  it("picks the product a viewpoint looks at, within range only", () => {
    const block = layout.blocks.find((b) => b.productId === "bamba-80")!;
    const { x, z, yaw, pitch } = block.viewpoint;
    const dir: [number, number, number] = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    const hit = pickBlock(layout.blocks, [x, EYE_HEIGHT, z], dir, 3.2);
    expect(hit?.block.productId).toBe("bamba-80");
    expect(pickBlock(layout.blocks, [x, EYE_HEIGHT, z], dir, 0.5)).toBeNull();
  });
});
