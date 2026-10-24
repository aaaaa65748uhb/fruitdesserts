import type { NextRequest } from "next/server";
import { json } from "@/server/api";
import { getProvider } from "@/server/providers";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const clip = (v: string | null) => v?.slice(0, 60) || undefined;
  const branches = await (await getProvider()).getBranches(clip(sp.get("retailerId")), {
    city: clip(sp.get("city")),
    zipCode: clip(sp.get("zip")),
  });
  return json({
    branches,
    note: branches.length
      ? undefined
      : "לא נמצאו סניפים. סניפים מוצגים רק מקבצי סניפים או מחירים רשמיים שיובאו – איננו מציגים סניפים משוערים.",
  });
}
