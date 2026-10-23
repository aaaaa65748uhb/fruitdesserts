import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchClient } from "./SearchClient";

export const metadata: Metadata = { title: "חיפוש מוצרים" };

export default function SearchPage() {
  return (
    <Suspense>
      <SearchClient />
    </Suspense>
  );
}
