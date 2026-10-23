import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = { title: "המשך לקנייה ברשת" };

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutClient />
    </Suspense>
  );
}
