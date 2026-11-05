import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
})

export const Icon = {
  Undo: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  ),
  Reset: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  ),
  SoundOn: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  ),
  SoundOff: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M11 5 6 9H3v6h3l5 4V5z" />
      <path d="m22 9-6 6M16 9l6 6" />
    </svg>
  ),
  Bag: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  Orbit: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <ellipse cx="12" cy="12" rx="10" ry="4.5" />
      <path d="M12 2v3M12 19v3" />
      <circle cx="12" cy="12" r="2.2" />
    </svg>
  ),
  Close: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  Plus: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Minus: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M5 12h14" />
    </svg>
  ),
  ArrowRight: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  ArrowLeft: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  ),
  Check: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  ),
  Drizzle: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M3 14c3-6 5 6 9 0s6 6 9 0" />
    </svg>
  ),
  Zigzag: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="m3 6 4 12 5-12 5 12 4-12" />
    </svg>
  ),
  Spiral: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M12 12a1.5 1.5 0 1 1 1.5 1.5A3.5 3.5 0 1 1 17 10a6 6 0 1 1-5-4" />
    </svg>
  ),
  Glaze: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
    </svg>
  ),
  Hand: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-7a1.5 1.5 0 0 1 3 0V12M14 11.5V6.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.5 15a1.5 1.5 0 0 1 2.5-1.6L8 16" />
    </svg>
  ),
  Sparkle: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  ),
  Receipt: (p: SVGProps<SVGSVGElement>) => (
    <svg {...base(p)}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  ),
}

/** The ROLL LAB swirl mark. */
export function Swirl({ color = '#7A4325', bg, size }: { color?: string; bg?: string; size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      {bg && <circle cx="20" cy="20" r="19" fill={bg} />}
      <path
        d="M20 9.5c5.8 0 10.5 4.7 10.5 10.5S25.8 30.5 20 30.5 9.5 25.8 9.5 20c0-4.4 3.6-8 8-8 3.5 0 6.3 2.8 6.3 6.3 0 2.8-2.2 5-5 5-2.1 0-3.8-1.7-3.8-3.8 0-1.7 1.3-3 3-3"
        fill="none"
        stroke={color}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Mini roll swatch for the dough picker. */
export function DoughSwatch({ dough, crust, filling }: { dough: string; crust: string; filling: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" fill={crust} />
      <circle cx="20" cy="20" r="16" fill={dough} />
      <path
        d="M20 8.5c6.4 0 11.5 5.1 11.5 11.5S26.4 31.5 20 31.5 8.5 26.4 8.5 20c0-4.8 3.9-8.7 8.7-8.7 3.8 0 6.9 3.1 6.9 6.9 0 3-2.4 5.4-5.4 5.4-2.3 0-4.1-1.8-4.1-4.1"
        fill="none"
        stroke={filling}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
