import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, limited, parseJson, productIdSchema } from "@/server/api";
import { getProvider } from "@/server/providers";

const schema = z.object({ ids: z.array(productIdSchema).max(500) });

/** Products by id (cart, comparison) without downloading the whole catalog. */
export async function POST(req: NextRequest) {
  const tooMany = limited(req, "batch", 120);
  if (tooMany) return tooMany;
  const { data, error } = await parseJson(req, schema);
  if (error) return error;
  const provider = await getProvider();
  const products = (await Promise.all([...new Set(data!.ids)].map((id) => provider.getProductById(id)))).filter(Boolean);
  return json({ products });
}
