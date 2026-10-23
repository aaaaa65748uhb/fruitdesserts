"use client";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSearch } from "@/client/queries";

export function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data } = useSearch(q.trim());
  const go = (query: string) => router.push(`/search?q=${encodeURIComponent(query)}`);
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); go(q.trim()); }} className="relative">
      <label className="sr-only" htmlFor="home-search">חיפוש מוצר</label>
      <Search className="pointer-events-none absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        id="home-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="חפשו מוצר: במבה, קוטג׳, נייר טואלט…"
        className="w-full rounded-2xl bg-white py-4 pr-12 pl-28 text-lg text-ink shadow-lg outline-none"
        autoComplete="off"
      />
      <button type="submit" className="absolute top-2 left-2 rounded-xl bg-brand-700 px-5 py-2.5 font-bold text-white">חיפוש</button>
      {q.trim() && data?.suggestions.length ? (
        <ul className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-2xl bg-white text-ink shadow-xl">
          {data.suggestions.map((s) => (
            <li key={s}>
              <button type="button" onClick={() => go(s)} className="block w-full px-4 py-2.5 text-right hover:bg-slate-50">{s}</button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
