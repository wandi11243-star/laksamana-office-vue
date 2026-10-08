// Investor Compass — pure display helpers. No Vue, no API.
//
// Source: laksamana-office/investor/index.html (rp/rpSumbu :600-615,
// blnPanjang :625-631, delta :633-640, ketPajak :870-908, ukuranTeks,
// bulanLaluISO). Month names follow app/utils/format.ts BULAN ("Agustus",
// not the old file's "Agu").
import { BULAN } from '~/utils/format'

/** Short axis form only: "Rp 622 jt", "Rp 1,2 M". Full figures stay full. */
export function rpSumbu(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1e9) {
    const m = n / 1e9
    return `Rp ${m.toFixed(Number.isInteger(m) ? 0 : 1).replace('.', ',')} M`
  }
  if (Math.abs(n) >= 1e6) return `Rp ${Math.round(n / 1e6)} jt`
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

/** "2026-08" -> "Agustus 2026". */
export function blnPanjang(kunci: string | null | undefined): string {
  if (!kunci) return '—'
  const p = String(kunci).split('-')
  if (p.length < 2) return String(kunci)
  return `${BULAN[Number(p[1]) - 1] ?? p[1]} ${p[0]}`
}

/** Percent change that refuses to lie when the baseline is zero or missing:
 *  null = cannot be compared, and the caller draws nothing at all. */
export function deltaPersen(kini: number | null, lalu: number | null): number | null {
  if (kini === null || lalu === null || !lalu) return null
  return (kini - lalu) / lalu * 100
}

/** What is inside the big number: service & tax included, compliment cut out
 *  with the full POS bill figure. Empty when all three are zero — a note
 *  explaining a zero difference is one more line to read. */
export function ketPajak(x: { svc?: number | null, pajak?: number | null, compliment?: number | null, dibayarTamu?: number | null } | null | undefined, rp: (n: number | null | undefined) => string): string {
  if (!x) return ''
  const sv = Number(x.svc || 0)
  const pj = Number(x.pajak || 0)
  const cp = Number(x.compliment || 0)
  if (sv + pj + cp <= 0) return ''
  const bag: string[] = []
  if (sv + pj > 0) bag.push(`termasuk service ${rp(sv)} & pajak ${rp(pj)}`)
  if (cp > 0) bag.push(`dipotong compliment ${rp(cp)} dari tagihan POS ${rp(x.dibayarTamu)}`)
  return bag.join(' · ')
}

/** 1534283 -> "1,5 MB"; 2048 -> "2 KB". */
export function ukuranTeks(n: number): string {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1).replace('.', ',')} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

/** Last month as "YYYY-MM": accounting reports come out after the month
 *  closes, so a new upload is almost always for the previous month. */
export function bulanLaluISO(d = new Date()): string {
  const t = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
}

/** "hari ini" / "besok" / "3 hari lagi" relative to the server's today. */
export function jarakHari(tgl: string, hariIni: string): string {
  if (!tgl || !hariIni) return ''
  const n = Math.round((new Date(`${tgl}T00:00:00`).getTime() - new Date(`${hariIni}T00:00:00`).getTime()) / 86400000)
  if (Number.isNaN(n) || n <= 0) return 'hari ini'
  if (n === 1) return 'besok'
  if (n < 7) return `${n} hari lagi`
  return `${Math.round(n / 7)} minggu lagi`
}

/** Read the first bytes of a picked file and refuse non-PDFs before a single
 *  byte travels: the server checks the content again (checked by `%PDF`,
 *  ≤ 12 MB), this only saves the wait. */
export async function fileBukanPdf(file: File): Promise<boolean> {
  try {
    const head = await file.slice(0, 5).arrayBuffer().then(b => new TextDecoder().decode(b))
    return !head.startsWith('%PDF')
  }
  catch {
    return true
  }
}

/** A picked file -> base64 without the data: prefix (FileReader, not a
 *  per-byte loop: a 12 MB file converted byte by byte hangs the tab). */
export function bacaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]+,/, ''))
    r.onerror = () => reject(new Error('berkas tidak bisa dibaca'))
    r.readAsDataURL(file)
  })
}
