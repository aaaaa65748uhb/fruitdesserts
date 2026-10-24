import type { NextRequest } from "next/server";
import { requireAdmin } from "@/server/admin-auth";
import { json } from "@/server/api";
import { readinessReport } from "@/server/readiness";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return json(await readinessReport());
}
