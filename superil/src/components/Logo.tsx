import { BRAND_NAME } from "@/lib/brand";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden>
        <rect x="2" y="2" width="36" height="36" rx="11" fill="#047857" />
        <path d="M10 14h3l3.2 11.2h11.6L31 17H15" fill="none" stroke="#fbbf24" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="17.5" cy="29.5" r="2" fill="#fff" />
        <circle cx="26" cy="29.5" r="2" fill="#fff" />
      </svg>
      <span dir="ltr">{BRAND_NAME}</span>
    </span>
  );
}
