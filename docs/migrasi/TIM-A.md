# Tim A — kerja paralel di laksamana-office-vue

Mulai 2026-10-06, migrasi tidak lagi dikerjakan berurutan oleh satu orang, tetapi paralel oleh
anggota Tim A di device masing-masing, masing-masing dengan Claude/agennya sendiri. Dokumen ini
adalah **aturan main** supaya pekerjaan tidak bentrok. Isinya mengalahkan aturan "satu modul sekaligus"
yang lama di `PLAN.md`.

Ingat: agen di device lain **tidak tahu** percakapan agen di device kamu. Semua yang perlu diketahui
orang lain harus ada di **issue GitHub** atau di repo.

## 1. Sumber kebenaran: GitHub Issues

Repo issue: [`dwipapap/laksamana-office-vue`](https://github.com/dwipapap/laksamana-office-vue/issues)
untuk pekerjaan Vue, [`dwipapap/laksamana-api`](https://github.com/dwipapap/laksamana-api/issues)
untuk gap API (label `tim-a`).

| aturan | kenapa |
|---|---|
| **Tidak ada issue = tidak ada kerja.** Setiap pekerjaan punya satu issue. | supaya terlihat siapa mengerjakan apa |
| **Assignee = kunci.** Sebelum mulai, assign dirimu dan beri komentar `mulai`. Issue yang sudah ada assignee-nya tidak disentuh orang lain. | mencegah dua orang membangun modul yang sama |
| **Issue `blocked` jangan dimulai** sampai issue yang memblokir ditutup (lihat "Diblokir oleh #N" di badan issue). | rumus bersama punya satu pemilik (`PLAN.md` §4) |
| **Status hidup di issue**, bukan di `PLAN.md` §3. Komentar progres singkat minimal tiap hari kerja (layar selesai, `LANJUTKAN DARI`). | tabel status di satu file = bentrok di setiap PR |
| Modul ≥ 20 layar boleh dipecah pemegangnya jadi sub-issue per kelompok layar (tautkan ke issue induk). | PR kecil, review cepat |
| Temuan di luar cakupan issue → **buat issue baru**, jangan dikerjakan diam-diam di PR yang sama. | PR tetap satu topik |

Label:

| label | arti |
|---|---|
| `tim-a` | semua pekerjaan Tim A |
| `jalur:fondasi` `jalur:sdm` `jalur:uang` `jalur:konten-marketing` `jalur:operasional` `jalur:penyelesaian` | jalur kerja (§3) |
| `fondasi` | menyentuh file bersama (§4) — PR kecil, di-review & merge duluan |
| `blocked` | menunggu issue lain |
| `owner` | butuh keputusan/aksi owner, bukan agen |

## 2. Alur kerja di device masing-masing

```bash
# 1. ambil main terbaru
git switch main && git pull --ff-only

# 2. satu branch per issue, nama dari issue
git switch -c migrasi/<modul>          # modul utuh
git switch -c migrasi/<modul>-<grup>   # sub-issue kelompok layar
git switch -c fondasi/<nama>           # issue berlabel fondasi

# 3. push SEGERA + draft PR, supaya tim lihat branch-mu sejak hari pertama
git push -u origin HEAD
gh pr create --draft --title "feat(<modul>): ..." --body "Closes #<issue>"

# 4. tiap pagi / sebelum push: ikuti main
git fetch origin && git rebase origin/main   # lalu: git push --force-with-lease
```

- **Commit kecil, push sering** (minimal di akhir setiap sesi). Laptop rusak tidak boleh menghilangkan kerja sehari.
- Jangan pernah `git push --force` ke `main`; ke branch sendiri pakai `--force-with-lease`.
- Jangan commit ke branch orang lain. Mau bantu? Komentari PR-nya atau buat branch turunan.
- PR ditandai *Ready for review* bila DoD (`PLAN.md` §5) terpenuhi. **Yang me-merge: owner/reviewer**, bukan pembuat PR, bukan agen.
- **CI GitHub dimatikan** (kuota Actions, lihat `.github/workflows/ci.yml`). Jadi wajib lokal sebelum push:
  `npm run lint && npm run typecheck && npm run build`. Tulis hasilnya di badan PR.
- `.env` tiap device menunjuk ke **API lokal** atau mock read-only. Jangan pernah dev server ke data dev/production (AGENTS.md).

## 3. Jalur kerja

Satu jalur = satu orang (boleh dua orang di jalur yang sama bila tidak mengerjakan modul yang sama).
Isi kolom PJ saat pembagian; assignee di issue tetap yang mengikat. Keputusan owner yang masih
terbuka (K-11, K-12): #23.

| jalur | urutan issue | rumus bersama yang ia miliki (`PLAN.md` §4) | menunggu | PJ |
|---|---|---|---|---|
| **fondasi** | #9 `xlsx-baca.ts` → #10 `performa-bonus.ts` | `xlsx-baca.ts`, `performa-bonus.ts` | — | |
| **sdm** | #11 jadwal (+dw +roster) → #12 hr | `pax-harian.ts`, `people-score.ts` | `xlsx-baca` | |
| **uang** | #13 cashier → #14 finance | `cocok-bri.ts`, `porsi-pic.ts` | `xlsx-baca`, `performa-bonus` (finance) | |
| **konten-marketing** | #15 konten → #16 marketing | `performa-konten.ts`, `hpp-mesin.ts` | `xlsx-baca` (konten), `performa-bonus` (marketing) | |
| **operasional** | #17 stock → #18 event | — | `performa-bonus` (event) | |
| **penyelesaian** | #19 cek visual gelombang 1 · #20 analytics · #21 investor · #22 prasyarat cutover · gap G-16..G-18 (laksamana-api#228) | — | analytics menunggu konten (`performa-konten`) | |

Perubahan dari `PLAN.md` §4: **`xlsx-baca.ts` dan `performa-bonus.ts` dipindah ke jalur fondasi**, supaya
jalur sdm, uang, konten-marketing dan operasional tidak saling menunggu. Pemakai tetap mengimpor, tidak menyalin.

Jalur fondasi kecil: setelah dua issue itu selesai, PJ-nya pindah membantu jalur lain (ambil sub-issue).

Absensi punch (`PLAN.md` §3 baris 15) tetap paling akhir (K-02), tidak masuk jalur mana pun sampai semua modul selesai.

## 4. Peta kepemilikan file

Bentrok git terjadi kalau dua branch mengubah baris yang sama atau bersebelahan. Aturannya:

| file / folder | siapa boleh mengubah |
|---|---|
| `app/pages/<modul>/`, `app/composables/use<Modul>.ts`, `app/utils/layar/<modul>.ts`, `app/widgets/<modul>/`, `app/utils/<modul>*.ts`, `app/components/<Modul>*.vue`, `docs/migrasi/<modul>.md` | **hanya pemegang issue modul itu** |
| `app/utils/<rumus-bersama>.ts` (§3 kolom "rumus bersama") | hanya jalur pemiliknya; pemakai cukup mengimpor. Butuh perubahan? Komentar di issue pemilik |
| `app/utils/modul-shell.ts` | setiap modul menulis entrinya **tepat di bawah penanda** `// ── <modul> ──` yang sudah disiapkan. Jangan memindah/merapikan entri lain |
| `app/utils/modul.ts` | hanya baris modulmu sendiri (mis. menambah `widgets`). Kalau git bentrok di sini, selesaikan dengan menyimpan kedua sisi |
| `app/components/App*.vue`, `ModulMenu.vue`, `ResponsiveSheet.vue`, `app/utils/format.ts`, `versi.ts`, `layar.ts`, `app.config.ts`, `assets/css/main.css`, `layouts/`, `middleware/`, `useApi.ts`, `useMe.ts`, `useRoster.ts`, `DESIGN.md`, `nuxt.config.ts`, `package.json` | **hanya lewat issue berlabel `fondasi`**: PR terpisah, kecil, di-merge duluan; lalu semua `git rebase origin/main` |
| `docs/migrasi/PLAN.md` §3, `README.md` (tabel status), `cutover.md` (status) | **hanya owner/koordinator**, setelah PR modul di-merge |
| `docs/migrasi/_gap-api.md`, `_pertanyaan.md` | jangan diubah di PR modul. Gap baru → issue di `laksamana-api` (label `tim-a`); pertanyaan baru → issue label `owner` di repo ini. Koordinator menyalinnya ke file ini dengan ID G/K berikutnya |

Butuh komponen baru yang mungkin dipakai modul lain? Buat dulu di folder modulmu dengan nama `<Modul>…`. Kalau
nanti modul kedua butuh, pindahkan lewat issue `fondasi`. Jangan membuat komponen "umum" di PR modul.

## 5. Koordinasi harian (5 menit)

1. Buka daftar issue `tim-a` yang terbuka: siapa memegang apa, apa yang `blocked`.
2. Issue fondasi yang sudah di-merge → beri tahu tim untuk rebase; buka label `blocked` di issue yang menunggunya.
3. PR yang *Ready for review* → review & merge hari itu juga (PR yang tertahan lama = bentrok makin besar).
4. Koordinator memperbarui `PLAN.md` §3 untuk modul yang di-merge.

## 6. Prompt agen

`PROMPT-modul.md` tetap dipakai, dengan tambahan: sebutkan nomor issue di prompt, dan agen boleh
`git push` branch-nya sendiri serta membuka draft PR, tetapi **tidak boleh merge** dan tidak mengubah file
di luar §4 baris pertama tanpa issue `fondasi`.
