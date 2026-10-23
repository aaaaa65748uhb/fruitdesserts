"use client";
import dynamic from "next/dynamic";

const Store3D = dynamic(() => import("@/components/store3d/Store3D"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-gradient-to-b from-brand-900 to-slate-900 text-white">
      <p className="text-lg font-bold">טוענים את הסופר…</p>
    </div>
  ),
});

export function StoreClient() {
  return (
    <div className="fixed inset-0 bg-slate-900">
      <Store3D />
    </div>
  );
}
