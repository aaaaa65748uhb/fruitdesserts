import type { NextRequest } from "next/server";
import { RETAILER_BY_ID } from "@/data/retailers";
import { errorResponse } from "@/server/api";
import { priceConfig } from "@/server/prices/config";

/** Reads a multipart upload (field "file") plus import options. */
export async function readUpload(req: NextRequest) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > priceConfig.maxUploadBytes) return { error: errorResponse(413, `הקובץ גדול מ-${priceConfig.maxUploadBytes / 1024 / 1024}MB`) };
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { error: errorResponse(400, "בקשת העלאה לא תקינה") };
  }
  const file = form.get("file");
  if (!(file instanceof File)) return { error: errorResponse(400, "לא נבחר קובץ") };
  if (file.size > priceConfig.maxUploadBytes) return { error: errorResponse(413, "הקובץ גדול מדי") };
  const retailerId = (form.get("retailerId") as string | null) || undefined;
  if (retailerId && !RETAILER_BY_ID[retailerId]) return { error: errorResponse(400, "רשת לא מוכרת") };
  const publishedAtRaw = (form.get("publishedAt") as string | null) || undefined;
  let publishedAt: string | undefined;
  if (publishedAtRaw) {
    const t = Date.parse(publishedAtRaw);
    if (Number.isNaN(t)) return { error: errorResponse(400, "זמן פרסום לא תקין") };
    publishedAt = new Date(t).toISOString();
  }
  const name = file.name.replace(/[^\w.\-]/g, "_").slice(0, 200) || "upload";
  return { name, bytes: new Uint8Array(await file.arrayBuffer()), retailerId, publishedAt, force: form.get("force") === "true" };
}
