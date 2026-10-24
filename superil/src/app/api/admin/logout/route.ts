import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, sameOrigin } from "@/server/admin-auth";
import { errorResponse, json } from "@/server/api";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return errorResponse(403, "Cross-origin request refused");
  const res = json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return res;
}
