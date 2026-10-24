import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminEnabled, isAdminSession } from "@/server/admin-auth";
import { AdminLogin, AdminPrices } from "./AdminPrices";

export const metadata: Metadata = { title: "ניהול מחירים", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPricesPage() {
  if (!adminEnabled()) notFound();
  return <div className="mx-auto max-w-6xl px-4 py-8">{(await isAdminSession()) ? <AdminPrices /> : <AdminLogin />}</div>;
}
