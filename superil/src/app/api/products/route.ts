import type { NextRequest } from "next/server";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import { suggest } from "@/lib/search";
import type { CategoryId } from "@/lib/types";
import { errorResponse, json, limited } from "@/server/api";
import { getProvider } from "@/server/providers";

const querySchema = z.object({
  q: z.string().max(100).default(""),
  category: z.enum(CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]]).optional(),
  brand: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

export async function GET(req: NextRequest) {
  const tooMany = limited(req, "search", 120);
  if (tooMany) return tooMany;
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return errorResponse(400, "Invalid query");
  const { q, category, brand, limit } = parsed.data;
  const provider = await getProvider();
  const products = await provider.searchProducts(q, { category, brand }, limit);
  const suggestions = q ? suggest(await provider.getAllProducts(), q) : [];
  return json({ products, suggestions });
}
