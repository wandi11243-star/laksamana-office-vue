/* Guard untuk app/utils/marketing-event.ts (issue #59: detail event, finance,
 * penawaran, brief, hapus, kunci meja).
 * node tools/uji-marketing-event.mjs (Node 24: impor .ts langsung)
 * hook resolve: ~/x -> app/x.ts, file diuji apa adanya.
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
const E = await import('../app/utils/marketing-event.ts')

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

console.log('\nmarketing-event: skema & visibilitas')
cek('11 seksi D.1–D.11', E.SEKSI_EVENT_MKT.length === 11 && E.SEKSI_EVENT_MKT[0].id === 'basic' && E.SEKSI_EVENT_MKT[10].id === 'pic')
cek('4 tab, Overview selalu ada', E.TAB_EVENT_MKT.length === 4 && E.TAB_EVENT_MKT[3].always === true)
cek('operasional tak melihat seksi fin', E.terlihatSeksiMkt('Kitchen', 'operational').every(s => !s.fin))
cek('operasional tak melihat tab Finance', E.tabTerlihatMkt('Kitchen', 'operational').every(t => t.id !== 'finance'))
cek('divisi dapur hanya melihat D.1, D.2, D.10, D.11', sama(E.terlihatSeksiMkt('Kitchen', 'marketing').map(s => s.id), ['basic', 'kitchen', 'attach', 'pic']))
cek('tanpa divisi tercatat semua tampil', E.terlihatSeksiMkt(undefined, 'marketing').length === 11)
cek('nilai dibaca dari baris dulu lalu detail', E.nilaiFieldMkt(ev({ pax: 5 }, { pax: 9 }), 'pax') === 9 && E.nilaiFieldMkt(ev({ pax: 5 }), 'pax') === 5)
cek('cond array: Lainnya memicu isian tulis-sendiri', E.condTerpenuhiMkt({ k: 'x', l: 'y', t: 'text', cond: { k: 'jenis', v: 'Lainnya' } }, ev({ jenis: 'Lainnya' })) === true)
cek('yn {v} kosong = belum dijawab', E.kosongNilaiMkt('yn', {}) === true && E.kosongNilaiMkt('yn', { v: true }) === false)
cek('wajib yang tersembunyi cond tidak ditagih', sama(E.kurangWajibMkt(ev({}), E.SEKSI_EVENT_MKT).filter(x => x.includes('Tanggal Selesai')), []))

console.log('\nmarketing-event: DP & pembayaran')
const edp = ev({ sistemBayar: 'DP', depositNominal: 2_000_000, dpRek: 'Cash', dpTgl: '2026-10-01', dpBuktiUrl: 'k', dpBuktiNama: 'b.jpg' })
cek('finPakaiDp: sistem DP atau nominal', E.finPakaiDpMkt(edp) === true && E.finPakaiDpMkt(ev({})) === false)
cek('dpFormKurang menyebut yang belum ada', sama(E.dpFormKurangMkt(ev({ depositNominal: 5 })), ['rekening tujuan', 'tanggal transfer', 'bukti transfer']))
cek('centang lengkap melahirkan baris DP', (() => {
  const r = E.sinkronDpMkt(edp, true, 'KW/0007', 'Wandi')
  return r.lahir && r.payments.length === 1 && r.payments[0].no === 'KW/0007' && r.payments[0].dariDpForm === true
})())
cek('Simpan kedua tidak menumpuk, hanya memperbarui', (() => {
  const r1 = E.sinkronDpMkt(edp, true, 'KW/0007', 'Wandi')
  const e2 = { ...edp, payments: r1.payments, detail: { ...edp.detail, depositNominal: 3_000_000 } }
  const r2 = E.sinkronDpMkt(e2, true, 'KW/0008', 'Wandi')
  return !r2.lahir && r2.perbarui && r2.payments.length === 1 && r2.payments[0].amount === 3_000_000
})())
cek('centang mati / kurang = tidak menyentuh', E.sinkronDpMkt(edp, false, 'KW/1', 'W').payments.length === 0 && E.sinkronDpMkt(ev({}), true, 'KW/1', 'W').lahir === false)
cek('bawaan bayar: kekurangan DP dulu', (() => {
  const uang = { grand: 10_000, dp: 5_000, paid: 2_000, remaining: 8_000 }
  const b1 = E.bawaanBayarMkt(uang, true)
  const b2 = E.bawaanBayarMkt({ ...uang, paid: 5_000, remaining: 5_000 }, true)
  return b1.amount === 3_000 && b1.type === 'DP' && b2.amount === 5_000 && b2.type === 'Pelunasan'
})())
cek('sisa live dari ketikan', E.sisaSesudahMkt({ grand: 10_000, paid: 2_000 }, 0, 3_000) === 5_000 && E.sisaSesudahMkt({ grand: 10_000, paid: 2_000 }, 2_000, 8_000) === 2_000)
cek('nomor kwitansi prefix + seq 4 digit', E.noKwitansiMkt(ST) === 'KW/LM/2026/0001' && E.noKwitansiMkt({}) === 'KW/0001' && E.seqBerikutMkt(ST) === 2)
cek('bukti wajib untuk baris baru, lama ditanya sekali', E.bayarBaruSahMkt(false, false, true) === 'wajib' && E.bayarBaruSahMkt(false, false, false) === 'tanya' && E.bayarBaruSahMkt(false, true, true) === 'ok')

console.log('\nmarketing-event: penawaran, hapus, kunci meja, rundown')
cek('nomor surat NNN/PNW/LM/Romawi/Tahun', E.noSuratBaruMkt(0, new Date(2026, 9, 8)) === '001/PNW/LM/X/2026' && E.noSuratBaruMkt(12, new Date(2026, 0, 1)) === '013/PNW/LM/I/2026')
cek('ringkasan hapus: kwitansi + total + FU', (() => {
  const r = E.ringkasHapusMkt(ev({}, { payments: [{ no: 'KW/1', amount: 100 }, { no: 'KW/2', amount: 50 }] }), 3)
  return r.terbayar === 150 && r.nBayar === 2 && r.nFu === 3 && sama(r.kwitansi, ['KW/1', 'KW/2'])
})())
cek('kunci di tanggal lama diperingatkan', E.kunciTanggalSalahMkt(ev({ mejaKunci: ['M1'], mejaKunciTgl: '2026-10-01' })) !== null && E.kunciTanggalSalahMkt(ev({ mejaKunciTgl: '2026-10-20' })) === null)
cek('rundown: durasi → selesai', E.selesaiRundownMkt('09:00', '30 menit') === '09:30' && E.selesaiRundownMkt('23:50', '20') === '00:10')
cek('mirror meja: "M12, M13 (2 meja)"', E.ringkasNilaiMkt('text', ['M12', 'M13']) === 'M12, M13' && E.ringkasNilaiMkt('ynnote', { v: true, note: 'bawa sendiri' }) === 'Ya — bawa sendiri')
cek('WA invoice memuat total & sisa', E.pesanInvoiceWaMkt(ev({ rincianItem: [{ desc: 'Paket', harga: 1000 }] }), 'PT X', ST).includes('GRAND TOTAL'))

console.log('\nmarketing-event: brief')
const dok = E.buildBriefDocMkt(ev({ highlight: 'Rahasia', sistemBayar: 'DP', picAcara: 'Andi' }, { pax: 10 }), 'PT X', ST, 'internal')
cek('internal memuat highlight + keuangan', dok.includes('Rahasia') && dok.includes('Keuangan (internal)'))
const dokC = E.buildBriefDocMkt(ev({ highlight: 'Rahasia', internalNote: 'Jangan cetak' }), 'PT X', ST, 'client')
cek('client menyembunyikan internalNote & highlight', !dokC.includes('Rahasia') && !dokC.includes('Jangan cetak') && dokC.includes('Ketentuan Pembayaran'))
const dokQ = E.buildBriefDocMkt(ev({ rincianItem: [{ desc: 'Paket', harga: 1000 }] }), 'PT X', ST, 'quote')
cek('quote = tabel penawaran + TTD', dokQ.includes('Penawaran') && dokQ.includes('Menyetujui'))

console.log(`\n${ok} OK, ${gagal} GAGAL`)
if (gagal) process.exit(1)
