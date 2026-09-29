# Fase 1 — Fondasi bersama

Dikerjakan **sekali, sebelum modul mana pun**, dalam satu branch `migrasi/fondasi`.
Tujuannya supaya 13 agen modul tidak membuat 13 versi berbeda dari hal yang sama.

Status: ⬜ belum · 🟡 dikerjakan · ✅ selesai

| ID | tugas | status | file |
|---|---|---|---|
| F1 | Helper versi & konflik | ✅ | `app/utils/versi.ts`, contoh di `/styleguide` |
| F2 | Roster Office (`useRoster`) | ✅ | `app/composables/useRoster.ts` |
| F3 | Format angka & tanggal | ✅ | `app/utils/format.ts` |
| F4 | Konvensi layar modul + `ModulMenu` | ✅ | `app/utils/layar.ts`, `app/components/ModulMenu.vue`, `AppListRow` prop `dim`, contoh di `/styleguide` |
| F5 | Perbarui `CONTRIBUTING.md` | ✅ | bagian "Struktur" & "Menambah modul" |

Selesai 2026-09-29: `npm run lint && npm run typecheck && npm run build` hijau.
Koreksi build 2026-09-29: `rupiah()` memakai `Intl` id-ID, jadi hasilnya `Rp 1.250.000`
(spasi non-breaking) seperti contoh di `/styleguide`, bukan `Rp1.250.000` seperti
tertulis di tabel F3.

Aturan yang berlaku untuk semua tugas: `AGENTS.md`, `DESIGN.md`, `CONTRIBUTING.md`.
Komentar kode dalam bahasa Inggris, teks UI dalam bahasa Indonesia. Tanpa dependensi baru.
Selesai = `npm run lint && npm run typecheck && npm run build` hijau.

---

## F1 — Helper versi & konflik

**Masalah.** Semua tulisan v1 butuh versi. Aturannya sama di semua kontrak
(`laksamana-api/docs/api/bd.md:74`, `konten.md:51-55`, `marketing.md` "Versions and conflicts"):

- versi dibaca dari `meta.version` (atau header `ETag`);
- tulisan mengirim `If-Match: "<version>"` (atau `?version=` / `"version"` di body);
- tanpa versi → `428 version_required`;
- versi basi → `409 version_conflict`, record terkini ada di `error.details.current`;
- nilai versi bisa angka (ms / rev) atau string (hash) — perlakukan sebagai `string | number`, jangan dihitung.

**Buat `app/utils/versi.ts`** (auto-import Nuxt):

```ts
export type Versi = string | number

/** Header for a versioned write. */
export const ifMatch = (v: Versi) => ({ 'If-Match': `"${v}"` })

/** `meta.version` of an envelope, if any. */
export function versiDari(res: { meta?: Record<string, unknown> }): Versi | undefined

/** True for 409 version_conflict. */
export const isKonflik = (e: unknown) => apiErrorCode(e) === 'version_conflict'

/** The live record the server sent with a 409, or undefined. */
export function konflikTerkini<T>(e: unknown): T | undefined
```

**Perilaku UI standar saat konflik** — satu fungsi, dipakai semua modul:

```ts
/**
 * Call after a failed write. On a version conflict: toast + run `muatUlang`,
 * return true. Otherwise return false so the caller shows apiErrorMessage(e).
 */
export async function tanganiKonflik(e: unknown, muatUlang: () => Promise<unknown>): Promise<boolean>
```

Toast (`useToast()` Nuxt UI, `color: 'warning'`):
judul **"Data sudah diubah orang lain"**, isi
**"Tampilan dimuat ulang dengan versi terbaru. Periksa lalu simpan lagi."**
Jangan menimpa otomatis, jangan mengulang tulisan diam-diam.

**Contoh pemakaian** — tambahkan sebagai komentar JSDoc di `versi.ts`:

```ts
try {
  // path is illustrative; take the real one from the module's contract
  await useApi()(`/<modul>/<resource>/${id}`, { method: 'PUT', body, headers: ifMatch(versi) })
}
catch (e) {
  if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
}
```

Tampilkan contohnya di `/styleguide` (satu tombol yang memicu toast konflik tiruan tanpa memanggil API).

## F2 — Roster Office

Pengganti `listModuleRoster` / `listDivisiRoster` untuk semua modul (`_pertanyaan.md` U2).

**Buat `app/composables/useRoster.ts`:**

- `useRoster()` → `useAsyncData('roster', …GET /account/roster)`
- `useModulMembers(modul: string)` → `useAsyncData(\`members-${modul}\`, …GET /account/modules/{modul}/members)`
- Tipe `RosterUser` dan `ModulMember` — **baca bentuknya di `laksamana-api/docs/api/account.md` dan
  `laksamana-api/docs/api/jadwal.md:50` (kolom roster)**. Nama field persis seperti API, jangan diganti.
- Jangan menulis apa pun ke roster di sini. Penulisan roster (`POST/PATCH /account/roster`) hanya milik modul jadwal.

## F3 — Format angka & tanggal

**Buat `app/utils/format.ts`** — satu sumber untuk semua modul:

| fungsi | contoh |
|---|---|
| `rupiah(n)` | `1250000` → `Rp 1.250.000` (Intl `id-ID`, tanpa desimal; `null`/`undefined` → `—`) |
| `angka(n)` | `1250000` → `1.250.000` |
| `persen(n, digit = 1)` | `0.125` → `12,5%` |
| `tglPendek(tgl)` | `2026-09-27` → `Sab, 27 Sep` (pindahkan dari `useAbsensi.ts`, hapus yang lama) |
| `tglPanjang(tgl)` | `2026-09-27` → `Sabtu, 27 September 2026` |
| `jam(iso)` | → `14.05` |
| `hariIni()` | tanggal lokal `YYYY-MM-DD` (JANGAN `toISOString()` — itu UTC dan salah setelah 17.00 WIB) |

Angka di UI memakai class `num` (tabular) — sudah ada di DESIGN.md.

## F4 — Konvensi layar modul

Modul lama punya 5–29 layar (`NAV_DEF`). Vue memakai pola yang sama untuk semuanya:

```
app/pages/<modul>/index.vue          beranda modul: AppFocus (opsional) + ModulMenu
app/pages/<modul>/<layar>.vue        satu file per layar
app/pages/<modul>/<layar>/[id].vue   detail, bila ada
app/utils/layar/<modul>.ts           daftar layar modul itu
```

Modul berpanel (stock, finance) satu tingkat lebih dalam: `pages/stock/index.vue` = pemilih panel,
`pages/stock/ordering/index.vue` = beranda panel, `pages/stock/ordering/<layar>.vue`. Setiap halaman
panel memakai `definePageMeta({ access: ['ordering'] })` dengan kunci panelnya sendiri.

**Buat `app/utils/layar.ts`:**

```ts
export interface Layar {
  key: string          // the old NAV_DEF key, unchanged (e.g. 'perfinput')
  label: string        // sentence case, Indonesian
  desc?: string        // one line, from the old TITLES subtitle
  icon: string         // i-lucide-*
  to: string           // '/konten/perfinput'
  grup?: string        // optional section heading in the menu
  /** In-module check (role matrix, admin). Omit = everyone with the module. */
  boleh?: (me: Me) => boolean
}
```

**Buat `app/components/ModulMenu.vue`:** props `layar: Layar[]`. Merender `AppList` berkelompok
per `grup`, satu `AppListRow` per layar yang `boleh`, dengan ikon di kiri dan `desc` sebagai keterangan.
Layar yang file halamannya belum ada tampil `text-dimmed` + "Segera" dan tidak bisa diklik (pola sama
dengan `useModulNav`: cek `router.getRoutes()`).

Setiap halaman layar memakai `AppPage` dengan tautan kembali ke beranda modulnya.

Tambahkan contoh di `/styleguide`.

## F5 — Dokumentasi

Perbarui bagian "Menambah modul" di `CONTRIBUTING.md`: konvensi F4, pemakaian `ifMatch` +
`tanganiKonflik` (F1), `useRoster` (F2), `format.ts` (F3), dan rujukan ke `docs/migrasi/PLAN.md`.
Maksimal ±30 baris tambahan. Bahasa sama dengan isi file (Indonesia).

---

## Logika bisnis bersama — BUKAN bagian fondasi

Dipindah oleh modul **pertama** yang memakainya, ke `app/utils/<nama>.ts` sebagai fungsi murni.
Modul berikutnya WAJIB mengimpor file yang sama, tidak menyalin. Daftar pemilik ada di `PLAN.md` §4.
