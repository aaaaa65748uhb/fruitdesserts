import { json } from "@/server/api";
import { getOfficialSource, getPriceMode, getProvider } from "@/server/providers";

export const dynamic = "force-dynamic";

export async function GET() {
  // Public information only: price mode, which retailers/branches are covered, and source statuses.
  return json({ providers: await (await getProvider()).getDataFreshness(), priceMode: await getPriceMode(), coverage: await getOfficialSource().coverage() });
}
