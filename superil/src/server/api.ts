import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "./rate-limit";

export function clientKey(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function limited(req: NextRequest, bucket: string, capacity?: number): NextResponse | undefined {
  if (!rateLimit(`${bucket}:${clientKey(req)}`, capacity)) return errorResponse(429, "יותר מדי בקשות, נסו שוב בעוד רגע.");
  return undefined;
}

export const productIdSchema = z.string().min(1).max(80).regex(/^[a-zA-Z0-9._-]+$/);

/** Cart lines as sent by the client. Prices are never accepted from the client. */
export const basketSchema = z.object({
  items: z
    .array(z.object({ productId: productIdSchema, quantity: z.number().int().min(1).max(99) }))
    .max(200),
  branchId: z.string().max(80).optional(),
});

export async function parseJson<T>(req: NextRequest, schema: z.ZodType<T>): Promise<{ data?: T; error?: NextResponse }> {
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 100_000) return { error: errorResponse(413, "Request too large") };
    body = JSON.parse(text);
  } catch {
    return { error: errorResponse(400, "Invalid JSON") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { error: errorResponse(400, "Invalid request") };
  return { data: parsed.data };
}
