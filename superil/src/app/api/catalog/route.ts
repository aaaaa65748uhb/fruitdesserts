import { json } from "@/server/api";
import { getProvider } from "@/server/providers";

/** Full catalog for the 3D store layout and cart reconciliation. */
export async function GET() {
  const provider = await getProvider();
  return json({ products: await provider.getAllProducts() });
}
