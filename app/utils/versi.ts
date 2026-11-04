// Version & conflict helper — fondasi F1, shared by every module.
//
// laksamana-api versions all v1 writes the same way: a read hands back a
// `version` in `meta` (plus an ETag header), the write sends it again as
// `If-Match`. Two refusals matter:
//
// - 428 `version_required` — the write carried no version at all, so our copy
//   predates the contract. The fix is to read again before the next attempt.
// - 409 `version_conflict`  — someone else wrote in between. The live record
//   travels in `error.details.current`.
//
// A version is opaque: an `updatedAt` in ms, a revision number or a 16-character
// content hash. Echo it back, never compute or compare it ourselves.
//
// Source: laksamana-api/docs/api/reservasi.md "Concurrency";
//         laksamana-api/docs/api/bd.md:74; docs/migrasi/00-fondasi.md F1.
import type { FetchError } from 'ofetch'

export type Versi = string | number

/** Header for a versioned write. */
export const ifMatch = (v: Versi) => ({ 'If-Match': `"${v}"` })

/** `meta.version` of an envelope, if that read produced one. */
export function versiDari(res?: { meta?: Record<string, unknown> } | null): Versi | undefined {
  const v = res?.meta?.version
  return typeof v === 'string' || typeof v === 'number' ? v : undefined
}

/** True for 409 version_conflict. */
export const isKonflik = (e: unknown) => apiErrorCode(e) === 'version_conflict'

/** True for 428 version_required: the write went out without a version. */
export const isVersiWajib = (e: unknown) => apiErrorCode(e) === 'version_required'

/** The live record the server sent with a 409, or undefined. */
export function konflikTerkini<T>(e: unknown): T | undefined {
  const details = (e as FetchError<ApiErrorBody>)?.data?.error?.details as { current?: T } | undefined
  return details?.current
}

/**
 * Call after a failed write. On a version conflict: toast + run `muatUlang`,
 * return true. Otherwise return false so the caller shows apiErrorMessage(e).
 * A `muatUlang` that throws adds a second toast and still returns true.
 *
 * Usage — the pattern every module repeats:
 *
 *   try {
 *     await useReservasi().updateReservation(id, body, ifMatch(versi))
 *   }
 *   catch (e) {
 *     if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
 *   }
 *
 * Nothing is overwritten automatically and no write is ever retried silently:
 * the person checks the reloaded data and saves again.
 */
export async function tanganiKonflik(e: unknown, muatUlang: () => Promise<unknown>): Promise<boolean> {
  if (!isKonflik(e) && !isVersiWajib(e)) return false

  const toast = toastDiLuarKonteks()

  // Toast FIRST: if the reload itself fails (offline, server down), the person
  // still has to be told their write was refused. Swallowing that failure would
  // leave a screen that looks refreshed but is not.
  toast?.add(isKonflik(e)
    ? {
        title: 'Data sudah diubah orang lain',
        description: 'Tampilan dimuat ulang dengan versi terbaru. Periksa lalu simpan lagi.',
        color: 'warning',
      }
    : {
        title: 'Data belum punya versi',
        description: 'Tampilan dimuat ulang dari server. Periksa lalu simpan lagi.',
        color: 'warning',
      })

  try {
    await muatUlang()
  }
  catch (err) {
    // Still `true`: the write WAS refused by a version check, not by this reload.
    // The caller must not fall back to apiErrorMessage(e) and hide the real reason.
    toast?.add({
      title: 'Gagal memuat ulang data',
      description: apiErrorMessage(err),
      color: 'error',
    })
  }

  return true
}

/**
 * One shared versioned-write wrapper: run `aksi`, reload, toast the outcome.
 * The success toast fires only when `sukses` is given — silent writes (the old
 * bdTulisDiam lane: checkbox flips, drags, auto-saves) omit it. A 409/428
 * goes through `tanganiKonflik` (which reloads and toasts); any other error
 * toasts `apiErrorMessage`. Callers pass their own state's refresh as
 * `muatUlang` so every module reloads its own keys.
 */
export async function tulisBerVersi<T>(aksi: () => Promise<T>, opt: { sukses?: string, muatUlang: () => Promise<unknown> }): Promise<boolean> {
  const toast = toastDiLuarKonteks()
  try {
    await aksi()
    await opt.muatUlang()
    if (opt.sukses) toast?.add({ title: opt.sukses, color: 'success' })
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, opt.muatUlang))) toast?.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
}

/**
 * `useToast()` reached from an event handler: the Vue context is gone by then,
 * and `inject()` outside setup() warns in dev. Step back into it. (The Nuxt
 * context stays reachable on its own: the app instance is set once at start.)
 * `tanganiKonflik` is a plain function, not a composable, so it cannot ask for
 * the toast at setup time.
 */
function toastDiLuarKonteks() {
  return tryUseNuxtApp()?.vueApp.runWithContext(() => useToast()) ?? null
}
