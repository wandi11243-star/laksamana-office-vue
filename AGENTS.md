# laksamana-office-vue — notes for coding agents

For frontend fixes, features, module integration, or API-consumer changes in this repo, read and apply the [shared change skill](.agents/skills/laksamana-office-vue-change/SKILL.md) before editing.

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
  Lucide icons instead of the old emoji (emoji only inside WhatsApp message text). Accent = Laksamana gold (CTA `color="primary"` = white on `#85600F`; active = `gold-soft`/`gold-deep`);
  WattVision dashboard look: borderless white cards with a soft shadow, sidebar on `bg-shell`, display face Plus Jakarta Sans
  for titles and KPI numbers, no pastel card/tile backgrounds; 16px cards, 10px fields. No hex colours
  in components; no gradients (two exceptions: the `ubin-emas` module icon tile copied from the old launcher, and the `bar-emas` Task Management progress fill). Module card
  icons are the old launcher's own SVGs (`i-laks-*`, `app/assets/icons`). Restyle Nuxt UI in `app/app.config.ts`, don't wrap it.
- One page serves phone and desktop. Check 390px and 1366px **in a browser** (lint/typecheck do not catch runtime errors). The
  app is light-only: color mode is pinned to light in `nuxt.config.ts` and there is no theme picker — do not add `dark:` styles
  or a toggle. Pointing the dev server at the dev API (`dev-api.laksamanamuda.id`) is fine, writes included;
  never point it at production (`api.laksamanamuda.id`). Read-only mocks are optional.
- UI copy in Indonesian, sentence case in the source. Buttons and headings (h1–h4, `AppSectionTitle`) are shown in Title Case by CSS
  (`capitalize` in `app.config.ts` button + `main.css` base) — owner request, Nov 2026; opt out with `normal-case`. Code comments in English.
- No new dependencies without asking. Before finishing: `npm run lint && npm run typecheck`.
- `../laksamana-office` is the old app: read-only reference (menus, flows). Never edit it.
- No AI attribution: Never add `Co-Authored-By: Claude …` (or any AI co-author trailer) to a commit, and never write "Generated with Claude Code", 🤖, or any other mention of Claude/AI in PR, issue or review text. Commits and PRs appear as the developer's own work.
