'use client';

import { isDemoMode } from '@/lib/firebase';

export default function DemoBanner() {
  if (!isDemoMode) return null;
  return (
    <div className="no-print bg-squid-ink px-4 py-1.5 text-center text-xs text-white">
      🧪 מצב דמו — הנתונים נשמרים מקומית בדפדפן בלבד. להפעלה מלאה יש להגדיר מפתחות Firebase (ראו
      README).
    </div>
  );
}
