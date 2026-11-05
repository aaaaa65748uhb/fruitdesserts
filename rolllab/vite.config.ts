import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` keeps the built site portable: it works from any sub-folder
// (GitHub Pages, Netlify, a plain static host or a local file server).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1800,
  },
  server: { host: true },
})
