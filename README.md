# Laksamana Office (Vue)

Office baru Laksamana Muda: satu aplikasi web untuk HP (bisa dipasang sebagai PWA) dan desktop, di atas [laksamana-api](https://github.com/dwipapap/laksamana-api).

- **Stack:** Nuxt 4 (SPA) · Nuxt UI v4 · Tailwind v4 · Lucide · PWA
- **Hosting:** file statis di VPS (nginx/Docker). API di `api.laksamanamuda.id` (cPanel).
- **Mulai:** `npm install && cp .env.example .env && npm run dev`, lalu buka http://localhost:3000

| Dokumen | Isi |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Menjalankan, struktur, menambah modul, aturan, deploy |
| [DESIGN.md](DESIGN.md) | Design language: warna, tipografi, blok bangunan, tulisan |
| `/styleguide` (dev) | Semua komponen dalam tema Laksamana, terang dan gelap |
| [AGENTS.md](AGENTS.md) | Ringkasan aturan untuk AI coding agent |

Status: scaffold. Yang sudah ada: login, beranda per user, menu modul sesuai hak akses, profil (ganti PIN, tema), dan contoh modul **Absensi** (riwayat). Modul lain menyusul. Lihat CONTRIBUTING.md › Menambah modul.
