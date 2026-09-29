// Transfer-proof parser: OCR text -> date, time, amount, bank, sender name.
//
// Pure functions, no Vue, no API, no tesseract. The machine result is a
// SUGGESTION only (`tfOcrSaran`): it never fills a field by itself —
// `applyOcr()` in ocr.ts stores it, a person presses "Pakai" per column.
//
// Owned by reservasi (PLAN.md §4), read by DanaMasukPanel.
//
// Source: laksamana-office/deploy/reservasi/index.html:8575-8997.

const pad2 = (n: number | string) => String(n).padStart(2, '0')

/** "2026-9-5" -> "2026-09-05", or "" when out of range (`:8603`). */
export function isoTanggal(y: number | string, m: number | string, d: number | string): string {
  const yy = Number(y)
  const mm = Number(m)
  const dd = Number(d)
  if (!yy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return ''
  return `${yy}-${pad2(mm)}-${pad2(dd)}`
}

/** "500.000,00" / "Rp 1,500,000" -> 500000 / 1500000: cents dropped, thousand separators cleaned (`:8608`). */
export function angkaID(s: string): number {
  let x = String(s || '').replace(/\s/g, '')
  x = x.replace(/[.,]\d{2}$/, '')
  const d = x.replace(/[^0-9]/g, '')
  return d ? Number(d) : 0
}

export const OCR_BULAN: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
}

/** The bank list the old screen scanned for (`:8575-8599`). DANA stays case-sensitive on purpose. */
export const OCR_BANK: [string, RegExp][] = [
  ['BCA', /\b(BCA|KLIKBCA|MY\s?BCA|BANK CENTRAL ASIA|BLU)\b/i],
  ['Mandiri', /\b(MANDIRI|LIVIN)\b/i],
  ['BRI', /\b(BRI|BRIMO|BANK RAKYAT)\b/i],
  ['BNI', /\b(BNI|BANK NEGARA)\b/i],
  ['BSI', /\b(BSI|BANK SYARIAH)\b/i],
  ['CIMB Niaga', /\b(CIMB|OCTO)\b/i],
  ['Permata', /\bPERMATA\b/i],
  ['Danamon', /\bDANAMON\b/i],
  ['BTN', /\bBTN\b/i],
  ['SeaBank', /\bSEA\s?BANK\b/i],
  ['Bank Jago', /\bJAGO\b/i],
  ['Maybank', /\bMAYBANK\b/i],
  ['OCBC', /\bOCBC\b/i],
  ['Panin', /\bPANIN\b/i],
  ['Bank Mega', /\bBANK\s?MEGA\b/i],
  ['Jenius/BTPN', /\b(JENIUS|BTPN)\b/i],
  ['UOB', /\bUOB\b/i],
  ['QRIS', /\bQRIS\b/i],
  ['DANA', /\bDANA\b/],
  ['OVO', /\bOVO\b/i],
  ['GoPay', /\b(GO-?PAY|GOJEK)\b/i],
  ['ShopeePay', /\bSHOPEE\s?PAY\b/i],
  ['LinkAja', /\bLINK\s?AJA\b/i],
]

/**
 * The bank the money came FROM — not the acquirer. A SeaBank QRIS receipt
 * writes "Nama Acquirer: BRI", Livin writes "Pengakuisisi: Bank BRI": grabbing
 * the first bank name gives "BRI". Each line is scored with its two lines of
 * context (`:8617-8649`).
 */
const BANK_POS = /(sumber dana|rekening sumber|bank pengirim|bank asal|pengirim|sumber|dari|from)/i
const BANK_NEG = /(penerima|acquirer|pengakuisisi|merchant|tujuan|kepada|beneficiary|nama toko|\bke\b)/i

export function ocrBank(t: string): string {
  const lines = String(t || '').split(/\r?\n/).map(s => s.trim())
  let best: { name: string, score: number } | null = null
  lines.forEach((line, i) => {
    if (!line) return
    const ctx = [lines[i - 2] || '', lines[i - 1] || '', line].join('\n')
    // "Sumber Dana" is context, but its "Dana" must not read as the DANA e-wallet.
    const hay = line.replace(/sumber\s+dana/ig, ' ')
    let base = 0
    if (BANK_POS.test(ctx)) base += 3
    if (BANK_NEG.test(ctx)) base -= 5
    if (i < 3) base += 2
    if (/\bbank\b/i.test(hay)) base += 1
    for (const [name, re] of OCR_BANK) {
      if (!re.test(hay)) continue
      const score = base + (name === 'QRIS' ? -1 : 0)
      if (!best || score > best.score) best = { name, score }
    }
  })
  return best ? best.name : ''
}

/** A date written anywhere: ISO, "09 Jul 2026" / "01Agu 2026" without space (BRImo), or 14/07/2026 (`:8650-8675`). */
export function tanggalDalam(s: string): string {
  let m = s.match(/\b(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/)
  if (m) return isoTanggal(m[1]!, m[2]!, m[3]!)
  // Swept over ALL occurrences, not just the first: `match` without /g stops
  // at the first hit, and a non-month word there would hide the real date below.
  for (const mm of s.matchAll(/\b(\d{1,2})\s*([A-Za-z]{3,10})\.?,?\s+(20\d{2})\b/g)) {
    const mo = OCR_BULAN[mm[2]!.slice(0, 3).toLowerCase()]
    if (mo) return isoTanggal(mm[3]!, mo, mm[1]!)
  }
  m = s.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2}|\d{2})\b/)
  if (m) return isoTanggal(m[3]!.length === 2 ? `20${m[3]}` : m[3]!, m[2]!, m[1]!)
  return ''
}

const STEMPEL_TAHUN_MIN = 2024
const STEMPEL_TAHUN_MAKS = 2035

/**
 * The Ref/RRN number on a QRIS receipt carries its own timestamp as a digit
 * run — "2026 09 11 2044 …" — so the date is printed TWICE on one proof.
 * That rescues rows whose date line misread.
 *
 * The ONLY thing that makes the stamp trustworthy: the four clock digits in
 * it must match the time read SEPARATELY from a time line. Without that
 * anchor any long digit run (Merchant PAN, card number) could happen to hold
 * eight digits forming a valid date. More than one candidate = none returned.
 * (`:8677-8724`)
 */
export function tglStempel(teks: string, jam: string | null | undefined): string {
  const hhmm = String(jam == null ? '' : jam).replace(/[^0-9]/g, '').slice(0, 4)
  if (hhmm.length !== 4) return ''
  const hasil = new Set<string>()
  for (const run of (String(teks || '').match(/\d{12,}/g) || [])) {
    for (let i = 0; i + 12 <= run.length; i++) {
      if (run.slice(i + 8, i + 12) !== hhmm) continue
      const y = +run.slice(i, i + 4)
      const m = +run.slice(i + 4, i + 6)
      const d = +run.slice(i + 6, i + 8)
      if (y < STEMPEL_TAHUN_MIN || y > STEMPEL_TAHUN_MAKS) continue
      // Matched against the real calendar: isoTanggal() lets 31 February pass.
      const dt = new Date(Date.UTC(y, m - 1, d))
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) continue
      hasil.add(isoTanggal(y, m, d))
    }
  }
  return hasil.size === 1 ? [...hasil][0]! : ''
}

/**
 * The transfer date: the Ref stamp first (anchored by the time), then the date
 * lines. Called without a time, only the date lines are read (`:8726-8731`).
 */
export function ocrTanggal(t: string, jam?: string | null): string {
  const s = String(t || '')
  return tglStempel(s, jam ?? null) || tanggalDalam(s)
}

/** A time anywhere: meridiem first (a "07:30 PM" stored as "07:30" is twelve hours off), then seconds, then WIB, then bare HH:MM (`:8732-8758`). */
export function jamDalam(s: string): string {
  let m = s.match(/\b(0?[1-9]|1[0-2])[:.]([0-5]\d)(?:[:.]([0-5]\d))?\s*([AaPp])\.?\s?[Mm]\.?(?![A-Za-z])/)
  if (m) {
    let h = (+m[1]!) % 12
    if (/p/i.test(m[4]!)) h += 12
    return `${pad2(h)}:${m[2]}${m[3] ? `:${m[3]}` : ''}`
  }
  m = s.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)[:.]([0-5]\d)\b/)
  if (m) return `${pad2(m[1]!)}:${m[2]}:${m[3]}`
  m = s.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(WIB|WITA|WIT)\b/i)
  if (m) return `${pad2(m[1]!)}:${m[2]}`
  m = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (m) return `${pad2(m[1]!)}:${m[2]}`
  return ''
}

/**
 * The time found, certainty not weighed. Kept apart from `ocrJam()` so that
 * `jamRagu()` can NAME the number that was deliberately left out (`:8760-8767`).
 * Searched on date lines first: a phone screenshot's status-bar clock ("16.55")
 * sits at the very top and must not win.
 */
export function ocrJamMentah(t: string): string {
  const lines = String(t || '').split(/\r?\n/)
  for (const line of lines) {
    if (!tanggalDalam(line)) continue
    const v = jamDalam(line)
    if (v) return v
  }
  return jamDalam(String(t || ''))
}

const RE_MERIDIEM = /\b\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*[AaPp]\.?\s?[Mm]\b(?![A-Za-z])/
const RE_ZONA = /\b(WIB|WITA|WIT)\b/i

/** Certain only when the hour is impossible in 12-hour form, or the proof says AM/PM or WIB (`:8768-8779`). */
export function jamPasti(teks: string, jam: string): boolean {
  if (!jam) return false
  const h = +String(jam).slice(0, 2)
  if (h === 0 || h >= 13) return true
  return RE_MERIDIEM.test(String(teks || '')) || RE_ZONA.test(String(teks || ''))
}

/**
 * When in doubt the time is LEFT EMPTY rather than risk twelve hours off
 * (`:8780-8796`). What is lost is not hidden: `jamRagu()` names the number.
 */
export function ocrJam(t: string): string {
  const v = ocrJamMentah(t)
  return jamPasti(t, v) ? v : ''
}

/** The time deliberately left out for doubt, with its number — explains an empty Jam column (`:8797-8804`). */
export function jamRagu(teksOcr: string, tfTime: string): string {
  if (tfTime || !teksOcr) return ''
  const v = ocrJamMentah(teksOcr)
  return (v && !jamPasti(teksOcr, v)) ? v : ''
}

/** Display a time the way the proof wrote it, pinned to 24 hours first (`:8805-8828`). */
export function jam24(v: string | null | undefined): string {
  const s = String(v == null ? '' : v).trim()
  if (!s) return ''
  let m = s.match(/^(0?[1-9]|1[0-2])[:.]([0-5]\d)(?:[:.]([0-5]\d))?\s*([AaPp])\.?\s?[Mm]\.?(?![A-Za-z])/)
  if (m) {
    let h = (+m[1]!) % 12
    if (/p/i.test(m[4]!)) h += 12
    return `${pad2(h)}:${m[2]}${m[3] ? `:${m[3]}` : ''}`
  }
  m = s.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.]([0-5]\d))?/)
  if (m) return `${pad2(m[1]!)}:${m[2]}${m[3] ? `:${m[3]}` : ''}`
  // Unreadable is returned as-is: an unseen shape should look odd, not vanish.
  return s
}

/**
 * A wrongly stored time recovered from the SAVED ocr text — no new OCR, no
 * guessing (`:8829-8855`). Only when the text really holds a meridiem time.
 * The fixer is always a person, one row one button.
 */
export function jamSeharusnya(teksOcr: string, tfTime: string): string {
  if (!tfTime || !teksOcr) return ''
  if (!/\b\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*[AaPp]\.?\s?[Mm]\b/.test(teksOcr)) return ''
  const benar = ocrJam(teksOcr)
  return (benar && benar !== tfTime) ? benar : ''
}

/**
 * The date as it should be, from the Ref stamp in the SAVED ocr text — never a
 * fresh read of the same picture with the same machine (`:8886-8915`).
 */
export function tglSeharusnya(teksOcr: string, tfTime: string, tfDate: string): string {
  if (!teksOcr || !tfTime) return ''
  const cap = tglStempel(teksOcr, tfTime)
  return (cap && cap !== String(tfDate || '')) ? cap : ''
}

/** The amount: lines with "Nominal/Jumlah/Total" win, "admin/saldo/sisa" lines lose; ties go to the largest (`:8925-8955`). */
export function ocrNominal(t: string): number {
  const POS = /(nominal|jumlah|total|nilai|amount|transfer|dibayar|pembayaran|dikirim)/i
  const NEG = /(biaya|admin|fee|saldo|sisa|limit|denda|pajak|potongan|cashback|po[il]n)/i
  const RE = /(rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)|rp\.?\s*(\d{4,})/gi
  const lines = String(t || '').split(/\r?\n/)
  let best: { score: number, val: number } | null = null
  lines.forEach((line, i) => {
    let pos = POS.test(line)
    const negHere = NEG.test(line)
    let neg = negHere
    // Some receipts put the LABEL on the line above the number.
    if (!pos && !neg) {
      const prev = lines[i - 1] || ''
      pos = POS.test(prev)
      neg = NEG.test(prev)
    }
    const base = (pos ? 3 : 0) + (neg ? -6 : 0)
    let m: RegExpExecArray | null
    RE.lastIndex = 0
    while ((m = RE.exec(line))) {
      const raw = m[2] || m[3]
      if (!raw) continue
      const val = angkaID(raw)
      if (val < 1000 || val > 2e9) continue
      const score = base + (m[1] || m[3] ? 1 : 0)
      if (!best || score > best.score || (score === best.score && val > best.val)) best = { score, val }
    }
  })
  return best?.val ?? 0
}

const NAMA_LABEL = /^(sumber dana|nama pengirim|rekening sumber|nama rekening|pengirim|dari|from)\b[\s:.\-]*/i

function miripNama(s: string): boolean {
  s = String(s || '').trim()
  if (s.length < 3 || s.length > 60) return false
  if (/\d/.test(s)) return false
  if (/^(rp|bank|transfer|qris|gratis|berhasil|sukses)\b/i.test(s)) return false
  if (OCR_BANK.some(([, re]) => re.test(s))) return false
  return /[A-Za-z]{3}/.test(s)
}

/** The sender's account name: under "Sumber Dana" / "Dari", never the receiver (`:8957-8979`). */
export function ocrNama(t: string): string {
  const lines = String(t || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(NAMA_LABEL)
    if (!m) continue
    let val = lines[i]!.slice(m[0].length).trim()
    if (!miripNama(val)) val = (lines[i + 1] || '').trim()
    if (miripNama(val)) return val.replace(/\s{2,}/g, ' ').trim()
  }
  return ''
}

export interface HasilParseTransfer {
  bank: string
  date: string
  time: string
  amount: number
  name: string
}

/**
 * OCR text -> the five columns. The time is read FIRST and passed to the date:
 * it anchors the Ref-stamp cross-check (`:8982-8996`).
 */
export function parseTeksTransfer(txt: string): HasilParseTransfer {
  const t = String(txt || '').replace(/ /g, ' ')
  const time = ocrJam(t)
  return { bank: ocrBank(t), date: ocrTanggal(t, time), time, amount: ocrNominal(t), name: ocrNama(t) }
}
