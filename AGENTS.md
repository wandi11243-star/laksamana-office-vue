# laksamana-office-vue — notes for coding agents

Nuxt 4 + Nuxt UI v4 SPA (`ssr: false`, PWA) for Laksamana Muda's office. Backend: laksamana-api
(`/api/v1`, Bearer tokens, envelope `{data, meta}` / `{error:{code,message}}`); per-module contracts in
`../laksamana-api/docs/api/<module>.md`. Read **CONTRIBUTING.md** (how) and **DESIGN.md** (look) first.

Hard rules:
- API calls only through `useApi()`; show errors with `apiErrorMessage(e)`. Field names exactly as the API sends them.
- Session token only through `useToken()` — never `useCookie('lm_token')` directly. Nuxt flushes the cookie write on the
  next tick, so `useToken()` mirrors it in `useState`; a request fired right after `login()` must still see it.
- Module pages: `definePageMeta({ access: [...] })` with the keys from `app/utils/modul.ts`. Module calls + types in `app/composables/use<Module>.ts`.
- Design: yellow (primary) only as a fill for the one main action / "now" marker, never as text; one `AppFocus` per screen;
  content as `AppList`/`AppListRow`; status via `AppStatus`; forms in `ResponsiveSheet`; `UTable` only at `lg+`.
  No gradients, shadows, hex colours, emoji, uppercase eyebrows or card grids of big numbers. Restyle Nuxt UI in `app/app.config.ts`, don't wrap it.
- One page serves phone and desktop. Check both widths (390px and 1366px) and dark mode.
- UI copy in Indonesian, sentence case. Code comments in English.
- No new dependencies without asking. Before finishing: `npm run lint && npm run typecheck`.
- `../laksamana-office` is the old app: read-only reference (menus, flows). Never edit it.
