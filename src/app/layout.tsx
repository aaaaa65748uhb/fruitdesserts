import type { Metadata } from 'next';
import { Assistant, Rubik } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import DemoBanner from '@/components/DemoBanner';
import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import './globals.css';

const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  variable: '--font-rubik',
  display: 'swap',
});

const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  variable: '--font-assistant',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Squidget — סקווישים שכיף למעוך',
  description:
    'חנות הסקווישים הוויראלית של ישראל. סקווישים רכים, חמודים וממכרים עם חוויית Unboxing בלתי נשכחת.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} ${assistant.variable}`}>
      <body className="flex min-h-screen flex-col">
        <AuthProvider>
          <CartProvider>
            <DemoBanner />
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
