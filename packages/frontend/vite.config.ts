import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        // Precache only the shell: index.html, manifest, CSS, the entry/main JS
        // chunks and the small icon set. Lazy route chunks, vendor chunks and
        // the 48 hashed flag SVGs are fetched on demand by the browser cache,
        // not eagerly precached on first visit. (OPS-010)
        globPatterns: [
          'index.html',
          'manifest.webmanifest',
          'offline.html',
          'icons/icon-*.png',
          'icons/apple-touch-icon*.png',
          'favicon.ico',
          'assets/index-*.js',
          'assets/index-*.css',
        ],
        globIgnores: [
          '**/flag-icons/**',
          'assets/*.svg',
          'assets/*.png',
          'assets/*.jpg',
          'assets/*.webp',
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  envDir: path.resolve(__dirname, '../..'),
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks let returning visitors cache them across deploys
        // even when our app code changes. (OPS-010)
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/\/node_modules\/(vue|vue-router|pinia|@vue)\//.test(id)) return 'vue'
          if (/\/node_modules\/(@intlify\/|vue-i18n)/.test(id)) return 'i18n'
          if (/\/node_modules\/@supabase\//.test(id)) return 'supabase'
          return undefined
        },
      },
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
