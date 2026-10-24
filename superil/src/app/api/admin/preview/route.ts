import type { NextRequest } from "next/server";
import { requireAdmin } from "@/server/admin-auth";
import { json } from "@/server/api";
import { previewUpload } from "@/server/prices/service";
import { readUpload } from "../upload";

export const runtime = "nodejs";

/** Parses and validates an uploaded official file. Writes nothing. */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const u = await readUpload(req);
  if ("error" in u) return u.error;
  return json(await previewUpload(u.name, u.bytes, { retailerId: u.retailerId, publishedAt: u.publishedAt, importedBy: "admin-web" }));
}
