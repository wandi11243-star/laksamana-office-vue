// Membuat 19 issue visual (satu per modul) di laksamana-office-vue.
// Idempoten: judul yang sudah ada dilewati.
// Jalankan dari root repo: node tools/visual-issues/create.mjs
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const bodiesDir = join(root, 'tools', 'visual-issues', 'bodies')
mkdirSync(bodiesDir, { recursive: true })

const modules = [
  { key: 'finance', layar: '29', assignee: 'dwipapap', jalur: 'jalur:uang', deploy: '`laksamana-office/deploy/finance/`', vue: '`app/pages/finance/` (index, kas, brankas, omset)', api: '`laksamana-api/docs/api/finance.md`', spec: '`docs/migrasi/finance.md`' },
  { key: 'konten', layar: '20', assignee: 'dwipapap', jalur: 'jalur:konten-marketing', deploy: '`laksamana-office/deploy/konten/`', vue: '`app/pages/konten/` (index, dashboard, planning, 28 file)', api: '`laksamana-api/docs/api/konten.md`', spec: '`docs/migrasi/konten.md`' },
  { key: 'hr', layar: '17', assignee: 'dwipapap', jalur: 'jalur:sdm', deploy: '`laksamana-office/deploy/hr/`', vue: '`app/pages/hr/` (index, emp, kehadiran, 17 file)', api: '`laksamana-api/docs/api/hr.md`', spec: '`docs/migrasi/hr.md`' },
  { key: 'akademi', layar: '13', assignee: 'dwipapap', jalur: 'jalur:sdm', deploy: '`laksamana-office/deploy/akademi/`', vue: '`app/pages/akademi/` (index, dashboard, program, 14 file)', api: '`laksamana-api/docs/api/akademi.md`', spec: '`docs/migrasi/akademi.md`' },
  { key: 'reservasi', layar: '12', assignee: 'dwipapap', jalur: 'jalur:operasional', deploy: '`laksamana-office/deploy/reservasi/` dan `laksamana-office/deploy/service_excellent/`', vue: '`app/pages/reservasi/` (8) dan `app/pages/service_excellent/` (5)', api: '`laksamana-api/docs/api/reservasi.md`', spec: '`docs/migrasi/reservasi.md`' },
  { key: 'cashier', layar: '11', assignee: 'dwipapap', jalur: 'jalur:uang', deploy: '`laksamana-office/deploy/cashier/`', vue: '`app/pages/cashier/` (index, kasir, report, 12 file)', api: 'belum ada (catat sebagai gap bila butuh)', spec: '`docs/migrasi/cashier.md`' },
  { key: 'bd', layar: '11', assignee: 'dwipapap', jalur: 'jalur:operasional', deploy: '`laksamana-office/deploy/bd/`', vue: '`app/pages/bd/` (index, dashboard, projects, 14 file)', api: '`laksamana-api/docs/api/bd.md`', spec: '`docs/migrasi/bd.md`' },
  { key: 'homepage', layar: '5', assignee: 'dwipapap', jalur: 'jalur:penyelesaian', deploy: 'greenfield, rujukan `laksamana-homepage/` (tidak ada di deploy lama)', vue: '`app/pages/homepage/` (index, menu, berita, 6 file)', api: '`laksamana-api/docs/api/homepage.md`', spec: 'belum ada, susun daftar layar dari rujukan dan halaman Vue' },
  { key: 'help', layar: '3 jenis', assignee: 'dwipapap', jalur: 'jalur:penyelesaian', deploy: '`laksamana-office/deploy/help/`', vue: '`app/pages/help/` (index, [kunci])', api: 'belum ada (catat sebagai gap bila butuh)', spec: '`docs/migrasi/help.md`' },
  { key: 'investor', layar: '6', assignee: 'dwipapap', jalur: 'jalur:penyelesaian', deploy: '`laksamana-office/deploy/help/panduan/investor.js` (tidak ada folder deploy sendiri)', vue: '`app/pages/investor/` (index, masuk, laporan, 6 file)', api: 'belum ada (catat sebagai gap bila butuh)', spec: '`docs/migrasi/investor.md`' },
  { key: 'radar', layar: '6', assignee: 'dwipapap', jalur: 'jalur:penyelesaian', deploy: '`laksamana-office/deploy/radar/`', vue: '`app/pages/radar/` (index, agenda, kalender, 6 file)', api: '`laksamana-api/docs/api/radar.md`', spec: '`docs/migrasi/radar.md`' },
  { key: 'stock', layar: '26', assignee: 'wandi11243-star', jalur: 'jalur:operasional', deploy: '`laksamana-office/deploy/stock/` (index dan 6 subdir)', vue: '`app/pages/stock/` (index, ordering, purchasing, 32 file)', api: '`laksamana-api/docs/api/stock.md`', spec: '`docs/migrasi/stock.md`' },
  { key: 'marketing', layar: '23', assignee: 'wandi11243-star', jalur: 'jalur:konten-marketing', deploy: '`laksamana-office/deploy/marketing/index.html` (file tunggal)', vue: '`app/pages/marketing/` (index, dashboard, crm, 22 file)', api: '`laksamana-api/docs/api/marketing.md`', spec: '`docs/migrasi/marketing.md`' },
  { key: 'jadwal', layar: '20 gabungan', assignee: 'wandi11243-star', jalur: 'jalur:sdm', deploy: '`laksamana-office/deploy/jadwal/` dan pemilih `laksamana-office/deploy/roster/`', vue: '`app/pages/jadwal/` (index, dashboard, bulanan, 9 file)', api: '`laksamana-api/docs/api/jadwal.md`', spec: '`docs/migrasi/jadwal.md`' },
  { key: 'dw', layar: '11', assignee: 'wandi11243-star', jalur: 'jalur:sdm', deploy: '`laksamana-office/deploy/dw/index.html` (file tunggal)', vue: '`app/pages/dw/` (index, kalender, bayar, 11 file)', api: '`laksamana-api/docs/api/dw.md`', spec: 'belum ada, susun daftar layar dari deploy dan halaman Vue' },
  { key: 'analytics', layar: '18', assignee: 'wandi11243-star', jalur: 'jalur:penyelesaian', deploy: '`laksamana-office/deploy/analytics/`', vue: '`app/pages/analytics/` (index, tren, ringkasan, 19 file)', api: 'belum ada (catat sebagai gap bila butuh)', spec: '`docs/migrasi/analytics.md`' },
  { key: 'event', layar: '17 staf', assignee: 'wandi11243-star', jalur: 'jalur:operasional', deploy: '`laksamana-office/deploy/event/`', vue: '`app/pages/event/` (index, dashboard, calendar, 23 file)', api: '`laksamana-api/docs/api/event.md`', spec: '`docs/migrasi/event.md`' },
  { key: 'hlife', layar: '14', assignee: 'wandi11243-star', jalur: 'jalur:sdm', deploy: '`laksamana-office/deploy/howandi_life/` (perhatikan nama folder beda)', vue: '`app/pages/hlife/` (index, home, calendar, 15 file)', api: '`laksamana-api/docs/api/hlife.md`', spec: '`docs/migrasi/hlife.md`' },
  { key: 'absensi', layar: '6', assignee: 'wandi11243-star', jalur: 'jalur:sdm', deploy: '`laksamana-office/absensi/` (standalone, bukan di deploy)', vue: '`app/pages/absensi/` (index, riwayat, wajah, 5 file)', api: '`laksamana-api/docs/api/absensi.md`', spec: '`docs/migrasi/absensi.md`' },
]

function body(m) {
  return `## Konteks

Modul ${m.key} di laksamana-office-vue adalah pengganti layar yang sama di Office lama. Issue ini bagian dari program 19 issue visual, lihat \`docs/intent/migrasi-issue-per-modul.md\`. Pilih dulu bersama owner: samakan visual plek dengan lama, atau reimagine.

## Referensi

- Deploy lama: ${m.deploy}
- Halaman Vue: ${m.vue}
- Kontrak API: ${m.api}
- Spec migrasi: ${m.spec}
- Perkiraan layar: ${m.layar}
- Template kerja: \`docs/migrasi/PROMPT-visual-modul.md\`

## Cara kerja

1. Baca bacaan wajib di template (AGENTS, DESIGN, PLAN, TIM-A, spec, kontrak API).
2. Sesi interaktif dengan owner: tanya (A) samain plek atau (B) reimagine. Jangan coding sebelum dijawab.
3. Bandingkan lama vs baru di browser 390px dan 1366px per layar, tulis checklist parity.
4. Gap API: buat dan kerjakan issue di laksamana-api (label tim-a), pasang tautan blocked-by di sini.

## Definition of Done

- Semua layar selesai di Vue atau ditandai Segera dengan alasan (ID K/G)
- Tersambung ke /api/v1 lewat useApi(), tanpa URL legacy
- npm run lint, typecheck, build hijau
- Cek browser 390 dan 1366 dicatat di PR
- Tanpa test per issue (test menyusul setelah semua merge ke main)

## Prompt siap copy

Salin blok di bawah ke sesi agentic:

\`\`\`
Kamu mengerjakan modul ${m.key} di laksamana-office-vue (Nuxt 4 + Nuxt UI, SPA), pengganti ${m.deploy}. Issue ini nomornya lihat judul di atas.
Referensi: Vue di ${m.vue}. Kontrak API: ${m.api}. Spec: ${m.spec} (perkiraan ${m.layar} layar).
Baca wajib: AGENTS.md, CONTRIBUTING.md, DESIGN.md, PLAN.md, TIM-A.md, lalu docs/migrasi/PROMPT-visual-modul.md, ikuti Langkah 0 sampai 5 di sana.
Langkah 1 dulu: tanya owner, (A) samain visual plek atau (B) reimagine. Jangan coding sebelum dijawab. Kalau reimagine, boleh web-search inspirasi dan wajib pakai skill antislop.
Cek browser 390 dan 1366 per layar. Hanya /api/v1 via useApi(). Tanpa test per issue.
Gap API: buat dan kerjakan issue di laksamana-api (label tim-a), pasang blocked-by di issue ini.
Branch migrasi/visual-${m.key}, draft PR dengan Closes (nomor issue ini), jangan merge.
\`\`\`
`
}

function sh(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

const results = []
for (const m of modules) {
  const title = `[visual] ${m.key}: samain vs reimagine (${m.layar} layar)`
  const exists = (() => {
    try {
      return sh(`gh issue list --state all --search "${title}" --json title --jq ".[].title"`)
    }
    catch { return '' }
  })()
  if (exists.split('\n').some(t => t.trim() === title)) {
    results.push({ key: m.key, status: 'skip-ada', title })
    console.log(`LEWATI (sudah ada): ${title}`)
    continue
  }
  const file = join(bodiesDir, `${m.key}.md`)
  writeFileSync(file, body(m))
  const url = sh(`gh issue create --title "${title}" --assignee "${m.assignee}" --label "tim-a" --label "${m.jalur}" --body-file "${file}"`)
  results.push({ key: m.key, status: 'buat', title, url })
  console.log(`BUAT: ${title} -> ${url}`)
}
console.log(JSON.stringify({ total: results.length, buat: results.filter(r => r.status === 'buat').length }))
