// SPA on a VPS; the backend is laksamana-api on the cPanel (ADR-0005 in laksamana-api).
// `npm run build` = `nuxt generate` -> static files in .output/public, served by nginx.
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', '@vite-pwa/nuxt'],
  ssr: false,

  // `app/utils/layar/<modul>.ts` holds each module's screen list (fondasi F4);
  // auto-imported so a page only writes LAYAR_RESERVASI in its template.
  imports: { dirs: ['utils/layar'] },

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Laksamana Office',
      meta: [{ name: 'theme-color', content: '#F7F6F4' }],
      link: [
        { rel: 'icon', type: 'image/png', href: '/mark.png' },
        { rel: 'apple-touch-icon', type: 'image/png', sizes: '192x192', href: '/icon-192.png' },
      ],
    },
  },
  css: ['~/assets/css/main.css'],

  // Light only: the Office never runs dark. `preference` + `fallback` pin the
  // light theme for everyone; the new storageKey ignores any dark value a device
  // stored under the old key, and the theme picker is gone from Profil.
  colorMode: {
    preference: 'light',
    fallback: 'light',
    storageKey: 'lm-color-mode',
  },

  // Baked in at BUILD time (static output): set NUXT_PUBLIC_API_BASE before `npm run build`.
  runtimeConfig: {
    public: {
      apiBase: 'https://dev-api.laksamanamuda.id/api/v1',
      // The public website, for "Lihat di website" links (NUXT_PUBLIC_HOMEPAGE_BASE).
      homepageBase: 'https://laksamanamuda.id',
    },
  },
  devServer: { port: 3000 },

  // Poll /_nuxt/builds/latest.json every 5 min (default is 1h) to detect a new deploy.
  experimental: {
    checkOutdatedBuildInterval: 5 * 60_000,
  },
  compatibilityDate: '2026-09-01',

  eslint: { config: { stylistic: true } },

  // Icons are bundled from @iconify-json/lucide; nothing is fetched at runtime.
  // `laks` = the old Office launcher's own module icons (deploy/index.html ICONS),
  // copied path for path into app/assets/icons/*.svg so the cards match exactly.
  icon: {
    serverBundle: false,
    clientBundle: { scan: true },
    customCollections: [{ prefix: 'laks', dir: './app/assets/icons' }],
  },

  pwa: {
    registerType: 'autoUpdate',
    client: {
      // Periodic update check every 10 min (registration.update()).
      periodicSyncForUpdates: 600,
    },
    manifest: {
      name: 'Laksamana Office',
      short_name: 'Office',
      description: 'Office Laksamana Muda · Coffee & Live Space',
      lang: 'id',
      start_url: '/',
      display: 'standalone',
      background_color: '#F7F6F4',
      theme_color: '#F7F6F4',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      // Precache the shell only (#147): html/css/icons/fonts. Route chunks
      // stay out, so a deploy stops re-downloading megabytes (TipTap et al.
      // ride only /homepage/berita/:id); they are fetched on demand and kept
      // by the runtime cache below, so an offline reload still works.
      globPatterns: ['**/*.{html,css,png,svg,ico,woff2}'],
      // `nuxt generate` writes one <route>/index.html per page (~270), all the
      // same SPA shell, and every build changes them: precached, each deploy
      // re-downloaded them all (each via a 301 to the trailing slash) and then
      // autoUpdate reloaded the open page mid-way. navigateFallback serves the
      // root shell for every route, so only that one is precached. The Help
      // screenshots (~2.4 MB) load when a chapter is opened (runtime cache below).
      globIgnores: ['*/**/index.html', '200.html', '404.html', 'help/gambar/**'],
      runtimeCaching: [
        {
          urlPattern: /\/help\/gambar\//,
          handler: 'CacheFirst' as const,
          options: {
            cacheName: 'help-gambar',
            expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 },
          },
        },
        {
          // Never cache /_nuxt/builds/ so Nuxt's outdated-build check always hits the network.
          urlPattern: ({ url }) => url.pathname.startsWith('/_nuxt/') && !url.pathname.startsWith('/_nuxt/builds/'),
          handler: 'StaleWhileRevalidate' as const,
          options: {
            cacheName: 'nuxt-assets',
            expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
          },
        },
      ],
    },
  },
})
