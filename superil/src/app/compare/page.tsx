import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareClient } from "./CompareClient";

export const metadata: Metadata = { title: "השוואת מחירים" };

export default function ComparePage() {
  return (
    <Suspense>
      <CompareClient />
    </Suspense>
  );
}
