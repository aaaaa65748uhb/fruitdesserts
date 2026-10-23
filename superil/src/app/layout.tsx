import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { CartDrawer } from "@/components/CartDrawer";
import { SiteHeader } from "@/components/SiteHeader";
import { Toast } from "@/components/Toast";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: `${BRAND_NAME} – ${BRAND_TAGLINE}`, template: `%s | ${BRAND_NAME}` },
  description: "הליכה בסופרמרקט תלת־ממדי, השוואת מחירים בין רשתות והמשך לקנייה באתר הרשת.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#047857" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh">
        <Providers>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
            דלג לתוכן
          </a>
          <SiteHeader />
          <main id="main">{children}</main>
          <CartDrawer />
          <Toast />
        </Providers>
      </body>
    </html>
  );
}
