import type { NextRequest } from "next/server";
import { requireAdmin } from "@/server/admin-auth";
import { json } from "@/server/api";
import { commitUpload } from "@/server/prices/service";
import { readUpload } from "../upload";

export const runtime = "nodejs";

/** Imports an uploaded official file (the same file the admin previewed; it is re-validated here). */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const u = await readUpload(req);
  if ("error" in u) return u.error;
  return json(await commitUpload(u.name, u.bytes, { retailerId: u.retailerId, publishedAt: u.publishedAt, force: u.force, importedBy: "admin-web" }));
}
