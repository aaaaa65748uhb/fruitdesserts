import type { NextRequest } from "next/server";
import { errorResponse, json, productIdSchema } from "@/server/api";
import { getProvider } from "@/server/providers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!productIdSchema.safeParse(id).success) return errorResponse(400, "Invalid id");
  const provider = await getProvider();
  const product = await provider.getProductById(id);
  if (!product) return errorResponse(404, "המוצר לא נמצא");
  const branchId = req.nextUrl.searchParams.get("branchId") ?? undefined;
  const offers = await provider.getProductOffers(id, { branchId: branchId?.slice(0, 80) });
  return json({ product, offers });
}
