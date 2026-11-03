# Port delta laksamana-office → Vue/API (fetch 2026-11-04, 35 commit)

Lacak status per batch. Aturan mode: tanpa lint/typecheck/test/commit sampai user bilang selesai; commit per batch bila diminta.

## WS1 — Vue kecil, tanpa API (paralel: WS1a + WS1b)
- [x] WS1a reservasi+stok: review awal Approved + fix round bersih (re-review + verifikasi langsung: typo OK, ket OK, tanpa field Bentuk Simpanan — zero-only lengkap). Catatan: CSV kini string tampil ("4 Botol") — keputusan sadar; bila ada konsumen mesin, tambah kolom mentah nanti.
- [x] WS1b bd+finance: review Approved + fix union-divisi terverifikasi langsung di kode. WS1 SELESAI (sisa cek browser manusia).

## WS2 — BD agenda package (Vue saja, sekuensial setelah WS1b)
- [x] WS2a (selesai, review+fix bersih): RSVP + undang Tim tanpa akses; agenda berdivisi + undang per divisi; jam deadline task. Catatan: wording "8 cocok" vs cap-8 hasil cari — kosmetik, bukan gate.
- [x] WS2b (selesai, review+fix bersih): hour-grid + drag + dashboard LM Agenda + inbox Undangan & Notifikasi. Sisa kategori-5 pindah ke WS-API-1.
- [x] WS-API-1 (selesai, diverifikasi): Xendit GRUP+BANK + agendaRentang Event/Marketing + docs + 4 tes baru + wiring Vue. Tes: Event+Marketing 63 hijau (termasuk 4 baru); Kompas 50 hijau + 3 gagal PRA-ADA (dibuktikan via stash). PHP tidak ada di mesin ini — CI yang konfirmasi final.
- [x] WS3-API (selesai, diverifikasi diff): konversi kirim dua-arah + tolak tak-terukur + updateDelivery (guard kiriman, audit diubah≤20, aturan basi) + satuanTampil kontrak + docs + 5 tes baru. 78/78 Stock hijau.
- [x] WS3-Vue (selesai, review Approved): opsi kirim + modal ubah + pita basi + dropdown tampil. Catatan reviewer: `packIsi` tidak pernah dikirim di body simpan produk (pra-ada, di luar scope) — follow-up terpisah: cek alur simpan packIsi.
- [x] WS4-API (selesai, 88/88 hijau): ads/jalan + objek + ubah + riset/suggest/bank kontrak baru + docs + 9 tes. Secrets (`META_ADS_TOKEN`/setting) perlu diisi manual di server.
- [x] WS4-Vue-1 (selesai, review Approved): kartu jalan + kelola. Minor defensif ''-vs-null diperbaiki langsung (3 baris ads.vue).
- [x] WS4-Vue-2 (selesai, review Approved): periode riset/insight/bank.

## SEMUA BATCH SELESAI (review bersih semua)

## TERSISA (non-kode): cek browser manusia, commit+push, deploy API (+ isi secret Meta), deploy Vue prod.

## WS3 — Stok kiriman (perlu API, sekuensial)
- [ ] Paket konversi kirim (satuan bahan + Pack + stok, dua arah, tolak tak-terukur)
- [ ] Paket ubah kiriman (modal + audit `diubah` + aturan basi)
- [ ] Field `satuanTampil` (kontrak + dropdown + hormati di ck.vue)

## WS4 — Meta ads (perlu API, sekuensial)
- [ ] Endpoint `ads/jalan` + secret + kartu berjalan; perluasan kampanye/paused/filter/urut; kelola jeda-budget + log + gate; periode/fokus riset-insight-bank

## WS5 — Xendit Report Daily (perlu API kecil)
- [ ] `GRUP`+`BANK` += xendit (API) + `PAYS`/`RK_GRUP`/pita di Vue

## Keputusan tercatat
- `?buka=` form-always dsb. tetap (ledger plan task-konten-link).
- `media`/`it` di `Tim.php`: opsional, owner belum memutuskan → tunda.
- Cek Google email-match: tidak perlu (layar belum dimigrasi).
- `3464da7` murni BD → masuk WS2 (dashboard/inbox LM Agenda).
