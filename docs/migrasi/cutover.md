# Fase 3 — Cutover per modul

Memindahkan user dari layar Office lama ke Vue, **satu modul setiap kali**.
Dikerjakan owner; agen hanya menyiapkan daftar uji dan catatan.

## Kenapa per modul aman

Menurut ADR-0005 laksamana-api (`laksamana-api/docs/adr/0005-production-on-api-subdomain-for-new-apps-only.md`),
laksamana-api production melayani `/api/v1` dari **database legacy yang sama** dengan Office lama,
memakai **lock yang sama** (`NamedLock`) dan penjaga versi yang sama (`RowSync`). Jadi:

- user A di Office lama dan user B di Vue bisa mengubah modul yang sama tanpa saling menimpa diam-diam
  (yang kalah mendapat konflik, bukan kehilangan data);
- rollback cukup dengan "kembali pakai layar lama" — tidak ada data yang perlu dipindah.

Yang **tidak** dilakukan di fase ini: memindah database modul ke `core`. Itu jalur terpisah di
laksamana-api (ADR-0002/0004, issue #46–#74) dan **baru boleh setelah layar lama modul itu pensiun**.

## Prasyarat sekali jalan (sebelum modul pertama)

- [ ] Domain Vue production ditetapkan (placeholder sekarang: `office.laksamanamuda.id`).
- [ ] Domain itu masuk `CORS_ALLOWED_ORIGINS` di `.env` laksamana-api production.
- [ ] Build production memakai `NUXT_PUBLIC_API_BASE=https://api.laksamanamuda.id/api/v1`
      (dibaca saat build — dev dan production build terpisah, `CONTRIBUTING.md` "Build & deploy").
- [ ] Hosting Vue (Docker + `nginx.conf`, atau folder statis di cPanel) dan cara deploy-nya.
- [ ] Build dev terhubung ke `dev-api.laksamanamuda.id` untuk tahap C1.

## Tahap per modul

| tahap | apa | siapa | keluar dari tahap bila |
|---|---|---|---|
| **C0 Siap** | PR modul di-merge, Definition of Done (`PLAN.md` §5) terpenuhi | agen + owner | merge |
| **C1 Uji dev** | owner + 1–2 user kunci menjalankan daftar uji di Vue **dev** (data dev) | owner | semua butir lulus / tercatat |
| **C2 Pilot** | Vue production dibuka untuk 2–5 user modul itu; layar lama tetap tersedia | owner | ±1 minggu pemakaian nyata tanpa masalah berat |
| **C3 Pindah** | semua user modul diarahkan ke Vue; layar lama tetap bisa dibuka sebagai cadangan | owner | ±2 minggu tanpa rollback |
| **C4 Pensiun** | Kartu modul di Office lama disembunyikan/diarahkan ke Vue | **developer laksamana-office** atas permintaan owner (repo itu read-only bagi kita) | layar lama tidak dipakai lagi |
| **C5 Core** | (opsional, jalur laksamana-api) database modul pindah ke `core` menurut ADR-0004 | owner + laksamana-api | milestone laksamana-api |

**Rollback:** di C1–C3 cukup kembali ke layar lama. Setelah C5 tidak ada rollback lewat layar lama.

## Ketergantungan cutover antarmodul

Pensiunkan (C4) dalam urutan yang tidak meninggalkan layar lama tanpa pasangannya:

- **reservasi → cashier → finance**: Dana Masuk Cashier/Finance lama adalah iframe Reservasi lama.
  Jangan pensiunkan Reservasi lama sebelum Cashier & Finance Kas pindah ke Vue.
- **cashier + finance/omset + kompas**: satu blob Kompas. Boleh C2/C3 terpisah, tapi C4 dan C5 bersama.
- **jadwal + dw + absensi**: absensi membaca shift jadwal & DW di server (tidak terpengaruh layar),
  jadi urutan bebas; jadwal dan dw pensiun bersama (satu Kartu "Roster").
- **reservasi + service_excellent**: satu backend; boleh pensiun terpisah.
- **event** ↔ ticketing publik: ticketing publik tidak ikut (bukan Office).

## Daftar uji per modul (disiapkan agen di akhir Fase 2)

Agen modul menambahkan bagian **K. Daftar uji cutover** di `<modul>.md`: satu baris per layar dan
per aksi tulis penting, dalam bahasa user ("Buka Input Reservasi, isi tamu baru, simpan, pastikan
muncul di Dashboard dan di Office lama"). Setiap aksi tulis wajib diuji juga **silang**:
ubah di Vue → terlihat di Office lama, dan sebaliknya.

## Status cutover

| modul | C0 | C1 | C2 | C3 | C4 | catatan |
|---|---|---|---|---|---|---|
| absensi | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | C4 baru setelah punch & wajah pindah (PLAN #15); sampai itu PWA tetap dipakai |
| akademi | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| hlife | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| konten | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| bd | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| hr | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| jadwal (+dw) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| reservasi (+SE) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | C4 setelah cashier & finance |
| cashier | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| finance | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| stock | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| event | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| marketing | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| analytics, radar, investor, help | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
