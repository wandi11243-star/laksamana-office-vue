---
name: laksamana-office-vue-change
description: Use when implementing frontend fixes or features, module integration, or API-consumer changes in laksamana-office-vue. Trace pages and module contracts, reuse Nuxt conventions, and verify behavior at phone and desktop sizes.
---

# Change Laksamana Office Vue

## Trace the screen and its callers

Read the [repo conventions](../../../AGENTS.md) and [contributor guide](../../../CONTRIBUTING.md). Follow the page through access metadata, the module composable, and the backend contract in the sibling `laksamana-api/docs/api/` directory. Check other consumers of any helper or composable being changed. If a sibling checkout is absent (for example in CI or a cloud agent), say which contract or legacy reference could not be read and report that check as pending instead of guessing field names or layout.

For module behavior or migration work, read the relevant inventory under [docs/migrasi](../../../docs/migrasi/) and its [plan](../../../docs/migrasi/PLAN.md). Compare the affected flow with the old Office under the sibling `laksamana-office/deploy/<module>` as a read-only reference. Preserve existing caller behavior, including calls that omit newly introduced parameters, unless the task changes it.

## Reuse API and module conventions

Apply the API hard rules in [AGENTS.md](../../../AGENTS.md) (see [useApi.ts](../../../app/composables/useApi.ts)). Branch on `apiErrorCode()` when a screen must react to a specific refusal.

For versioned writes, follow [the version helpers](../../../app/utils/versi.ts) and existing callers. Read and return the contract's version and handle 409/428 by refreshing and showing the conflict. Preserve the user's ability to review stale edits before retrying.

Reuse shared formatters and module-owned calculations. When routes or available actions change, check module keys, page access, screen registration, and shell navigation together. The contributor guide documents their locations and patterns.

## Follow the existing screen design

For UI changes, read [DESIGN.md](../../../DESIGN.md) and open the legacy screen side by side before building. Reuse the blocks listed in AGENTS.md instead of new wrappers.

## Verify behavior

Run the relevant `uji:*` scripts from [package.json](../../../package.json) as the affected calculations or module helpers change. Follow the contributor guide's pre-push guard checks and the lint, typecheck, and build requirements in the [CI workflow](../../../.github/workflows/ci.yml). Use the workflow's strict guard mode when checking the CI guard requirement.

Check changed screens in a browser at 390px and 1366px. Exercise the affected interaction and its applicable loading, empty, error, access, and conflict states.

Report actual command results and the browser widths and interactions checked. Identify any pending verification and the prerequisite needed to complete it.
