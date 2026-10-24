import { json } from "@/server/api";
import { getPriceRepository } from "@/server/prices/service";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe for hosting platforms. Reveals nothing beyond "ok" / "unavailable". */
export async function GET() {
  try {
    await (await getPriceRepository()).ping();
    return json({ status: "ok" });
  } catch {
    return json({ status: "unavailable" }, { status: 503 });
  }
}
