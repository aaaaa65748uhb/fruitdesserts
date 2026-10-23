import type { Metadata } from "next";
import { CartPageClient } from "./CartPageClient";

export const metadata: Metadata = { title: "סל הקניות" };

export default function CartPage() {
  return <CartPageClient />;
}
