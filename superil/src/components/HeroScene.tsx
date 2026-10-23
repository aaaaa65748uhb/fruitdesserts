/** Lightweight SVG perspective illustration of a supermarket aisle for the home page (no WebGL needed). */
const PACK_COLORS = ["#f4b400", "#c62828", "#1565c0", "#2e7d32", "#ef6c00", "#6a1b9a", "#00838f", "#d81b60", "#fdd835", "#4e342e"];

export function HeroScene() {
  const shelves = [0, 1, 2, 3];
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-xl" aria-hidden>
      <svg viewBox="0 0 400 300" className="h-full w-full drop-shadow-2xl">
        <defs>
          <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d6d3cb" />
            <stop offset="1" stopColor="#f5f3ee" />
          </linearGradient>
          <linearGradient id="ceil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e2e8f0" />
          </linearGradient>
          <clipPath id="hero-clip">
            <rect width="400" height="300" rx="24" />
          </clipPath>
        </defs>
        <g clipPath="url(#hero-clip)">
        <rect width="400" height="300" fill="#e8ece7" />
        <polygon points="0,0 400,0 250,110 150,110" fill="url(#ceil)" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={170 - i * 30} y={20 + i * 25} width={60 + i * 60} height="4" rx="2" fill="#fffbe6" opacity={0.9 - i * 0.15} />
        ))}
        <polygon points="0,300 400,300 250,170 150,170" fill="url(#floor)" />
        <polygon points="190,300 210,300 202,170 198,170" fill="#10b981" opacity="0.6" />
        {/* left shelf (perspective) */}
        <polygon points="0,30 150,110 150,175 0,290" fill="#f1f5f9" />
        {/* right shelf */}
        <polygon points="400,30 250,110 250,175 400,290" fill="#f1f5f9" />
        {shelves.map((s) => {
          const t = s / 4;
          const yL0 = 60 + t * 200;
          const yL1 = 118 + t * 50;
          return (
            <g key={s}>
              <line x1="0" y1={yL0 + 40} x2="150" y2={yL1 + 12} stroke="#047857" strokeWidth={4 - t * 2} />
              <line x1="400" y1={yL0 + 40} x2="250" y2={yL1 + 12} stroke="#047857" strokeWidth={4 - t * 2} />
              {Array.from({ length: 9 }).map((_, i) => {
                const u = i / 9;
                const xL = u * 150;
                const yTop = yL0 + (yL1 - yL0) * u;
                const h = (40 - u * 28) * 0.85;
                const w = (16 - u * 10);
                const colorL = PACK_COLORS[(i + s * 3) % PACK_COLORS.length];
                const colorR = PACK_COLORS[(i * 7 + s) % PACK_COLORS.length];
                return (
                  <g key={i}>
                    <rect x={xL + 2} y={yTop + 38 - h - (12 - u * 10) * 0} width={w} height={h} rx="1.5" fill={colorL} />
                    <rect x={xL + 2} y={yTop + 38 - h * 0.55} width={w} height={h * 0.18} fill="#ffffffaa" />
                    <rect x={398 - xL - w} y={yTop + 38 - h} width={w} height={h} rx="1.5" fill={colorR} />
                    <rect x={398 - xL - w} y={yTop + 38 - h * 0.55} width={w} height={h * 0.18} fill="#ffffffaa" />
                  </g>
                );
              })}
            </g>
          );
        })}
        {/* hanging aisle sign */}
        <line x1="170" y1="40" x2="170" y2="62" stroke="#475569" />
        <line x1="230" y1="40" x2="230" y2="62" stroke="#475569" />
        <rect x="150" y="62" width="100" height="26" rx="4" fill="#047857" />
        <circle cx="236" cy="75" r="9" fill="#fbbf24" />
        <text x="236" y="79" textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f172a">1</text>
        <text x="196" y="79" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">חטיפים וממתקים</text>
        {/* cart */}
        <g transform="translate(250 205)">
          <rect x="0" y="0" width="70" height="42" rx="4" fill="none" stroke="#64748b" strokeWidth="3" />
          <rect x="6" y="-12" width="18" height="22" rx="2" fill="#f4b400" />
          <rect x="26" y="-8" width="14" height="18" rx="2" fill="#c62828" />
          <rect x="42" y="-14" width="14" height="24" rx="2" fill="#1565c0" />
          <line x1="70" y1="0" x2="86" y2="-14" stroke="#047857" strokeWidth="4" strokeLinecap="round" />
          <circle cx="12" cy="52" r="6" fill="#111827" />
          <circle cx="58" cy="52" r="6" fill="#111827" />
        </g>
        </g>
      </svg>
    </div>
  );
}
