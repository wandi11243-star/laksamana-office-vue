# laksamana-office-vue — notes for coding agents

Nuxt 4 + Nuxt UI v4 SPA (`ssr: false`, PWA) for Laksamana Muda's office. Backend: laksamana-api
(`/api/v1`, Bearer tokens, envelope `{data, meta}` / `{error:{code,message}}`); per-module contracts in
`../laksamana-api/docs/api/<module>.md`. Read **CONTRIBUTING.md** (how) and **DESIGN.md** (look) first.

Hard rules:
- API calls only through `useApi()`; show errors with `apiErrorMessage(e)`. Field names exactly as the API sends them.
- Session token only through `useToken()` — never `useCookie('lm_token')` directly. Nuxt flushes the cookie write on the
  next tick, so `useToken()` mirrors it in `useState`; a request fired right after `login()` must still see it.
- Module pages: `definePageMeta({ access: [...] })` with the keys from `app/utils/modul.ts`. Module calls + types in `app/composables/use<Module>.ts`.
- Design (DESIGN.md): **rebuild each screen in the old Office's layout** — same section order, table columns, stat
  cards and button positions as `../laksamana-office/deploy/<module>`. Blocks: `AppPage` (+`#actions`), `AppStatGrid`/`AppStat`,
  `AppPanel`, `AppFilterGrid`, `AppChips`, `AppSeg`, `AppStatus` (colour + icon + word), `AppSectionTitle`, `AppPilihan`, `AppBar`,
  `UTable` (`lg+`, cards below), `ResponsiveSheet` for forms. Module chrome (sidebar screens, `+`, bell, badges) in `app/utils/modul-shell.ts`.
  Lucide icons instead of the old emoji (emoji only inside WhatsApp message text). Gold text = `text-primary-700`. No hex colours
  in components; no gradients. Restyle Nuxt UI in `app/app.config.ts`, don't wrap it.
- One page serves phone and desktop. Check 390px and 1366px **in a browser** (lint/typecheck do not catch runtime errors). The
  app is light-only: color mode is pinned to light in `nuxt.config.ts` and there is no theme picker — do not add `dark:` styles
  or a toggle. Without a local API, use a read-only mock; never point the dev server at dev or production data.
- UI copy in Indonesian, sentence case. Code comments in English.
- No new dependencies without asking. Before finishing: `npm run lint && npm run typecheck`.
- `../laksamana-office` is the old app: read-only reference (menus, flows). Never edit it.
