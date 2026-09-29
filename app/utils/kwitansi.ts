// Kwitansi DP — the money paper the guest holds.
//
// Pure logic + the shared print sheet, owned by reservasi (PLAN.md §4) and
// later used by marketing for VIP the same way. Transport (request / status /
// file) lives in `app/composables/useFinance.ts`; the caller owns the window
// and the audit line.
//
// Source: laksamana-office/deploy/reservasi/index.html:6980-7400,
//         laksamana-office/deploy/assets/kwitansi-sheet.js (the whole file).

import type { Reservasi } from '~/composables/useReservasi'
import type { BerkasKwitansi } from '~/composables/useFinance'
import { dpHitungTerverifikasi, dpJumlahTerverifikasi, dpTotal, dpsOf } from './dp-reservasi'
import { hariIni } from './format'

/** The venue's own receipt number, used until Finance issues the official one (`:6980`). */
export const kwitansiNo = (r: Reservasi): string =>
  `KW/${String(r.date || hariIni()).replace(/-/g, '')}/${String(r.id || '').slice(-4).toUpperCase()}`

/** Is there any DP money at all (`:6983`). */
export const adaDp = (r?: Reservasi | null): boolean =>
  !!r && r.dpStatus === 'Sudah' && Number(r.dpAmount) > 0

/**
 * LUNAS is full payment, not a down payment — a separate marker, not a third
 * DP status, so every DP computation keeps running as it is (`:6984-6988`).
 */
export const isLunas = (r?: Reservasi | null): boolean => !!(r && r.lunas)

/** Instalments that are not verified (`:7136`). */
export const dpBelumVerif = (r?: Reservasi | null) => dpsOf(r).filter(x => x && x.tfStatus !== 'verified')

/**
 * The receipt is HELD until every transfer is verified — the sheet states the
 * WHOLE dpTotal, so one unchecked transfer means paper acknowledging money
 * that may not be in the account. `rejected` holds too: refused money was
 * checked and found absent (`:7102-7135`, F10).
 */
export function kwiTertahan(r?: Reservasi | null): { n: number, nominal: number, ditolak: number } | null {
  const belum = dpBelumVerif(r)
  if (!belum.length) return null
  return {
    n: belum.length,
    nominal: belum.reduce((a, x) => a + (Number(x.amount) || 0), 0),
    ditolak: belum.filter(x => x.tfStatus === 'rejected').length,
  }
}

/**
 * One sentence, used by the banner AND the confirm box — two separately
 * worded sentences drift, and what drifts here is why the button cannot be
 * pressed (`:7145-7149`).
 */
export function kwiTertahanTeks(t: { n: number, nominal: number, ditolak: number }): string {
  return `${t.n} transfer belum terverifikasi${t.ditolak ? ` (${t.ditolak} ditolak)` : ''} — ${rupiahKwitansi(t.nominal)}`
}

/** "Rp. 1.000.000" — the sheet's own spelling, kept identical before and after the move. */
export function rupiahKwitansi(n: number): string {
  return `Rp. ${(Number(n) || 0).toLocaleString('id-ID')}`
}

/** "Sen, 27 Sep 2026" — the old fmtDate (`:3301`), used on the sheet. */
export function tglKwitansi(tgl: string): string {
  if (!tgl) return '-'
  const d = new Date(`${tgl}T00:00:00`)
  if (Number.isNaN(+d)) return tgl
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

/** "27 Sep 2026" — the old fmtDateShort (`:3302`). */
export function tglPendekKwitansi(tgl: string): string {
  if (!tgl) return '-'
  const d = new Date(`${tgl}T00:00:00`)
  if (Number.isNaN(+d)) return tgl
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** What travels with the request: enough for Finance to decide without opening Reservasi — not the whole row (`:7070-7094`). */
export function invRingkas(r: Reservasi) {
  const daftar = dpsOf(r)
  return {
    nama: r.name || '',
    tanggal: r.date || '',
    jam: r.time || '',
    pax: Number(r.pax) || 0,
    meja: r.table || '',
    lunas: isLunas(r),
    noKwitansi: kwitansiNo(r),
    dpTotal: dpTotal(r),
    dpVerified: dpJumlahTerverifikasi(r),
    dpCount: daftar.length,
    dpVerifiedCount: dpHitungTerverifikasi(r),
    diinputOleh: r.createdBy || '',
    dp: daftar.map(p => ({
      nominal: Number(p.tfAmount) || Number(p.amount) || 0,
      metode: p.method || '',
      bank: p.tfBank || '',
      pengirim: p.tfName || '',
      tanggal: p.tfDate || '',
      jam: p.tfTime || '',
      status: p.tfStatus || '',
      tanpaData: p.tfTanpaData || '',
      adaBukti: !!p.proofData,
    })),
  }
}

/** Flat data the shared sheet understands — never a reservation record (`:7290-7308`). */
export interface DataKwitansi {
  no: string
  resmi: boolean
  lunas: boolean
  nama: string
  hp: string
  metode: string
  tanggalTerbit: string
  keterangan: string
  subKeterangan: string
  pax: string | number
  total: number
  penanda: { nama: string, jabatan: string, ttd: string }[] | null
  cap: string
  logo: string
  sumber?: string
}

export function kwitansiData(r: Reservasi, inv: BerkasKwitansi | null, logo = ''): DataKwitansi {
  const resmi = !!(inv && inv.no)
  return {
    no: resmi && inv ? inv.no : kwitansiNo(r),
    resmi,
    lunas: isLunas(r),
    nama: r.name || '',
    hp: r.phone ? tampilHpKwitansi(r.phone) : '',
    metode: r.dpMethod || '',
    tanggalTerbit: tglKwitansi(hariIni()),
    keterangan: `Reservasi ${r.category || 'Tamu Umum'}`,
    subKeterangan: `${tglKwitansi(r.date)} · ${r.time || '-'} WIB${r.table ? ` · Meja ${r.table}` : ''}`,
    pax: r.pax || '',
    total: dpTotal(r),
    penanda: resmi && inv && Array.isArray(inv.penanda) && inv.penanda.length ? inv.penanda : null,
    cap: resmi && inv ? (inv.cap || '') : '',
    logo,
  }
}

function tampilHpKwitansi(p: string): string {
  const x = String(p ?? '').replace(/\D/g, '')
  if (!x) return ''
  return x.startsWith('62') ? `0${x.slice(2)}` : x
}

/* ------------------------------------------------------------------ the sheet
   Port of deploy/assets/kwitansi-sheet.js html(). One file used by two modules
   so the account number, address and signatures never drift between two
   copies. The print styles keep their own colours: this is a paper document,
   and the sheet printed before and after the move must be indistinguishable.
   Source: laksamana-office/deploy/assets/kwitansi-sheet.js:69-193. */

const KOP_BAWAAN = {
  pt: 'PT. LAKSAMANA MUDA BERSATU',
  alamat: 'Jl. Soekarno - Hatta No. 39, Labuh Baru Tim, Kec. Payung Sekaki,<br>Kota Pekanbaru, Riau 28282',
  bank: 'UOB | PT. Laksamana Muda Bersatu',
  rek: '319-303-3588',
  ttdNama: '(Wandi Pranata)',
  ttdJabatan: 'Finance',
}

function escLembar(s: unknown): string {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!))
}

export function kwitansiHtml(d: DataKwitansi): string {
  const kop = { ...KOP_BAWAAN }
  const lunas = !!d.lunas
  const resmi = !!d.resmi
  const total = Number(d.total) || 0
  // Without an official signatory, one block with the default name — never an
  // empty block, so the sheet's bottom does not jump between versions.
  const pen = (Array.isArray(d.penanda) && d.penanda.length)
    ? d.penanda
    : [{ nama: kop.ttdNama, jabatan: kop.ttdJabatan, ttd: '' }]

  const baris = (a: string, b: string) =>
    `<tr><td class="k">${escLembar(a)}</td><td class="v">${b}</td></tr>`

  return '<!doctype html><html><head><meta charset="utf-8"><title>Kwitansi '
    + escLembar(d.no || '') + ' — ' + escLembar(d.nama || '') + '</title>\n'
    + `<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font:13px/1.55 "Segoe UI",Arial,sans-serif;color:#1d1a15;background:#fff;padding:28px 30px}
  .kop{display:flex;align-items:flex-start;gap:18px;border-bottom:3px solid #C9A227;padding-bottom:14px}
  .kop img{width:74px;height:74px;object-fit:contain;flex:none}
  .kop .pt{font-size:17px;font-weight:800;letter-spacing:.2px}
  .kop .al{font-size:11.5px;color:#5c574d;margin-top:4px}
  .judul{margin-left:auto;text-align:right;flex:none}
  .judul b{font-size:22px;letter-spacing:2px;display:block}
  .judul span{font-size:11px;color:#5c574d;letter-spacing:1px}
  .meta{display:flex;justify-content:space-between;gap:24px;margin:18px 0 16px}
  .meta table{border-collapse:collapse}
  .meta td{padding:2px 0;font-size:12.5px;vertical-align:top}
  .meta td.k{color:#5c574d;padding-right:10px;white-space:nowrap}
  .meta td.v{font-weight:600}
  .lunas{display:inline-block;border:2px solid ${lunas ? '#1F9D5F' : '#C9A227'};color:${lunas ? '#1F9D5F' : '#8a6a12'};
    font-weight:800;font-size:12px;letter-spacing:1.5px;padding:5px 12px;border-radius:6px;transform:rotate(-3deg)}
  table.isi{width:100%;border-collapse:collapse;margin-top:6px}
  table.isi th{background:#F4EEE0;border:1px solid #D9CDB2;padding:8px;font-size:11.5px;letter-spacing:.4px;text-transform:uppercase}
  table.isi td{border:1px solid #D9CDB2;padding:9px 8px;font-size:12.5px}
  .num{text-align:right;white-space:nowrap}
  .tot td{background:#FAF6EC;font-weight:800;font-size:13.5px}
  .bawah{display:flex;justify-content:space-between;gap:30px;margin-top:24px}
  .bayar{border:1px solid #D9CDB2;border-radius:8px;padding:11px 13px;font-size:12px;max-width:290px}
  .bayar b{display:block;margin-bottom:3px}
  .ttd{text-align:center;font-size:12.5px;min-width:190px}
  .ttd-grup{text-align:right;font-size:12.5px}
  .ttd-baris{display:flex;gap:20px;justify-content:flex-end;align-items:flex-end}
  .ttd-baris .ttd{min-width:150px}
  .ttd .sp{height:58px}
  .ttd .nm{border-top:1px solid #1d1a15;padding-top:5px;font-weight:700;display:inline-block;min-width:170px}
  .catatan{margin-top:20px;font-size:11px;color:#5c574d;border-top:1px dashed #D9CDB2;padding-top:9px}
  @page{size:A4;margin:12mm}
  @media print{body{padding:0}.noprint{display:none}}
  .noprint{margin-top:22px;text-align:center}
  .noprint button{font:600 13px/1 "Segoe UI",Arial;padding:10px 18px;border-radius:8px;border:0;background:#C9A227;color:#2a2620;cursor:pointer}
</style></head><body>
  <div class="kop">
    <img src="${escLembar(d.logo || '')}" alt="">
    <div><div class="pt">${escLembar(kop.pt)}</div><div class="al">${kop.alamat}</div></div>
    <div class="judul"><b>KWITANSI</b><span>${lunas ? 'PELUNASAN' : 'PEMBAYARAN DP'}</span></div>
  </div>
  <div class="meta">
    <table>
      ${baris('Diterima dari', `<b>${escLembar(String(d.nama || '-').toUpperCase())}</b>`)}
      ${d.hp ? baris('No. HP', escLembar(d.hp)) : ''}
      ${baris('Untuk', lunas ? 'Pelunasan Reservasi' : 'Down Payment (DP) Reservasi')}
    </table>
    <table>
      ${baris(resmi ? 'No. Invoice' : 'No. Kwitansi', `<b>${escLembar(d.no || '-')}</b>`)}
      ${baris('Tanggal Terbit', escLembar(d.tanggalTerbit || '-'))}
      ${baris('Metode Bayar', escLembar(d.metode || '-'))}
    </table>
  </div>
  <table class="isi">
    <thead><tr><th style="width:38px">No</th><th style="text-align:left">Keterangan</th><th style="width:60px">Pax</th><th style="width:130px">Jumlah</th></tr></thead>
    <tbody>
      <tr><td class="num">1</td>
        <td>${escLembar(d.keterangan || 'Reservasi')}<br>
          <span style="color:#5c574d;font-size:11.5px">${escLembar(d.subKeterangan || '')}</span></td>
        <td class="num">${escLembar(String(d.pax || '-'))}</td>
        <td class="num">${escLembar(rupiahKwitansi(total))}</td></tr>
      <tr class="tot"><td colspan="3" class="num">TOTAL DITERIMA</td><td class="num">${escLembar(rupiahKwitansi(total))}</td></tr>
    </tbody>
  </table>
  <div class="bawah">
    <div>
      <div class="bayar"><b>Pembayaran dapat ditransfer ke:</b>${escLembar(kop.bank)}<br><b style="margin-top:3px">${escLembar(kop.rek)}</b></div>
      <div style="margin-top:12px"><span class="lunas">${lunas ? 'LUNAS' : 'DP DITERIMA'}</span></div>
    </div>
    <div class="ttd-grup">Hormat Kami,
      <div class="ttd-baris">
        ${pen.map((p, i) => `<div class="ttd">`
          + `<div class="sp" style="position:relative">`
          + ((d.cap && i === 0) ? `<img src="${escLembar(d.cap)}" alt="" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-38%) rotate(-8deg);height:96px;opacity:.85">` : '')
          + (p.ttd ? `<img src="${escLembar(p.ttd)}" alt="" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-46%);height:64px">` : '')
          + '</div>'
          + `<div class="nm">${escLembar(p.nama || '')}</div>`
          + `<div style="color:#5c574d;font-size:11.5px">${escLembar(p.jabatan || '')}</div>`
          + '</div>').join('')}
      </div>
    </div>
  </div>
  <div class="catatan">${lunas
    ? 'Pembayaran reservasi ini telah <b>LUNAS</b>. Mohon simpan kwitansi ini sebagai bukti pembayaran.'
    : 'DP ini akan <b>memotong total tagihan</b> saat tamu datang. Mohon simpan kwitansi ini sebagai bukti pembayaran.'}
    <br>Dokumen ini dicetak dari sistem Laksamana Muda dan sah tanpa tanda tangan basah.</div>
  <div class="noprint"><button onclick="window.print()">Simpan sebagai PDF / Cetak</button></div>
</body></html>`
}

/**
 * Write the sheet into an already-open window, then print. The window is
 * opened by the CALLER — never here — because window.open() must sit inside
 * the click gesture; one await before it and the browser blocks the popup.
 * The 400ms pause lets the logo and fonts land before print() shoots.
 * (kwitansi-sheet.js tulis().)
 */
export function tulisLembar(w: Window, html: string): boolean {
  try {
    w.document.open()
    w.document.write(html)
    w.document.close()
  }
  catch {
    return false // the window was closed meanwhile
  }
  w.onload = () => {
    setTimeout(() => {
      try {
        w.focus()
        w.print()
      }
      catch { /* the window was closed */ }
    }, 400)
  }
  return true
}

/** The audit line the old screen wrote with a request (`:7224-7229`). */
export const auditMintaKwitansi = (r: Reservasi) =>
  `${r.name}, ${rupiahKwitansi(dpTotal(r))} (${kwitansiNo(r)})`

/** Detail for the PDF-print audit line (`:7380-7389`). */
export function auditCetakKwitansi(r: Reservasi, resmi: boolean, no: string): string {
  return `${r.name}, ${rupiahKwitansi(dpTotal(r))} (${no})${resmi ? ' — kwitansi resmi bertanda tangan' : ' — tanpa tanda tangan'}`
}
