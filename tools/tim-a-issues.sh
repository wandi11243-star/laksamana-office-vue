#!/usr/bin/env bash
# Creates the Tim A labels and work issues described in docs/migrasi/TIM-A.md.
# Idempotent: an issue whose exact title is already open is reused, not duplicated.
#
#   gh auth login            # once per device
#   bash tools/tim-a-issues.sh
#   bash tools/tim-a-issues.sh --dry-run
set -euo pipefail

VUE=dwipapap/laksamana-office-vue
API=dwipapap/laksamana-api
DRY=${1:-}
DOC="docs/migrasi/TIM-A.md"

run() { if [ "$DRY" = "--dry-run" ]; then echo "[dry] $*" >&2; else "$@"; fi; }

label() { # repo name color description
  run gh label create "$2" --repo "$1" --color "$3" --description "$4" --force >/dev/null
}

# issue repo title labels body -> prints the issue number
issue() {
  local repo=$1 title=$2 labels=$3 body=$4 n
  n=$(gh issue list --repo "$repo" --state open --search "\"$title\" in:title" --json number,title \
      --jq ".[] | select(.title == \"$title\") | .number" | head -1)
  if [ -n "$n" ]; then echo "ada   #$n $title" >&2; echo "$n"; return; fi
  if [ "$DRY" = "--dry-run" ]; then echo "[dry] buat: $title [$labels]" >&2; echo "0"; return; fi
  n=$(gh issue create --repo "$repo" --title "$title" --label "$labels" --body "$body" | grep -oE '[0-9]+$')
  echo "baru  #$n $title" >&2
  echo "$n"
}

blk() { # list of issue numbers -> "Diblokir oleh" line
  local out="" n
  for n in "$@"; do out="$out #$n"; done
  printf '**Diblokir oleh:**%s — jangan mulai sebelum semuanya tertutup (%s §1).' "$out" "$DOC"
}

modul_body() { # modul cakupan extra
  cat <<EOF
Bangun modul **\`$1\`** di Vue. Cakupan: $2.

- Spesifikasi: \`docs/migrasi/$1.md\` (bagian C–H), kontrak \`laksamana-api/docs/api/<modul>.md\`.
- Prompt agen: \`docs/migrasi/PROMPT-modul.md\` (isi \`{{ISSUE}}\` dengan nomor issue ini).
- Aturan paralel & file yang boleh diubah: \`$DOC\` §2 dan §4. Entri shell: di bawah penanda \`// ── $1 ──\` di \`app/utils/modul-shell.ts\`.
- Modul ≥ 20 layar boleh dipecah jadi sub-issue per kelompok layar.
- Selesai = Definition of Done \`PLAN.md\` §5, termasuk bagian J (progres) dan K (daftar uji cutover).

$3
EOF
}

echo "== label" >&2
for r in $VUE $API; do label $r tim-a 1d76db "Tim A — migrasi ke laksamana-office-vue"; done
label $VUE jalur:fondasi 5319e7 "Jalur fondasi (TIM-A.md §3)"
label $VUE jalur:sdm 0e8a16 "Jalur SDM: jadwal, hr"
label $VUE jalur:uang fbca04 "Jalur uang: cashier, finance"
label $VUE jalur:konten-marketing d93f0b "Jalur konten & marketing"
label $VUE jalur:operasional 006b75 "Jalur operasional: stock, event"
label $VUE jalur:penyelesaian bfdadc "Jalur penyelesaian: visual, analytics, investor, cutover"
label $VUE fondasi b60205 "Menyentuh file bersama: PR kecil, merge duluan"
label $VUE blocked 000000 "Menunggu issue lain"
label $VUE owner c5def5 "Butuh keputusan/aksi owner"

echo "== fondasi" >&2
F1=$(issue $VUE "fondasi: port xlsx-baca.ts" "tim-a,jalur:fondasi,fondasi" "$(cat <<EOF
Port \`laksamana-office/deploy/assets/xlsx-baca.js\` ke \`app/utils/xlsx-baca.ts\` (fungsi murni, tanpa dependensi; K-05 butir 2).

Pemakai: jadwal, hr (Talenta), konten, cashier, finance, analytics. Pemilik: jalur fondasi (\`PLAN.md\` §4, \`$DOC\` §3).
Sertakan uji kecil dengan contoh .xlsx dari Office lama. PR kecil, merge secepatnya: lima issue menunggu ini.
EOF
)")
F2=$(issue $VUE "fondasi: port performa-bonus.ts" "tim-a,jalur:fondasi,fondasi" "$(cat <<EOF
Port \`laksamana-office/deploy/assets/performa-bonus.js\` ke \`app/utils/performa-bonus.ts\` (fungsi murni).

Pemakai: finance, event, marketing. Dipindah dari finance ke jalur fondasi supaya ketiganya tidak saling menunggu (\`$DOC\` §3).
EOF
)")

echo "== modul" >&2
J=$(issue $VUE "migrasi: jadwal (+dw +roster)" "tim-a,jalur:sdm,blocked" \
  "$(modul_body jadwal "jadwal + dw + roster, 20 layar; membangun \`pax-harian.ts\` (\`satukan()\`, dipakai radar). K-10: backlog." "$(blk $F1)")")
issue $VUE "migrasi: hr" "tim-a,jalur:sdm,blocked" \
  "$(modul_body hr "17 layar; membangun \`people-score.ts\`. K-01 (G-13): tombol massal \"Segera\". Dikerjakan setelah jadwal (jalur yang sama)." "$(blk $F1)")" >/dev/null
C=$(issue $VUE "migrasi: cashier" "tim-a,jalur:uang,blocked" \
  "$(modul_body cashier "11 layar; membangun \`cocok-bri.ts\` dan \`porsi-pic.ts\` (K-04: dua rumus SENGAJA berbeda). Pakai \`DanaMasukPanel\` dari reservasi." "$(blk $F1)")")
issue $VUE "migrasi: finance" "tim-a,jalur:uang,blocked" \
  "$(modul_body finance "omset + kas + brankas + rekap, 29 layar; G-06. Impor \`cocok-bri\`/\`porsi-pic\` dari cashier, \`performa-bonus\` dari fondasi." "$(blk $F1 $F2 $C)")" >/dev/null
K=$(issue $VUE "migrasi: konten" "tim-a,jalur:konten-marketing,blocked" \
  "$(modul_body konten "20 layar; membangun \`performa-konten.ts\` (dipakai analytics). K-01 (G-13)." "$(blk $F1)")")
issue $VUE "migrasi: marketing" "tim-a,jalur:konten-marketing,blocked" \
  "$(modul_body marketing "23 layar + detail event; membangun \`hpp-mesin.ts\`. G-09. Impor \`venue-layouts\`/\`kwitansi\` dari reservasi." "$(blk $F2)")" >/dev/null
issue $VUE "migrasi: stock" "tim-a,jalur:operasional" \
  "$(modul_body stock "5 panel, 26 layar. K-05 (ekspor CSV), K-06 (Apps Script seperti lama), K-07 (izinkan usage-only)." "Tidak diblokir: boleh langsung mulai.")" >/dev/null
issue $VUE "migrasi: event" "tim-a,jalur:operasional,blocked" \
  "$(modul_body event "17 layar staf (ticketing publik BUKAN Office). K-01 (G-13), K-08 (matriks izin tidak disimpan), K-09 (G-10)." "$(blk $F2)")" >/dev/null

echo "== penyelesaian" >&2
issue $VUE "cek visual modul gelombang 1" "tim-a,jalur:penyelesaian" "$(cat <<EOF
Cek di browser pada 390px dan 1366px (AGENTS.md): akademi, hlife, bd, reservasi + service_excellent, radar, help, homepage (Event & Promo).
Bandingkan dengan Office lama (\`deploy/<modul>\`). Perbaikan kecil di branch \`fix/visual-<modul>\`, satu PR per modul.
Hanya file milik modul itu (\`$DOC\` §4); perubahan komponen \`App*\` lewat issue \`fondasi\` baru.
EOF
)" >/dev/null
issue $VUE "migrasi: analytics" "tim-a,jalur:penyelesaian,blocked" \
  "$(modul_body analytics "18 layar; inventaris ringkas, pakai backend + CK Kompas. Impor \`performa-konten\`, \`xlsx-baca\`, \`venue-layouts\`." "$(blk $F1 $K)")" >/dev/null
issue $VUE "migrasi: investor" "tim-a,jalur:penyelesaian" \
  "$(modul_body investor "6 layar (1 masuk + 5 tab); pakai backend Kompas + Account." "Tidak diblokir.")" >/dev/null
issue $VUE "cutover: prasyarat sekali jalan" "tim-a,owner" "$(cat <<EOF
Checklist di \`docs/migrasi/cutover.md\` §"Prasyarat sekali jalan": domain Vue production, CORS production,
\`NUXT_PUBLIC_API_BASE\` build production, hosting + cara deploy, build dev ke dev-api.
EOF
)" >/dev/null
issue $VUE "keputusan owner: K-11 dan K-12" "tim-a,owner" "$(cat <<EOF
Dua keputusan di \`docs/migrasi/_pertanyaan.md\` masih ⬜:
- **K-11** reservasi: "Restore dari Backup" dan "Hapus Semua Data" dibawa ke Vue atau tidak.
- **K-12** bd/radar: teks sisa waktu promo (sementara dipakai opsi A).
EOF
)" >/dev/null

echo "== gap API (laksamana-api)" >&2
issue $API "akademi v1: gap G-16, G-17, G-18 dari Vue" "tim-a" "$(cat <<EOF
Ditemukan saat membangun akademi di laksamana-office-vue (gelombang 1, 2026-10-01). Rincian dan bukti:
\`laksamana-office-vue/docs/migrasi/_gap-api.md\` §G-16..G-18.

- **G-16** whole-state (kirim/ambil/pulihkan backup): v1 hanya \`GET /state\`. Usul: \`POST /akademi/admin/import\` (pola G-13), atau nyatakan tidak dibawa.
- **G-17** \`DELETE /akademi/materials/{id}\` dan \`/programs/{id}\` tidak menghapus progress terkait (\`AkademiRecords::delete\`). Usul: cascade di server.
- **G-18** sinkron roster Office hanya untuk admin modul (\`routes/v1.php:41-46\`). Usul: izinkan pemegang modul, atau sinkron di server.

Setelah issue ini ada, koordinator memperbarui tabel status di \`_gap-api.md\`.
EOF
)" >/dev/null

echo "selesai." >&2
