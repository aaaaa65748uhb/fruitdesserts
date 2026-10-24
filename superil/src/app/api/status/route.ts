import { json } from "@/server/api";
import { getPriceMode, getProvider } from "@/server/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ providers: await (await getProvider()).getDataFreshness(), priceMode: await getPriceMode() });
}
