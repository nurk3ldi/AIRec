import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Tailwind runs through its own Vite plugin rather than PostCSS. The plugin is
// what Tailwind v4 ships for bundlers that support it, and it removes the
// postcss.config.mjs + @tailwindcss/postcss + postcss chain the Next build
// needed — one less place for the pipeline to be configured.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The port the backend's CORS_ORIGINS is written for. Vite would otherwise
    // pick the next free port when 3000 is busy and the API would start
    // refusing the browser's requests with no obvious cause.
    port: 3000,
    strictPort: true,
  },
})
