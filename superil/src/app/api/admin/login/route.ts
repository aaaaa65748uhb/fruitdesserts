import type { NextRequest } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, adminEnabled, checkToken, createSession, sameOrigin } from "@/server/admin-auth";
import { errorResponse, json, limited, parseJson } from "@/server/api";

export async function POST(req: NextRequest) {
  if (!adminEnabled()) return errorResponse(404, "Not found");
  const tooMany = limited(req, "admin-login", 5);
  if (tooMany) return tooMany;
  if (!sameOrigin(req)) return errorResponse(403, "Cross-origin request refused");
  const { data, error } = await parseJson(req, z.object({ token: z.string().min(1).max(500) }));
  if (error) return error;
  if (!checkToken(data!.token)) return errorResponse(401, "קוד גישה שגוי");
  const session = createSession();
  const res = json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, session.value, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: session.maxAge });
  return res;
}
