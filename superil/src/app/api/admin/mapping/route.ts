import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/admin-auth";
import { errorResponse, json, parseJson, productIdSchema } from "@/server/api";
import { StorageNotPersistentError, decideMapping } from "@/server/prices/service";

const schema = z.object({
  productId: productIdSchema,
  identifier: z.string().min(1).max(80),
  action: z.enum(["approve", "reject", "unlink"]),
});

/** Records a reviewed matching decision (approve a link, reject a suggestion, or unlink). */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { data, error } = await parseJson(req, schema);
  if (error) return error;
  try {
    const res = await decideMapping(data!.productId, data!.identifier, data!.action, "admin-web");
    return json(res, { status: res.ok ? 200 : 422 });
  } catch (e) {
    if (e instanceof StorageNotPersistentError) return errorResponse(503, e.message);
    throw e;
  }
}
