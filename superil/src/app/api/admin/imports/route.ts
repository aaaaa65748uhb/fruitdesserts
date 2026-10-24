import type { NextRequest } from "next/server";
import { requireAdmin } from "@/server/admin-auth";
import { json } from "@/server/api";
import { getPriceRepository } from "@/server/prices/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const repo = await getPriceRepository();
  const imports = (await repo.listImports()).slice(-200).reverse();
  const id = req.nextUrl.searchParams.get("issues");
  return json({ imports, issues: id ? await repo.getImportIssues(id.slice(0, 100)) : undefined });
}
