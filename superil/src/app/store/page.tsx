import type { Metadata } from "next";
import { StoreClient } from "./StoreClient";

export const metadata: Metadata = { title: "הסופר בתלת־ממד" };

export default function StorePage() {
  return <StoreClient />;
}
