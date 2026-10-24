import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { errorResponse } from "./api";

/**
 * Admin access for price imports.
 * - Disabled entirely unless ADMIN_TOKEN (≥ 24 characters) is set; the admin pages then return 404.
 * - Login exchanges the token for a signed, httpOnly, SameSite=Strict session cookie (8 hours).
 * - State-changing requests must come from the same origin.
 */
export const ADMIN_COOKIE = "superil_admin";
const SESSION_MS = 8 * 3600_000;

export function adminToken(): string | undefined {
  const t = process.env.ADMIN_TOKEN;
  return t && t.length >= 24 ? t : undefined;
}

export function adminEnabled(): boolean {
  return !!adminToken();
}

function sign(payload: string, token: string) {
  return createHmac("sha256", token).update(`superil-admin:${payload}`).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkToken(candidate: string): boolean {
  const token = adminToken();
  if (!token) return false;
  const a = createHmac("sha256", "cmp").update(candidate).digest();
  const b = createHmac("sha256", "cmp").update(token).digest();
  return timingSafeEqual(a, b);
}

export function createSession(now = Date.now()): { value: string; maxAge: number } {
  const token = adminToken();
  if (!token) throw new Error("Admin disabled");
  const exp = String(now + SESSION_MS);
  return { value: `${exp}.${sign(exp, token)}`, maxAge: SESSION_MS / 1000 };
}

export function verifySession(value: string | undefined, now = Date.now()): boolean {
  const token = adminToken();
  if (!token || !value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return safeEqual(sig, sign(exp, token));
}

export async function isAdminSession(): Promise<boolean> {
  return verifySession((await cookies()).get(ADMIN_COOKIE)?.value);
}

export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.method === "GET";
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

/** Returns an error response unless the request is an authenticated same-origin admin request. */
export function requireAdmin(req: NextRequest) {
  if (!adminEnabled()) return errorResponse(404, "Not found");
  if (!verifySession(req.cookies.get(ADMIN_COOKIE)?.value)) return errorResponse(401, "נדרשת התחברות מנהל");
  if (req.method !== "GET" && !sameOrigin(req)) return errorResponse(403, "Cross-origin request refused");
  return undefined;
}
