import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        squid: {
          pink: '#FF8FC8',
          'pink-light': '#FFD6EB',
          'pink-dark': '#F2609F',
          purple: '#A78BFA',
          'purple-light': '#E9D5FF',
          'purple-dark': '#7C5CE0',
          blue: '#7DD3FC',
          'blue-light': '#D0F0FF',
          cream: '#FFF9FC',
          ink: '#3D2A4A',
        },
      },
      fontFamily: {
        display: ['var(--font-rubik)', 'Rubik', 'sans-serif'],
        body: ['var(--font-assistant)', 'Assistant', 'sans-serif'],
      },
      borderRadius: {
        squish: '2rem',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(167, 139, 250, 0.15)',
        'soft-pink': '0 8px 30px rgba(255, 143, 200, 0.25)',
        pop: '0 4px 0 0 rgba(61, 42, 74, 0.15)',
      },
      keyframes: {
        squish: {
          '0%, 100%': { transform: 'scale(1, 1)' },
          '25%': { transform: 'scale(1.08, 0.92)' },
          '50%': { transform: 'scale(0.94, 1.06)' },
          '75%': { transform: 'scale(1.04, 0.96)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'bounce-soft': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '80%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        squish: 'squish 3s ease-in-out infinite',
        float: 'float 5s ease-in-out infinite',
        'bounce-soft': 'bounce-soft 2s ease-in-out infinite',
        wiggle: 'wiggle 2.5s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease-out both',
        pop: 'pop 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
