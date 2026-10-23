import type { NextRequest } from "next/server";
import { z } from "zod";
import { buildCheckoutHandoff } from "@/lib/checkout";
import { basketSchema, errorResponse, json, limited, parseJson } from "@/server/api";
import { getProvider } from "@/server/providers";

const schema = basketSchema.extend({ retailerId: z.string().max(40) });

export async function POST(req: NextRequest) {
  const tooMany = limited(req, "handoff", 30);
  if (tooMany) return tooMany;
  const { data, error } = await parseJson(req, schema);
  if (error) return error;
  const provider = await getProvider();
  const retailer = (await provider.getRetailers()).find((r) => r.id === data!.retailerId);
  if (!retailer) return errorResponse(404, "הרשת לא נמצאה");
  const ids = data!.items.map((i) => i.productId);
  const products = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await provider.getProductById(id)] as const)));
  const offers = await provider.getOffersForProducts(ids, { branchId: data!.branchId });
  return json(buildCheckoutHandoff(retailer, data!.items, products, offers));
}
