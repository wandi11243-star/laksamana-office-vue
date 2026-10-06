// .xlsx / .csv reader, the single source for every module that reads a
// spreadsheet the user uploads (jadwal, hr Talenta, konten, cashier, finance,
// analytics). Port of laksamana-office deploy/assets/xlsx-baca.js; owner: the
// fondasi lane (docs/migrasi/PLAN.md §4, TIM-A.md §3). Import it, never copy it:
// the old Office lost time five times to twin files that drifted apart.
//
// No library (K-05 point 2): .xlsx is a ZIP of XML, and the browser already has
// DecompressionStream('deflate-raw'). The alternative was ~900 KB of SheetJS.
// Pure functions: no Vue, no API.

/** One sheet row keyed by column letter: `{ A: 'Nama', B: '12' }`. */
export type BarisTabel = Record<string, string>

/** One named sheet of a workbook. */
export interface LembarTabel { nama: string, baris: BarisTabel[] }

/** What the readers need from an uploaded file (a `File` fits). */
export interface BerkasTabel {
  name?: string
  text: () => Promise<string>
  arrayBuffer: () => Promise<ArrayBuffer>
}

interface IsiZip {
  daftar: string[]
  ambil: (nama: string) => Promise<string | null>
}

const PESAN_PERAMBAN = 'Peramban ini belum bisa membuka .xlsx '
  + '(butuh Chrome/Edge 80+, Safari 16.4+, Firefox 113+). Simpan berkasnya sebagai CSV lalu unggah lagi.'

/** Chrome/Edge 80+, Safari 16.4+, Firefox 113+. Older browsers are TOLD, not left to fail silently. */
export const bisaXlsx = (): boolean => typeof DecompressionStream === 'function'

async function inflateRaw(u8: Uint8Array): Promise<Uint8Array> {
  const rs = new Blob([u8 as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(rs).arrayBuffer())
}

export async function bacaZip(buf: ArrayBuffer): Promise<IsiZip> {
  const dv = new DataView(buf)
  // The End Of Central Directory is searched FROM THE END: a ZIP comment may be
  // up to 64 KB, so the marker is not always in the last 22 bytes.
  let eocd = -1
  for (let i = dv.byteLength - 22; i >= Math.max(0, dv.byteLength - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054B50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Berkasnya bukan .xlsx (tanda ZIP tidak ketemu).')
  const jml = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const isi: Record<string, { metode: number, ukKompres: number, off: number }> = {}
  for (let i = 0; i < jml; i++) {
    if (dv.getUint32(p, true) !== 0x02014B50) throw new Error('Daftar isi ZIP rusak.')
    const metode = dv.getUint16(p + 10, true)
    const ukKompres = dv.getUint32(p + 20, true)
    const nLen = dv.getUint16(p + 28, true)
    const eLen = dv.getUint16(p + 30, true)
    const kLen = dv.getUint16(p + 32, true)
    const off = dv.getUint32(p + 42, true)
    const nama = new TextDecoder().decode(new Uint8Array(buf, p + 46, nLen))
    isi[nama] = { metode, ukKompres, off }
    p += 46 + nLen + eLen + kLen
  }
  return {
    daftar: Object.keys(isi),
    async ambil(nama) {
      const e = isi[nama]
      if (!e) return null
      // The name/extra lengths in the LOCAL header may differ from the central
      // directory's (valid per spec). Skipping with the directory's numbers is a
      // bug that only shows on some files.
      if (dv.getUint32(e.off, true) !== 0x04034B50) throw new Error('Header berkas di dalam ZIP rusak.')
      const nLen = dv.getUint16(e.off + 26, true)
      const eLen = dv.getUint16(e.off + 28, true)
      const mentah = new Uint8Array(buf, e.off + 30 + nLen + eLen, e.ukKompres)
      const isiBytes = e.metode === 0 ? mentah : await inflateRaw(mentah)
      return new TextDecoder().decode(isiBytes)
    },
  }
}

const ENT_XML: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': '\'' }
const unescXml = (s: string): string => String(s)
  .replace(/&(amp|lt|gt|quot|apos);/g, m => ENT_XML[m] ?? m)
  .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(+d))

/**
 * Sheet XML -> rows keyed by column letter. Handles both ways a POS stores text:
 * sharedStrings (`t="s"`) and inline (`t="inlineStr"`).
 *
 * EMPTY CELLS ARE SELF-CLOSING (`<c r="M12" s="9"/>`), the most common form in
 * POS files. The old pattern required `</c>`, so a self-closing cell swallowed
 * the NEXT cell whole: on the August 2026 POS files that blanked Visit Purpose
 * in 100% of rows, Pax Total in 93%, and money columns in a few rows, where a
 * zero still looks like a plausible total. The cell pattern matches both forms,
 * and its attribute part must stay LAZY for the same reason.
 */
export function uraiSheet(xml: string, ss: string[]): BarisTabel[] {
  const baris: BarisTabel[] = []
  for (const mr of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const sel: BarisTabel = {}
    for (const mc of (mr[1] ?? '').matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tipe = (mc[2] ?? '').match(/ t="([^"]*)"/)?.[1] || 'n'
      // A self-closing cell is still recorded as empty, not skipped: callers
      // that measure row width from Object.keys must see the same thing either way.
      const dalam = mc[3] ?? ''
      let v: string
      if (tipe === 's') {
        const ix = dalam.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        v = ss[Number(ix)] ?? ''
      }
      else if (tipe === 'inlineStr' || tipe === 'str') {
        v = [...dalam.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')
      }
      else {
        v = dalam.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? ''
      }
      sel[mc[1]!] = unescXml(v)
    }
    baris.push(sel)
  }
  return baris
}

export function uraiSharedStrings(xml: string | null): string[] {
  if (!xml) return []
  const out: string[] = []
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    out.push(unescXml([...(m[1] ?? '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')))
  }
  return out
}

/** 0 -> A, 25 -> Z, 26 -> AA. */
function huruf(i: number): string {
  let s = ''
  i++
  while (i > 0) {
    const r = (i - 1) % 26
    s = String.fromCharCode(65 + r) + s
    i = (i - 1 - r) / 26
  }
  return s
}

/** A -> 0, Z -> 25, AA -> 26. */
function indeks(h: string): number {
  let n = 0
  for (const c of h) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/**
 * CSV: comma or semicolon (whichever splits the first line into more cells),
 * double-quote escaping. Some POS export CSV, and making people re-save it in
 * Excel silently changes date formats. Returned in the same column-letter shape
 * as .xlsx so callers never need to know which one they got.
 */
export function uraiCsvBaris(teks: string): BarisTabel[] {
  const pertama = teks.split('\n')[0] ?? ''
  const pemisah = pertama.split(';').length > pertama.split(',').length ? ';' : ','
  const out: string[][] = []
  let baris: string[] = []
  let sel = ''
  let kutip = false
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i]
    if (kutip) {
      if (c === '"') {
        if (teks[i + 1] === '"') {
          sel += '"'
          i++
        }
        else { kutip = false }
      }
      else { sel += c }
    }
    else if (c === '"') {
      kutip = true
    }
    else if (c === pemisah) {
      baris.push(sel)
      sel = ''
    }
    else if (c === '\n') {
      baris.push(sel)
      out.push(baris)
      baris = []
      sel = ''
    }
    else if (c !== '\r') {
      sel += c
    }
  }
  if (sel !== '' || baris.length) {
    baris.push(sel)
    out.push(baris)
  }
  return out.map((b) => {
    const o: BarisTabel = {}
    b.forEach((v, i) => {
      if (v !== '') o[huruf(i)] = v
    })
    return o
  })
}

const nomorLembar = (n: string): number => Number(n.match(/(\d+)/)?.[1]) || 0
const berkasLembar = (daftar: string[]): string[] => daftar
  .filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
  .sort((a, b) => nomorLembar(a) - nomorLembar(b))

/**
 * One file -> rows of its FIRST sheet, whether .xlsx or .csv. The first sheet,
 * not a named one: HR's schedule files name it "Bar"/"Kitchen"/"Floor" by
 * division, and demanding a name would reject correct files.
 */
export async function bacaBerkasTabel(file: BerkasTabel): Promise<BarisTabel[]> {
  const nama = String(file?.name || '').toLowerCase()
  if (/\.csv$/.test(nama)) return uraiCsvBaris(await file.text())
  if (!bisaXlsx()) throw new Error(PESAN_PERAMBAN)
  const zip = await bacaZip(await file.arrayBuffer())
  const lembar = berkasLembar(zip.daftar)
  if (!lembar.length) throw new Error('Berkasnya tidak punya satu lembar pun.')
  const ss = uraiSharedStrings(await zip.ambil('xl/sharedStrings.xml'))
  return uraiSheet((await zip.ambil(lembar[0]!)) ?? '', ss)
}

/**
 * EVERY sheet with its NAME, for files where the person picks the sheet (the
 * BRI QRIS reconciliation file keeps one sheet per month). bacaBerkasTabel is
 * deliberately not a wrapper of this: a 9.4 MB POS file must not be parsed for
 * sheets nobody reads.
 *
 * Names come from workbook.xml and ORDER from r:id -> rels. Guessing from the
 * file number is silently wrong: Excel numbers files by creation, not tab order
 * (in the 2026 QRIS file tab 7 "Juni26" is sheet7.xml while tab 1 "Juli26" is
 * sheet1.xml). Without workbook.xml or its rels the file is not "broken": it
 * falls back to file order as "Lembar N". CSV is one unnamed sheet.
 */
export async function bacaBerkasLembar(file: BerkasTabel): Promise<LembarTabel[]> {
  const nama = String(file?.name || '').toLowerCase()
  if (/\.csv$/.test(nama)) return [{ nama: 'CSV', baris: uraiCsvBaris(await file.text()) }]
  if (!bisaXlsx()) throw new Error(PESAN_PERAMBAN)
  const zip = await bacaZip(await file.arrayBuffer())
  const wb = await zip.ambil('xl/workbook.xml')
  const rels = await zip.ambil('xl/_rels/workbook.xml.rels')
  const petaRel: Record<string, string> = {}
  if (rels) {
    for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
      petaRel[m[1]!] = m[2]!.replace(/^\/?(xl\/)?/, 'xl/')
    }
  }
  const out: { nama: string, berkas: string }[] = []
  if (wb) {
    for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
      const at = m[1] ?? ''
      const nm = at.match(/\bname="([^"]*)"/)?.[1]
      const rid = at.match(/r:id="([^"]*)"/)?.[1]
      const berkas = rid ? petaRel[rid] : undefined
      if (!nm || !berkas) continue
      out.push({ nama: unescXml(nm), berkas })
    }
  }
  if (!out.length) {
    // An honest "Lembar 1" beats a guessed month name that is wrong.
    berkasLembar(zip.daftar).forEach((n, i) => out.push({ nama: 'Lembar ' + (i + 1), berkas: n }))
  }
  if (!out.length) throw new Error('Berkasnya tidak punya satu lembar pun.')
  const ss = uraiSharedStrings(await zip.ambil('xl/sharedStrings.xml'))
  const hasil: LembarTabel[] = []
  for (const s of out) {
    const xml = await zip.ambil(s.berkas)
    // A sheet named in workbook.xml but missing from the ZIP is SKIPPED: one
    // broken sheet must not make the other thirteen unreadable.
    if (xml === null) continue
    hasil.push({ nama: s.nama, baris: uraiSheet(xml, ss) })
  }
  if (!hasil.length) throw new Error('Tidak ada satu lembar pun yang bisa dibaca dari berkasnya.')
  return hasil
}

/**
 * Rows -> TSV, the same shape as copying from Excel, so modules with a paste
 * parser need no second parser for files.
 *
 * Width is the FURTHEST column in the whole file, not per row: trailing empty
 * cells are not written to the XML, so a row that stops early would lose columns
 * and shift every date to its right (someone's schedule moves a day, no error).
 */
export function barisKeTsv(baris: BarisTabel[]): string {
  let lebar = 0
  for (const b of baris) {
    for (const k of Object.keys(b)) lebar = Math.max(lebar, indeks(k) + 1)
  }
  return baris.map((b) => {
    const sel: string[] = []
    for (let i = 0; i < lebar; i++) sel.push(b[huruf(i)] ?? '')
    return sel.join('\t')
  }).join('\n')
}
