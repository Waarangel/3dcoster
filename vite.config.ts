import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Build-time constant: true when built via `tauri build`, false for web builds
  // TAURI_ENV_PLATFORM is set by Tauri CLI during beforeBuildCommand
  define: {
    __IS_TAURI__: JSON.stringify(!!process.env.TAURI_ENV_PLATFORM),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: '3D Print Cost Calculator',
        short_name: '3DCoster',
        description: 'Calculate true cost per print for selling on marketplaces',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
    // Visualizer is opt-in (D-10): only loaded when `vite build --mode analyze` runs.
    // The default Vercel deploy chain pays zero visualizer cost.
    ...(mode === 'analyze'
      ? [visualizer({ open: true, gzipSize: true, brotliSize: true, filename: 'dist/stats.html' })]
      : []),
  ],
  build: {
    // Disable automatic modulepreload link injection so the pdf chunk is NOT
    // preloaded on every page load — it is only fetched on first "Generate PDF"
    // click (lazy-loaded). The assert-no-pdf-preload.mjs CI gate verifies this.
    modulePreload: false,
    rollupOptions: {
      output: {
        // Vendor chunk splitting per D-01: 3 named chunks for React, Dexie, and other deps.
        // Function-style is clearer than object-style for the conditional logic and keeps the
        // file self-contained (no helper to test in isolation).
        // Order matters: the hooks package must be caught by its own substring match (NOT the
        // shorter `/dexie/`, which would also match it via path prefix). The function returns
        // undefined for non-node_modules ids — Rollup then bundles them into the default
        // main/lazy chunks (preserves the existing React.lazy route splits, D-03).
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
            if (id.includes('/dexie/') || id.includes('/dexie-react-hooks/')) return 'dexie-vendor';
            return 'vendor';
          }
          // Route all PDF dependencies to the lazily-loaded pdf chunk (Phase 16 D-01).
          // /jspdf/ and /jspdf-autotable/ match node_modules paths; /src/pdf/ matches the
          // generator module. Surrounding slashes prevent false matches on substrings.
          if (id.includes('/src/pdf/') || id.includes('/jspdf/') || id.includes('/jspdf-autotable/')) {
            return 'pdf';
          }
        },
      },
    },
  },
  server: {
    port: 4173,
  },
}))
