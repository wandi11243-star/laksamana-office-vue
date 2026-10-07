/*
 * tools/uji-marketing.mjs — guard for app/utils/marketing.ts + marketing-uang.ts.
 *
 *   node tools/uji-marketing.mjs      (Node 24: imports the .ts directly)
 *
 * The utils import each other through Nuxt's `~/` alias; a tiny resolve hook
 * maps `~/x` to `app/x.ts` so the files are tested exactly as shipped.
 *
 * The rules that fail SILENTLY (docs/migrasi/marketing.md D.4, F):
 *   - eventFinance: discount → service (optional) → PB1 inclusive / on top,
 *     DP nominal before %, the "DP sudah dibayar" tick never doubles;
 *   - F&B order: typed → deal table → pax × price → old biayaFB; OTS text summed;
 *   - Rincian: (jumlah || 1) × harga, FREE/TBC not billed;
 *   - normEventMkt: Negotiation moved, PIC boxes merged, the F&B line added on
 *     top of an old Rincian, boxes win when they disagree with the table;
 *   - invoice status, access matrix (order of ACTION_VIEW!), Quotation gate,
 *     kanban column, CRM import plan, CSV reader, typed-name match.
 */
import { register } from 'node:module'

register('data:text/javascript,' + encodeURIComponent(`
  import { pathToFileURL } from 'node:url'
  import path from 'node:path'
  export async function resolve(spec, ctx, next) {
    if (spec.startsWith('~/')) return next(pathToFileURL(path.resolve('app', spec.slice(2) + '.ts')).href, ctx)
    return next(spec, ctx)
  }
`))

const M = await import('../app/utils/marketing.ts')
const U = await import('../app/utils/marketing-uang.ts')

let ok = 0
let gagal = 0
const cek = (nama, syarat, ket) => {
  if (syarat) {
    ok++
    console.log('  OK    ' + nama)
  }
  else {
    gagal++
    console.log('  GAGAL ' + nama + (ket ? '  — ' + ket : ''))
  }
}
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ST = { ...M.SETTING_MKT_BAWAAN }
const ev = (detail = {}, lain = {}) => ({ id: 'e1', clientId: 'c1', nama: 'Uji', status: 'Deal', tanggal: '2026-10-20', detail, payments: [], ...lain })

console.log('\nmarketing: uang event')
let f = U.eventFinance(ev({ rincianItem: [{ desc: 'Paket', jumlah: 100, harga: 150000, jenis: 'bayar' }] }), ST)
cek('subtotal dari Rincian', f.sub === 15_000_000)
cek('service 5% lalu PB1 10% di atasnya', f.service === 750_000 && f.tax === 1_575_000 && f.grand === 17_325_000, JSON.stringify(f))
cek('DP tanpa nominal = 50% grand, labelnya "DP 50%"', f.dp === 8_662_500 && U.dpLabel(f) === 'DP 50%')
f = U.eventFinance(ev({ rincianItem: [{ desc: 'Paket', harga: 1_100_000 }], taxInclude: true, svcApply: false }), ST)
cek('baris tanpa Qty = satu; pajak termasuk dihitung mundur', f.sub === 1_100_000 && f.service === 0 && f.grand === 1_100_000 && f.tax === 100_000, JSON.stringify(f))
f = U.eventFinance(ev({ rincianItem: [{ desc: 'A', jumlah: 1, harga: 1000000 }, { desc: 'Free', jenis: 'free', harga: 999 }, { desc: 'TBC', jenis: 'tbc', harga: 999 }], diskon: 2_000_000 }), ST)
cek('FREE/TBC tidak ditagih; diskon tidak bikin minus', f.sub === 1_000_000 && f.afterDisc === 0 && f.grand === 0)
f = U.eventFinance(ev({ rincianItem: [{ desc: 'A', harga: 10_000_000 }], svcApply: false, depositNominal: 3_000_000, dpPaid: true }, { payments: [{ amount: 1_000_000 }] }), { ...ST, pb1: 0 })
cek('DP nominal; centang DP hanya menambah selisih yang belum tercatat', f.dp === 3_000_000 && f.dpDiakui === 2_000_000 && f.paid === 3_000_000 && f.remaining === 7_000_000 && U.dpLabel(f) === 'DP')
f = U.eventFinance(ev({ rincianItem: [{ desc: 'A', harga: 10_000_000 }], svcApply: false, depositNominal: 1_000_000, dpPaid: true }, { payments: [{ amount: 5_000_000 }] }), { ...ST, pb1: 0 })
cek('pembayaran melampaui DP: centang tidak dobel, dpTertutupBayar', f.paid === 5_000_000 && f.dpDiakui === 0 && f.dpTertutupBayar)
cek('pax OTS teks dijumlah ("150 + 2 OTS" = 152)', U.paxDariTeks('150 + 2 OTS') === 152 && U.paxDariTeks('±150') === 150 && U.paxDariTeks('') === 0)
cek('F&B: estimasiOTS × dealPax lebih dulu', U.eventFbCost(ev({ estimasiOTS: '10+2', pax: 50, dealPax: 100, budgetPax: 80 })) === 1200)
cek('F&B: fbManual 0 yang diketik dihormati', U.eventFbCost(ev({ fbManual: 0, pax: 10, budgetPax: 100 })) === 0)
cek('F&B: tabel deal bila dinyalakan', U.eventFbCost(ev({ fbDealOn: true, fbDeal: [{ jumlah: 2, harga: 50 }, { jumlah: 1, harga: 10 }] })) === 110)
cek('F&B: biayaFB lama bila tanpa harga/pax', U.eventFbCost(ev({ biayaFB: 777 })) === 777)
cek('subtotal jaring pengaman: kotak lama bila Rincian kosong', U.eventSubtotal(ev({ pax: 10, budgetPax: 100, sewaVenue: 500, biayaTeknis: 20, biayaLain: 3 })) === 1523)

console.log('\nmarketing: status invoice')
const hari = '2026-10-15'
cek('grand 0 → Draft', U.invStatus(ev({}), ST, hari) === 'Draft')
const tagih = { rincianItem: [{ desc: 'A', harga: 1000 }] }
cek('lunas → Paid', U.invStatus(ev(tagih, { payments: [{ amount: 99999 }] }), ST, hari) === 'Paid')
cek('dibayar sebagian → Pending', U.invStatus(ev(tagih, { payments: [{ amount: 1 }] }), ST, hari) === 'Pending')
cek('belum bayar & < H-7 Deal → Overdue', U.invStatus(ev(tagih), ST, hari) === 'Overdue')
cek('belum bayar jauh hari → Sent/Draft', U.invStatus(ev(tagih, { tanggal: '2026-12-01', invoiceSent: true }), ST, hari) === 'Sent' && U.invStatus(ev(tagih, { tanggal: '2026-12-01' }), ST, hari) === 'Draft')

console.log('\nmarketing: normalisasi event (normalizeState)')
let n = U.normEventMkt(ev({}, { status: 'Negotiation', pipeCol: 'Negotiation' }), ST)
cek('Negotiation → Quotation Terkirim', n.status === 'Quotation Terkirim' && n.pipeCol === 'Quotation Terkirim')
n = U.normEventMkt(ev({ bPIC: 'Ani', kPIC: 'Budi', picTamu: 'Cici' }), ST)
cek('kotak PIC pensiun dilebur, dua nama beda dipertahankan', n.detail.kPIC === 'Budi / Ani' && n.detail.fPIC === 'Cici')
n = U.normEventMkt(ev({ rincianOn: true, rincianItem: [{ desc: 'Sewa', harga: 1000 }], pax: 10, budgetPax: 100 }, { pax: 10 }), ST)
cek('Rincian lama tanpa baris konsumsi → "Biaya Konsumsi Event" disisipkan di atas', n.detail.rincianItem[0].desc === 'Biaya Konsumsi Event (10 pax)' && U.eventSubtotal(n) === 2000, JSON.stringify(n.detail.rincianItem))
n = U.normEventMkt(ev({ pax: 10, budgetPax: 100, sewaVenue: 500 }), ST)
cek('kotak lama diseed ke Rincian tanpa mengubah subtotal', U.eventSubtotal(n) === 1500 && n.detail.rincianOn === true)
n = U.normEventMkt(ev({ rincianOn: false, rincianItem: [{ desc: 'X', harga: 99 }], sewaVenue: 500 }), ST)
cek('tabel & kotak berselisih → kotak menang, tabel disimpan di Draft', U.eventSubtotal(n) === 500 && n.detail.rincianItemDraft?.[0]?.desc === 'X')
const asli = ev({ bPIC: 'Ani' })
U.normEventMkt(asli, ST)
cek('normEventMkt tidak mengubah objek asli', asli.detail.kPIC === undefined)

console.log('\nmarketing: matriks hak akses')
cek('bawaan: marketing boleh ubah crm (edit_client SEBELUM del_client)', M.permBawaanMkt('marketing', 'crm') === 2)
cek('bawaan: hapus event/kelola user tertutup untuk semua', !M.bolehAksiMkt('del_event', { id: 'm', role: 'manager' }, {}) && !M.bolehAksiMkt('manage_users', { id: 'm', role: 'marketing' }, {}))
cek('bawaan: finance lihat crm, tidak lihat pipeline tapi bisa buka lewat events', M.permBawaanMkt('finance', 'crm') === 1 && M.permBawaanMkt('finance', 'pipeline') === 0 && M.bolehBukaMkt('pipeline', { id: 'f', role: 'finance' }, {}))
cek('super_admin selalu penuh, override apa pun', M.bolehAksiMkt('del_client', { id: 's', role: 'super_admin', acc: { crm: 0 } }, {}))
cek('override per orang (acc) mengalahkan role', !M.bolehBukaMkt('crm', { id: 'x', role: 'marketing', acc: { crm: 0 } }, {}))
const ra = M.normRoleAccMkt(undefined, { marketing: ['dashboard'] }, { marketing: ['edit_client'] })
cek('roleNav/rolePerms lama → roleAcc', ra.marketing.dashboard === 1 && ra.marketing.crm === 2 && ra.marketing.pipeline === 0)
const ra2 = M.normRoleAccMkt({ manager: { dashboard: 1 } })
cek('baris matriks lama dilengkapi bawaan untuk layar baru', ra2.manager.dashboard === 1 && ra2.manager.approvals === 2 && ra2.manager.vip === 2)
cek('role kosong = "Belum ada akses", tanpa layar', M.namaRoleMkt('') === 'Belum ada akses' && !M.punyaLayarMkt({ id: 'z', role: '' }, {}))
cek('tim marketing dari kata utuh jabatan', M.timMarketing({ id: 'a', name: 'A', jabatan: 'Sales & Partnership' }) && !M.timMarketing({ id: 'b', name: 'B', jabatan: 'Kitchen' }))

console.log('\nmarketing: pipeline')
cek('Confirmed tampil di kolom Deal; Event Done tanpa kolom', M.kolomPipeMkt({ status: 'Confirmed' }) === 'Deal' && M.kolomPipeMkt({ status: 'Event Done', pipeCol: 'Deal' }) === 'Event Done')
cek('ke Quotation Terkirim butuh penawaran Disetujui', M.pindahBolehMkt({ status: 'Prospect' }, 'Quotation Terkirim') !== '' && M.pindahBolehMkt({ penawaran: { status: 'Disetujui' } }, 'Quotation Terkirim') === '' && M.pindahBolehMkt({}, 'Deal') === '')
cek('penawaran Menunggu/Ditolak tetap ditahan, dengan alasannya', M.pindahBolehMkt({ penawaran: { status: 'Menunggu Approval' } }, 'Quotation Terkirim').includes('menunggu keputusan') && M.pindahBolehMkt({ penawaran: { status: 'Ditolak' } }, 'Quotation Terkirim').includes('ditolak'))
const tg = M.tugasDealMkt({ detail: { fbFormat: 'Prasmanan' }, tasks: { Prasmanan: { status: 'Done' } } }, ['Prasmanan'])
cek('Deal: task kategori dibuat tanpa menimpa yang ada', tg.Prasmanan.status === 'Done' && sama(M.tugasDealMkt({ detail: { fbFormat: 'Set Menu' } }, ['Prasmanan']), {}))
cek('pengingat data dasar hanya Quotation/Deal, tidak menahan', M.ingatTahapMkt({ detail: {} }, 'Prospect') === '' && M.ingatTahapMkt({ detail: {} }, 'Deal').startsWith('Belum terisi: Nama Event'))
cek('Tanggal Selesai wajib hanya bila multi hari', !M.kurangDasarMkt({ detail: { multiHari: false } }).includes('Tanggal Selesai') && M.kurangDasarMkt({ detail: { multiHari: { v: true } } }).includes('Tanggal Selesai'))
cek('periode minggu Senin–Minggu', sama(M.rentangPeriodeMkt('minggu', '2026-10-08', ''), { a: '2026-10-05', b: '2026-10-11' }))
cek('periode pilih bulan', sama(M.rentangPeriodeMkt('pilih', '2026-10-08', '2026-02'), { a: '2026-02-01', b: '2026-02-28' }))
cek('event lintas hari tampil di semua harinya', M.eventPadaTgl({ tanggal: '2026-10-01', tanggalSelesai: '2026-10-03' }, '2026-10-02') && !M.eventPadaTgl({ tanggal: '2026-10-01', tanggalSelesai: '2026-09-01' }, '2026-10-02'))
cek('FU berikut = hari + fuNextDays', M.tglFuBerikut('2026-10-30', 3) === '2026-11-02')

console.log('\nmarketing: dashboard')
const evs = [ev(tagih, { mktPIC: 'u1', tanggal: '2026-10-02' }), ev(tagih, { id: 'e2', mktPIC: 'u2', tanggal: '2026-10-03' }), ev(tagih, { id: 'e3', mktPIC: 'u2', tanggal: '2026-10-04' }), ev(tagih, { id: 'e4', status: 'Lead', tanggal: '2026-10-05' }), ev(tagih, { id: 'e5', tanggal: '2025-10-05' })]
const pb = U.pendapatanPerBulan(evs, ST, '2026-10-08', 6)
cek('6 bulan, bulan ini terakhir, tahun lalu tidak ikut', pb.length === 6 && pb[5].kunci === '2026-10' && pb[5].kini && pb[5].nilai === 3 * 1155)
cek('papan closing urut nilai, tanpa Lead', sama(U.papanClosing(evs, ST, '2026-10').map(x => x.id), ['u2', 'u1']))

console.log('\nmarketing: CRM & impor')
cek('nama ketik: spasi/nbsp & huruf besar diabaikan', M.namaCocok('  budi  SANTOSO ', 'Budi Santoso') && !M.namaCocok('Budi', 'Budi S'))
cek('No. HP 62… = 0…', M.hpKunci('+62 812-3456') === '08123456')
const csv = M.bacaCsvMkt('﻿sep=;\r\nNama;Catatan\r\n"Ani";"a;b ""c"""\r\n\r\n')
cek('CSV: sep=, kutip, titik koma di dalam sel, baris kosong dibuang', sama(csv, [['Nama', 'Catatan'], ['Ani', 'a;b "c"']]))
cek('CSV: pemisah ditebak dari kepala', sama(M.bacaCsvMkt('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]))
const clients = [{ id: 'c1', nama: 'Ani', hp: '0811', mktPIC: 'u1' }, { id: 'c2', nama: 'Budi', hp: '0822' }]
const users = [{ id: 'u1', name: 'Wati' }]
const r = M.rencanaImporClient([['Nama', 'No. HP', 'Marketing PIC', 'Catatan'], ['Ani Baru', '62811', '', 'x'], ['Budi', '', 'Tak Ada', ''], ['', '1', '', ''], ['Cici', '0833', 'wati', '']], clients, users, 'me')
cek('impor: cocok via HP, PIC kosong = PIC lama', r.ubah[0]?.c.id === 'c1' && r.ubah[0].nilai.mktPIC === 'u1' && r.ubah[0].beda.includes('nama'))
const budi = r.ubah.find(x => x.c.id === 'c2')
cek('impor: cocok via nama; PIC tak dikenal dilaporkan & dipertahankan; kolom ADA tapi kosong = dikosongkan', r.ingat.length === 1 && sama(budi?.beda, ['hp']) && budi.nilai.hp === '')
cek('impor: nama kosong dilewati, baru dapat PIC by nama', r.lewat[0]?.n === 4 && r.baru[0]?.c.mktPIC === 'u1' && r.baru[0].c.status === 'Lead')
cek('impor: tanpa kolom Nama ditolak', 'judul' in M.rencanaImporClient([['X'], ['1']], [], [], 'me'))
const evC = [{ clientId: 'c1', status: 'Event Done' }, { clientId: 'c1', status: 'Event Done' }, { clientId: 'c2', status: 'Prospect' }]
cek('saring relasi repeat/open/nodeal', sama(M.saringClientMkt(clients, evC, { q: '', rel: 'repeat', source: '' }).map(c => c.id), ['c1'])
&& sama(M.saringClientMkt(clients, evC, { q: '', rel: 'open', source: '' }).map(c => c.id), ['c2'])
&& sama(M.saringClientMkt(clients, evC, { q: '', rel: 'nodeal', source: '' }).map(c => c.id), ['c2']))
cek('urut: kosong selalu di bawah, angka sebagai angka', sama(M.urutMkt([{ v: 10 }, { v: '' }, { v: 9 }], [{ k: 'v', t: 'V', v: x => x.v }], { k: 'v', arah: -1 }).map(x => x.v), [10, 9, '']))

console.log(`\n${ok} OK, ${gagal} GAGAL\n`)
process.exit(gagal ? 1 : 0)
