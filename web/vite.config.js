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
    // Bind every interface, not just localhost, so a phone on the same Wi-Fi
    // can open the dev server. Vite prints the LAN URL as "Network:" on start.
    host: true,

    // The API and the uploaded files are served through this dev server rather
    // than reached directly, and that removes three obstacles at once.
    //
    // The browser only ever talks to port 3000, so the backend can stay on
    // 127.0.0.1 — no `--host 0.0.0.0`, and no Windows Firewall rule for port
    // 8000, which is where opening this from a phone actually gets stuck.
    // (Node already has an inbound rule from the first time Vite bound a port;
    // Python does not, and adding one needs an administrator.)
    //
    // And because the page and the API then share an origin, CORS stops being
    // involved at all — the browser has nothing to check.
    //
    // `/media` is proxied too: uploaded avatars and logos are served from the
    // backend *root*, not from under the `/api/v1` prefix.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
    // The port the backend's CORS_ORIGINS is written for. Vite would otherwise
    // pick the next free port when 3000 is busy and the API would start
    // refusing the browser's requests with no obvious cause.
    port: 3000,
    strictPort: true,
  },
})
