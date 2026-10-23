"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useCart } from "@/client/cart-store";
import { useSettings } from "@/client/settings-store";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 } } }),
  );
  useEffect(() => {
    // Persisted state is restored after mount so server and first client render match.
    void useCart.persist.rehydrate();
    void useSettings.persist.rehydrate();
    // Keep the cart in sync across tabs.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "superil-cart-v1") void useCart.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
