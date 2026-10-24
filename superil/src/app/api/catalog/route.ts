import type { NextRequest } from "next/server";
import { json } from "@/server/api";
import { getProvider } from "@/server/providers";

/**
 * Catalog for the 3D store layout. Default scope "shelf" = curated products that have a place on the shelves;
 * "all" also includes every product learned from official price files (can be tens of thousands).
 */
export async function GET(req: NextRequest) {
  const provider = await getProvider();
  const all = await provider.getAllProducts();
  const scope = req.nextUrl.searchParams.get("scope");
  return json({ products: scope === "all" ? all : all.filter((p) => p.category !== "other") });
}
