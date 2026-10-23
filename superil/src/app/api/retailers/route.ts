import { json } from "@/server/api";
import { getProvider } from "@/server/providers";

export async function GET() {
  return json({ retailers: await (await getProvider()).getRetailers() });
}
