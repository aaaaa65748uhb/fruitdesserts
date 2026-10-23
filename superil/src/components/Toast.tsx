"use client";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useUi } from "@/client/ui-store";

export function Toast() {
  const toast = useUi((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast || !visible) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2">
      <div key={toast.id} className="animate-pop flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-float">
        <CheckCircle2 className="h-5 w-5 text-brand-500" />
        {toast.text}
      </div>
    </div>
  );
}
