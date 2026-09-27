// SPA on a VPS; the backend is laksamana-api on the cPanel (ADR-0005 in laksamana-api).
// `npm run build` = `nuxt generate` -> static files in .output/public, served by nginx.
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', '@vite-pwa/nuxt'],
  ssr: false,
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Laksamana Office',
      meta: [{ name: 'theme-color', content: '#0A0A09' }],
      link: [{ rel: 'icon', type: 'image/png', href: '/mark.png' }],
    },
  },
  css: ['~/assets/css/main.css'],

  // Baked in at BUILD time (static output): set NUXT_PUBLIC_API_BASE before `npm run build`.
  runtimeConfig: {
    public: { apiBase: 'https://dev-api.laksamanamuda.id/api/v1' },
  },
  devServer: { port: 3000 },
  compatibilityDate: '2026-09-01',

  eslint: { config: { stylistic: true } },

  // Icons are bundled from @iconify-json/lucide; nothing is fetched at runtime.
  icon: { serverBundle: false, clientBundle: { scan: true } },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Laksamana Office',
      short_name: 'Office',
      description: 'Office Laksamana Muda · Coffee & Live Space',
      lang: 'id',
      start_url: '/',
      display: 'standalone',
      background_color: '#F3F3F1',
      theme_color: '#0A0A09',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
    },
  },
})
