// Invoice DP & pelunasan — the shared print sheet, one file used by two modules.
//
// Marketing draws it from the LIVE event (its own mapping); Finance draws it
// from the request's `ringkas` (the state at request time) plus the issued
// number, signatories, stamp, materai flag and Marketing's text edits from
// `GET /invoices/file/{resId}`. When the event is edited after issue the two
// can name different numbers — Finance's is the approved one.
//
// Port of laksamana-office/deploy/assets/invoice-sheet.js (the whole file).
// Amounts keep the sheet's own spelling ("Rp 1.000.000"); dates are read as
// LOCAL (T00:00:00), never UTC, so a dateless date does not shift a day west.

import { namaBerkas } from './cetak'

export const INV_KOP = {
  pt: 'PT. Laksamana Muda Bersatu',
  alamat: 'Jl. Soekarno - Hatta No. 39, Labuh Baru Tim, Kec. Payung Sekaki,<br>Kota Pekanbaru, Riau 28282',
  bank: 'UOB | PT. Laksamana Muda Bersatu',
  rek: '319-303-3588',
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export function escSheet(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c: string) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c] ?? c
  })
}

export function rpSheet(n: unknown): string {
  return `Rp ${(Number(n) || 0).toLocaleString('id-ID')}`
}

export function tglSheet(iso: unknown): string {
  if (!iso) return '—'
  const x = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(x.getTime())) return escSheet(iso)
  return `${HARI[x.getDay()]}, ${x.getDate()} ${BULAN[x.getMonth()]} ${x.getFullYear()}`
}

export interface BarisSheet { desc?: string, qty?: number, harga?: number, [k: string]: unknown }
export interface KetSheet { asal?: string, teks?: string }
export interface TotalSheet { label: string, nilai: number, tebal?: boolean }

/**
 * Apply Marketing's Keterangan edits to the bill rows. `ket` runs alongside
 * the rows as edited. Matched by `asal` (the row's own text), NOT by position
 * alone: position is tried first (fast and right for the common case), then
 * falls back to an unused `asal` search, so a reorder after the edit does not
 * print "Sewa sound" on the food row without a single error. Empty edit text
 * means the default text.
 */
export function terapkanKetSheet<T extends BarisSheet>(items: T[], ket: KetSheet[]): (T & { ket: string, diubah: boolean })[] {
  const rows = Array.isArray(items) ? items : []
  const edits = Array.isArray(ket) ? ket : []
  const pakai = new Set<number>()
  return rows.map((it, i) => {
    const asal = String(it.desc ?? '')
    const cocok = edits[i]
    let j = (cocok && String(cocok.asal) === asal && !pakai.has(i)) ? i : -1
    if (j < 0) {
      for (let n = 0; n < edits.length; n++) {
        const cand = edits[n]
        if (!pakai.has(n) && cand && String(cand.asal) === asal) {
          j = n
          break
        }
      }
    }
    let teks = ''
    if (j > -1) {
      const pick = edits[j]
      pakai.add(j)
      teks = String(pick?.teks || '').trim()
    }
    return { ...it, ket: teks || asal, diubah: !!teks && teks !== asal }
  })
}

function barisTotalSheet(t: TotalSheet): string {
  const n = Number(t.nilai) || 0
  // "- Rp x", not "Rp -x": a mid-number minus reads as part of the amount.
  const teks = (n < 0 ? `- ${rpSheet(-n)}` : rpSheet(n))
  return `<tr><td colspan="3" style="padding:6px 12px;text-align:right;${t.tebal ? 'font-weight:700;' : 'color:#555;'}font-size:12px">${escSheet(t.label)}</td>`
    + `<td style="padding:6px 12px;text-align:right;font-family:ui-monospace,monospace;${t.tebal ? 'font-weight:700;font-size:13px;' : 'font-size:12px;'}white-space:nowrap">${teks}</td></tr>`
}

export interface InvoiceSheetData {
  logo?: string
  no?: string
  resmi?: boolean
  lunas?: boolean
  tanggalTerbit?: string
  kepada?: string
  up?: string
  acara?: string
  tanggalAcara?: string
  jenisAcara?: string
  pax?: string | number
  items?: BarisSheet[]
  ket?: KetSheet[]
  totals?: TotalSheet[]
  penanda?: { nama?: string, jabatan?: string, ttd?: string }[]
  cap?: string
  kaki?: string
}

/**
 * d = flat data (see the interface): logo, no, resmi, lunas, tanggalTerbit,
 * kepada, up (NOT "PIC" — the sheet is read by the client, and PIC is our
 * internal word), acara, tanggalAcara, jenisAcara, pax, items [{desc, qty,
 * harga}], ket [{asal, teks}], totals [{label, nilai, tebal}] (built by the
 * caller — the pelunasan deduction rows genuinely differ per module),
 * penanda [{nama, jabatan, ttd}], cap, kaki.
 */
export function invoiceHtml(d: InvoiceSheetData): string {
  const src = d || {}
  const lunas = !!src.lunas
  const resmi = !!src.resmi
  const noDok = resmi && src.no ? src.no : '—'
  const items = terapkanKetSheet(src.items ?? [], src.ket ?? [])

  let h = `<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #F7BB0E;padding-bottom:16px;margin-bottom:20px">`
    + `<div style="display:flex;gap:12px;align-items:center">`
    + (src.logo ? `<img src="${escSheet(src.logo)}" alt="" style="width:46px;height:46px;object-fit:contain;flex:none">` : '')
    + `<div><div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#0C1826">${INV_KOP.pt}</div>`
    + `<div style="font-size:10px;letter-spacing:.2em;color:#C8940A">LAKSAMANA MUDA COFFEE &amp; LIVE SPACE</div>`
    + `<div style="font-size:10.5px;color:#666;margin-top:4px;line-height:1.5">${INV_KOP.alamat}</div></div></div>`
    + `<div style="text-align:right"><div style="font-size:11px;letter-spacing:.15em;color:#C8940A;font-weight:700">`
    + (lunas ? 'INVOICE PELUNASAN' : 'INVOICE DOWN PAYMENT') + `</div>`
    + `<div style="font-size:18px;font-family:Georgia,serif;font-weight:700;margin-top:4px">${escSheet(noDok)}</div>`
    + `<div style="font-size:11.5px;color:#555;margin-top:2px">${tglSheet(src.tanggalTerbit)}</div>`
    + (resmi ? '' : `<div style="font-size:10px;color:#C0392B;margin-top:4px;font-weight:700">BELUM DITERBITKAN FINANCE</div>`)
    + `</div></div>`

  h += `<div style="background:#F6F4EE;border-radius:10px;padding:14px 18px;margin-bottom:18px;display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:12.5px">`
    + `<div><b>Kepada</b>: ${escSheet(src.kepada || '—')}</div><div><b>U.P</b>: ${escSheet(src.up || '—')}</div>`
    + `<div><b>Acara</b>: ${escSheet(src.acara || '—')}</div><div><b>Tanggal acara</b>: ${tglSheet(src.tanggalAcara)}</div>`
    + `<div><b>Jenis</b>: ${escSheet(src.jenisAcara || '—')}</div><div><b>Estimasi</b>: ${escSheet(src.pax || '—')} pax</div></div>`

  const th = 'padding:8px 12px;font-size:11px;border-bottom:1px solid #e5e2da'
  h += `<table style="width:100%;border-collapse:collapse;margin-bottom:6px">`
    + `<thead><tr style="background:#F2EFE7">`
    + `<th style="text-align:left;${th}">Keterangan</th>`
    + `<th style="text-align:right;${th};width:60px">Qty</th>`
    + `<th style="text-align:right;${th};width:120px">Harga</th>`
    + `<th style="text-align:right;${th};width:130px">Jumlah</th>`
    + `</tr></thead><tbody>`
  if (items.length) {
    const td = 'padding:7px 12px;font-size:12px;border-bottom:1px solid #efece5'
    items.forEach((r, i) => {
      const qty = (Number(r.qty) || 0) || 1
      const harga = Number(r.harga) || 0
      h += `<tr style="background:${i % 2 ? '#fff' : '#faf9f5'}">`
        + `<td style="${td};white-space:pre-line">${escSheet(r.ket || '—')}</td>`
        + `<td style="${td};text-align:right">${qty}</td>`
        + `<td style="${td};text-align:right;font-family:ui-monospace,monospace">${rpSheet(harga)}</td>`
        + `<td style="${td};text-align:right;font-family:ui-monospace,monospace">${rpSheet(qty * harga)}</td></tr>`
    })
  }
  else {
    h += `<tr><td colspan="4" style="padding:12px;font-size:12px;color:#888;text-align:center">Rincian tagihan belum diisi.</td></tr>`
  }
  h += `</tbody><tfoot>${(src.totals ?? []).map(barisTotalSheet).join('')}</tfoot></table>`

  h += `<div style="background:#FBF3D8;border-radius:10px;padding:12px 18px;margin-top:16px;font-size:12px;line-height:1.7">`
    + `<b>Pembayaran ditujukan ke</b><br>${escSheet(INV_KOP.bank)} &middot; No. Rek <b>${escSheet(INV_KOP.rek)}</b>`
    + `<br><span style="color:#666">Mohon cantumkan nomor invoice ${escSheet(noDok)} pada berita transfer.</span></div>`

  // Unofficial / unsigned sheet: SIGNATURE LINES with fallback titles — an
  // empty box without a line reads like a failed image load.
  const pen = (resmi && Array.isArray(src.penanda) && src.penanda.length)
    ? src.penanda
    : [{ nama: '', jabatan: 'Direktur', ttd: '' }, { nama: '', jabatan: 'Finance', ttd: '' }]
  const cap = src.cap || ''
  h += `<div style="display:flex;justify-content:flex-end;gap:26px;margin-top:26px;font-size:12px">`
    + pen.map((p, i) => {
      return `<div style="text-align:center;min-width:180px;position:relative">`
        + `<div style="color:#666">Hormat kami,</div>`
        + (i === 0 && cap ? `<img src="${escSheet(cap)}" alt="" style="position:absolute;left:50%;top:14px;transform:translateX(-50%) rotate(-12deg);height:86px;opacity:.85">` : '')
        + (p.ttd
          ? `<img src="${escSheet(p.ttd)}" alt="" style="height:56px;margin:4px 0;position:relative">`
          : `<div style="height:56px"></div><div style="border-bottom:1px solid #bbb;margin:0 12px 5px"></div>`)
        + `<div style="font-weight:700;position:relative">${escSheet(p.nama || '(...................)')}</div>`
        + `<div style="color:#666;position:relative">${escSheet(p.jabatan || '')}</div></div>`
    }).join('')
    + `</div>`

  h += `<div style="margin-top:26px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#aaa;display:flex;justify-content:space-between">`
    + `<span>${INV_KOP.pt} &middot; @laksamanamuda.id</span><span>${escSheet(src.kaki || '')}</span></div>`

  return `<div class="doc" style="max-width:800px;margin:0 auto;padding:34px 40px;font-family:Inter,sans-serif;color:#1a1a1a">${h}</div>`
}

/** A whole document for a fresh window (used by Finance to LOOK first). */
export function invoiceHalaman(d: InvoiceSheetData): string {
  const src = d || {}
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escSheet(namaBerkas('Invoice', src.no, src.kepada || src.acara))}</title>`
    + `<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#fff}`
    + `@page{size:A4;margin:10mm}@media print{.noprint{display:none}}`
    + `.noprint{margin:18px 0 28px;text-align:center}`
    + `.noprint button{font:600 13px/1 "Segoe UI",Arial;padding:10px 18px;border-radius:8px;border:0;background:#C9A227;color:#2a2620;cursor:pointer}</style>`
    + `</head><body>${invoiceHtml(src)}`
    + `<div class="noprint"><button onclick="window.print()">Simpan sebagai PDF / Cetak</button></div></body></html>`
}

/**
 * Write into an ALREADY opened window (window.open must sit in the click
 * gesture, before one await). Does NOT print at once: Finance opens it to
 * LOOK first; the print button is inside.
 */
export function tulisInvoice(w: Window | null, d: InvoiceSheetData): boolean {
  if (!w) return false
  try {
    w.document.open()
    w.document.write(invoiceHalaman(d))
    w.document.close()
  }
  catch { return false }
  return true
}

export interface BuktiBayarSheet { jenis?: string, adaBukti?: boolean }

/**
 * The LUNAS stamp only lands when the proof EXISTS. DP: a DP payment with
 * proof (or any proven one when there is no DP row). Pelunasan: a proven
 * Pelunasan row, or every payment proven when there is no Pelunasan row.
 */
export function adaBuktiSheet(bayar: BuktiBayarSheet[], jenis: string): boolean {
  const p = Array.isArray(bayar) ? bayar : []
  const ada = (x: BuktiBayarSheet) => !!(x && x.adaBukti)
  if (jenis === 'INV_LUNAS') {
    const pl = p.filter(x => String(x.jenis || '') === 'Pelunasan')
    if (pl.length) return pl.some(ada)
    return p.length > 0 && p.every(ada)
  }
  const dp = p.filter(x => String(x.jenis || '') === 'DP')
  return (dp.length ? dp : p).some(ada)
}
