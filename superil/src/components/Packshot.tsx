import type { Product } from "@/lib/types";

/**
 * Generated placeholder packaging. This is NOT official product artwork; a small "איור" mark says so.
 * When a product has a licensed imageUrl, it is shown instead.
 */
export function Packshot({ product, size = 160, className = "" }: { product: Product; size?: number; className?: string }) {
  if (product.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={product.imageUrl} alt={product.nameHe} width={size} height={size} className={`object-contain ${className}`} loading="lazy" />;
  }
  const { shape, color, accent } = product.packaging;
  const name = product.nameHe.length > 14 ? product.nameHe.slice(0, 13) + "…" : product.nameHe;
  const body = (() => {
    switch (shape) {
      case "bottle":
        return <path d="M42 8h16v14c0 4 12 8 12 20v48a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6V42c0-12 12-16 12-20z" fill={color} stroke="#0002" />;
      case "can":
        return <rect x="28" y="16" width="44" height="76" rx="8" fill={color} stroke="#0002" />;
      case "carton":
        return <path d="M28 28l8-14h28l8 14v64H28z" fill={color} stroke="#0002" />;
      case "jar":
        return (
          <g>
            <rect x="32" y="16" width="36" height="12" rx="3" fill={accent} />
            <rect x="26" y="26" width="48" height="66" rx="10" fill={color} stroke="#0002" />
          </g>
        );
      case "tub":
        return <path d="M22 34h56l-6 56H28z" fill={color} stroke="#0002" />;
      case "bag":
        return <path d="M24 14q26 6 52 0l-2 78q-24 5-48 0z" fill={color} stroke="#0002" />;
      case "roll":
        return <rect x="18" y="26" width="64" height="64" rx="14" fill={color} stroke="#0002" />;
      case "loaf":
        return <path d="M18 54q0-26 32-26t32 26v34H18z" fill={color} stroke="#0002" />;
      case "produce":
        return <circle cx="50" cy="56" r="34" fill={color} stroke="#0002" />;
      default:
        return <rect x="24" y="12" width="52" height="80" rx="4" fill={color} stroke="#0002" />;
    }
  })();
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={`${product.nameHe} – איור אריזה להמחשה`}>
      <ellipse cx="50" cy="95" rx="30" ry="4" fill="#0001" />
      {body}
      {shape !== "produce" && <rect x="22" y="48" width="56" height="22" fill={accent} opacity="0.92" />}
      <text x="50" y="57" textAnchor="middle" fontSize="8" fontWeight="700" fill={shape === "produce" ? "#fff" : color === "#ffffff" ? "#111" : contrast(accent)} direction="rtl">
        {product.brand.slice(0, 12)}
      </text>
      <text x="50" y="67" textAnchor="middle" fontSize="7.5" fill={shape === "produce" ? "#fff" : contrast(accent)} direction="rtl">
        {name}
      </text>
      <text x="96" y="99" textAnchor="end" fontSize="5" fill="#64748b">איור</text>
    </svg>
  );
}

function contrast(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#111827" : "#ffffff";
}
