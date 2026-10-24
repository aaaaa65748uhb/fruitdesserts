"use client";
import { Activity, FileUp, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Navigation for the private admin area (never linked from public pages). */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/status", label: "מצב מוכנות", icon: Activity },
    { href: "/admin/prices", label: "ייבוא מחירים והתאמות", icon: FileUp },
  ];
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 p-2 text-sm text-white">
        <span className="px-3 font-bold">ניהול SUPERIL</span>
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 ${pathname === href ? "bg-white text-ink" : "hover:bg-white/10"}`}>
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
        <button
          type="button"
          className="mr-auto inline-flex items-center gap-1 rounded-xl px-3 py-1.5 hover:bg-white/10"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
            window.location.href = "/admin/prices";
          }}
        >
          <LogOut className="h-4 w-4" /> יציאה
        </button>
      </div>
      {children}
    </div>
  );
}
