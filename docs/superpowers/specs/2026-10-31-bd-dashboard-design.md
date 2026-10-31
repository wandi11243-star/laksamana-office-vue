# BD Dashboard unification — short design

Tanggal: 2026-10-31 · Keputusan arah diserahkan owner ke saya (pilihan di bawah = usulan saya).

## Intent & why

Dashboard Task Management Vue disusun ulang agar menjawab dua hal sekaligus
dalam sekali pandang: triase pagi ("apa yang kukerjakan hari ini dan besok",
jiwa dashboard lama) dan kondisi keseluruhan (jiwa dashboard Vue). Untuk kru
BD yang membuka halaman ini tiap pagi; berhasil bila mereka tak perlu lagi
membuka dashboard lama.

## Goals / non-goals / anti-goals

- Goals: kolom Hari ini/Besok/Lusa (agenda + deadline per hari); daftar Belum
  ada deadline dengan aksi Atur deadline inline; Menunggu respons; Project
  berjalan; sapaan + tanggal + aksi cepat (Task baru, Agenda).
- Non-goals: tidak mengubah logika data/endpoint; tidak menyentuh halaman
  My Task/Projects/Calendar; tidak menambah dependensi.
- Anti-goals: gagal bila halaman jadi dua dashboard ditumpuk (stat + triase
  tanpa hirarki) atau bila terlihat generik tanpa karakter posko pagi hari.

## Constraints

- Blok App* + DESIGN.md; copy Indonesia; komentar Inggris.
- `useApi()`/state yang sudah ada (`useBdState`, `menungguReviewSaya`,
  `dalamLingkup`); tanpa endpoint baru.
- Antislop active: during (session override). Dial dari DESIGN.md (Operate):
  ENERGY 2 / RHYTHM 2 / MOTION 1 (keputusan saya). Aturan mengikat: tanpa
  hex, tanpa gradient, light-only, kontras AA, 390px & 1366px, keyboard.

## Approaches

- A. Klon lama persis (kolom 3-hari + 3 daftar, buang kartu angka & fokus).
  Ditolak: membuang yang sudah bagus di Vue (fokus, angka kondisi).
- B. Pertahankan Vue, tempel daftar yang hilang di bawah. Ditolak: jadi dua
  dashboard ditumpuk, hirarki pagi hari hilang.
- C. Hibrida (DIPILIH): satu alur pagi — sapaan + fokus, kolom 3-hari,
  daftar aksi (tanpa deadline, menunggu respons, project berjalan), kartu
  angka sebagai strip kondisi di bawah. Alasan: triase dulu (butuh aksi),
  status kemudian (butuh tahu); tiap seksi ada karena kontennya butuh.

## Yang diputuskan (usulan saya, perlu persetujuanmu)

1. Urutan: sapaan+tanggal+aksi → Fokus hari ini → Hari/Besok/Lusa →
   Belum ada deadline + Menunggu respons + Project berjalan → strip angka
   (5 AppStat ringkas) → peringatan divisi (bila ada).
2. Kolom hari: agenda + deadline per tanggal; klik buka sheet/detail yang ada.
3. Tanpa deadline: tombol "Atur deadline" inline per baris (sheet yang ada).
4. Menunggu respons = `menungguReviewSaya`; Project berjalan = `jalan` yang ada.
5. Aksi "Agenda" menuju form agenda di kalender (link, bukan tombol mati).
6. Mobile: kolom menumpuk, pola `lg+` yang sudah ada.

## Diserahkan ke builder

- Detail copy per seksi mengikuti pola lama (judul + sub-teks tanggal).
- Skeleton/error/empty states ikut (aturan repo + R-27).
- Cek browser 390px & 1366px terang + keyboard.
