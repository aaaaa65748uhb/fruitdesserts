import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, limited, parseJson, productIdSchema } from "@/server/api";
import { getProvider } from "@/server/providers";

const schema = z.object({ productIds: z.array(productIdSchema).max(600), branchId: z.string().max(80).optional() });

export async function POST(req: NextRequest) {
  const tooMany = limited(req, "offers", 120);
  if (tooMany) return tooMany;
  const { data, error } = await parseJson(req, schema);
  if (error) return error;
  const provider = await getProvider();
  return json({ offers: await provider.getOffersForProducts([...new Set(data!.productIds)], { branchId: data!.branchId }) });
}
