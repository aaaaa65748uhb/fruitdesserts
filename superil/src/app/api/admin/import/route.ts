import type { NextRequest } from "next/server";
import { requireAdmin } from "@/server/admin-auth";
import { errorResponse, json } from "@/server/api";
import { StorageNotPersistentError, commitUpload } from "@/server/prices/service";
import { readUpload } from "../upload";

export const runtime = "nodejs";

/** Imports an uploaded official file (the same file the admin previewed; it is re-validated here). */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const u = await readUpload(req);
  if ("error" in u) return u.error;
  try {
    return json(await commitUpload(u.name, u.bytes, { retailerId: u.retailerId, publishedAt: u.publishedAt, force: u.force, importedBy: "admin-web" }));
  } catch (e) {
    if (e instanceof StorageNotPersistentError) return errorResponse(503, e.message);
    console.error("[superil] import failed", e instanceof Error ? e.message : e);
    return errorResponse(500, "הייבוא נכשל. אם הועלה ארכיון, ייתכן שחלק מהקבצים בו כבר יובאו – בדקו בהיסטוריית הייבוא וביומן השרת.");
  }
}
