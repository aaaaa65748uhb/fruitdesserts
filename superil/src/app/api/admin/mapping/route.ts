import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin-auth";
import { json, parseJson, productIdSchema } from "@/server/api";
import { setCatalogMapping } from "@/server/prices/service";

const schema = z.object({ productId: productIdSchema, identifier: z.string().max(80).nullable() });

/** Approve (or remove) a reviewed link between a catalog product and a verified identifier. */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { data, error } = await parseJson(req, schema);
  if (error) return error;
  const res = await setCatalogMapping(data!.productId, data!.identifier);
  return json(res, { status: res.ok ? 200 : 422 });
}
