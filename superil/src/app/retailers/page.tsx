import type { Metadata } from "next";
import { RetailersClient } from "./RetailersClient";

export const metadata: Metadata = { title: "רשתות וסניפים" };

export default function RetailersPage() {
  return <RetailersClient />;
}
