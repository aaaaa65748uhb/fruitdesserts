import type { NextRequest } from "next/server";
import { compareBasket } from "@/lib/compare";
import { basketSchema, json, limited, parseJson } from "@/server/api";
import { getProvider } from "@/server/providers";

/** Server-side basket comparison. Uses server prices only — client-supplied prices are never accepted. */
export async function POST(req: NextRequest) {
  const tooMany = limited(req, "compare", 30);
  if (tooMany) return tooMany;
  const { data, error } = await parseJson(req, basketSchema);
  if (error) return error;
  const provider = await getProvider();
  const items = data!.items;
  const offers = await provider.getOffersForProducts(items.map((i) => i.productId), { branchId: data!.branchId });
  return json(compareBasket(items, offers, await provider.getRetailers()));
}
