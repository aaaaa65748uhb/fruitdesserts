export default function SquidgetLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="squid-body" x1="0" y1="0" x2="64" y2="64">
          <stop offset="0%" stopColor="#FF8FC8" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      {/* גוף התמנון */}
      <ellipse cx="32" cy="26" rx="20" ry="18" fill="url(#squid-body)" />
      {/* זרועות */}
      <path
        d="M14 38c-2 6-6 8-6 12 0 3 3 5 5 3s1-6 4-9M24 42c-1 7-4 10-3 14 1 3 4 3 5 1 2-3 0-8 2-12M40 42c1 7 4 10 3 14-1 3-4 3-5 1-2-3 0-8-2-12M50 38c2 6 6 8 6 12 0 3-3 5-5 3s-1-6-4-9"
        stroke="url(#squid-body)"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* עיניים */}
      <circle cx="25" cy="24" r="4" fill="#3D2A4A" />
      <circle cx="39" cy="24" r="4" fill="#3D2A4A" />
      <circle cx="26.5" cy="22.5" r="1.5" fill="white" />
      <circle cx="40.5" cy="22.5" r="1.5" fill="white" />
      {/* לחיים */}
      <circle cx="18" cy="30" r="3" fill="#FFB3D9" opacity="0.9" />
      <circle cx="46" cy="30" r="3" fill="#FFB3D9" opacity="0.9" />
      {/* חיוך */}
      <path
        d="M27 32c2 3 8 3 10 0"
        stroke="#3D2A4A"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
