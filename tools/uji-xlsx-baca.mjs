/*
 * tools/uji-xlsx-baca.mjs — guard for app/utils/xlsx-baca.ts.
 *
 *   node tools/uji-xlsx-baca.mjs      (Node 24: imports the .ts directly)
 *
 * No dependency: it builds real .xlsx files in memory (node:zlib for deflate)
 * and checks the incidents the old reader's comments record, each of which
 * fails SILENTLY without a test:
 *
 *   1. self-closing empty cells must not swallow the next cell (Aug 2026 POS);
 *   2. shared strings AND inline strings both read as text;
 *   3. sheet names/order from workbook.xml + rels, not from sheetN.xml numbers;
 *   4. a local header whose extra field differs from the central directory's;
 *   5. a ZIP comment before the end record, and stored (uncompressed) entries;
 *   6. CSV with ; or , and quotes, in the same column-letter shape;
 *   7. barisKeTsv pads to the widest row, so dates never shift left.
 */
import { deflateRawSync } from 'node:zlib'
import {
  bacaBerkasLembar, bacaBerkasTabel, barisKeTsv, uraiCsvBaris, uraiSheet,
} from '../app/utils/xlsx-baca.ts'

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

/** Minimal ZIP writer. `entries`: [{ nama, isi, simpan?, extraLokal? }]. */
function zip(entries, komentar = '') {
  const lokal = []
  const pusat = []
  let off = 0
  for (const e of entries) {
    const nama = Buffer.from(e.nama)
    const data = Buffer.from(e.isi)
    const metode = e.simpan ? 0 : 8
    const kompres = e.simpan ? data : deflateRawSync(data)
    const extra = Buffer.alloc(e.extraLokal || 0)
    const h = Buffer.alloc(30)
    h.writeUInt32LE(0x04034B50, 0)
    h.writeUInt16LE(metode, 8)
    h.writeUInt32LE(kompres.length, 18)
    h.writeUInt32LE(data.length, 22)
    h.writeUInt16LE(nama.length, 26)
    h.writeUInt16LE(extra.length, 28)
    lokal.push(h, nama, extra, kompres)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014B50, 0)
    c.writeUInt16LE(metode, 10)
    c.writeUInt32LE(kompres.length, 20)
    c.writeUInt32LE(data.length, 24)
    c.writeUInt16LE(nama.length, 28)
    c.writeUInt32LE(off, 42)
    pusat.push(c, nama)
    off += 30 + nama.length + extra.length + kompres.length
  }
  const cd = Buffer.concat(pusat)
  const kom = Buffer.from(komentar)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054B50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(off, 16)
  end.writeUInt16LE(kom.length, 20)
  return Buffer.concat([...lokal, cd, end, kom])
}

const berkas = (name, buf) => ({
  name,
  text: async () => Buffer.from(buf).toString('utf8'),
  arrayBuffer: async () => {
    const b = Buffer.from(buf)
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.length)
  },
})
const sheet = rows => `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`

console.log('\nxlsx-baca')

// 1 + 2: self-closing cells, shared and inline strings, entities.
const s1 = sheet(
  '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="9"/><c r="C1" t="inlineStr"><is><t>Pax &amp; Meja</t></is></c><c r="D1"><v>125000</v></c></row>'
  + '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" s="9"/><c r="C2" s="9"/><c r="D2"><v>7</v></c></row>',
)
const ss = '<sst><si><t>Nama</t></si><si><r><t>Bu</t></r><r><t>di</t></r></si></sst>'
const rows = uraiSheet(s1, ['Nama', 'Budi'])
cek('sel self-closing tidak menelan sel berikutnya', rows[0].D === '125000' && rows[1].D === '7', JSON.stringify(rows))
cek('sel kosong tetap tercatat sebagai ""', rows[1].B === '' && rows[1].C === '')
cek('inlineStr + entitas XML', rows[0].C === 'Pax & Meja')

const wbBalik = '<workbook><sheets><sheet name="Juli26" sheetId="1" r:id="rId1"/><sheet name="Juni26" sheetId="2" r:id="rId2"/></sheets></workbook>'
const rels = '<Relationships><Relationship Id="rId1" Target="worksheets/sheet7.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet1.xml"/></Relationships>'
const xlsx = zip([
  { nama: 'xl/workbook.xml', isi: wbBalik },
  { nama: 'xl/_rels/workbook.xml.rels', isi: rels, simpan: true },
  { nama: 'xl/sharedStrings.xml', isi: ss },
  { nama: 'xl/worksheets/sheet1.xml', isi: sheet('<row r="1"><c r="A1"><v>juni</v></c></row>'), extraLokal: 9 },
  { nama: 'xl/worksheets/sheet7.xml', isi: s1 },
], 'komentar ZIP sebelum akhir')

// bacaBerkasTabel keeps the old rule: lowest sheetN.xml, whatever the tab order.
const t = await bacaBerkasTabel(berkas('pos.xlsx', xlsx))
cek('bacaBerkasTabel memakai sheet1.xml (aturan lama, bukan urutan tab)', sama(t, [{ A: 'juni' }]), JSON.stringify(t))

const l = await bacaBerkasLembar(berkas('qris.xlsx', xlsx))
cek('sharedStrings (termasuk rich text) terbaca', l[0]?.baris[0]?.A === 'Nama' && l[0]?.baris[1]?.A === 'Budi', JSON.stringify(l[0]))
cek('urutan & nama lembar dari workbook.xml, bukan nomor berkas',
  sama(l.map(x => x.nama), ['Juli26', 'Juni26']) && l[0].baris[0].D === '125000' && l[1].baris[0].A === 'juni', JSON.stringify(l))

// 3 fallback: no workbook.xml -> "Lembar N" in file-number order.
const tanpaWb = zip([
  { nama: 'xl/worksheets/sheet2.xml', isi: sheet('<row r="1"><c r="A1"><v>2</v></c></row>') },
  { nama: 'xl/worksheets/sheet10.xml', isi: sheet('<row r="1"><c r="A1"><v>10</v></c></row>') },
])
const lf = await bacaBerkasLembar(berkas('x.xlsx', tanpaWb))
cek('tanpa workbook.xml: "Lembar N" urut nomor (2 sebelum 10)', sama(lf.map(x => [x.nama, x.baris[0].A]), [['Lembar 1', '2'], ['Lembar 2', '10']]))

// A sheet named in the workbook but missing from the ZIP is skipped.
const hilang = zip([
  { nama: 'xl/workbook.xml', isi: wbBalik },
  { nama: 'xl/_rels/workbook.xml.rels', isi: rels },
  { nama: 'xl/worksheets/sheet1.xml', isi: sheet('<row r="1"><c r="A1"><v>ada</v></c></row>') },
])
const lh = await bacaBerkasLembar(berkas('x.xlsx', hilang))
cek('lembar yang hilang dilewati, sisanya tetap terbaca', sama(lh.map(x => x.nama), ['Juni26']))

let pesan = ''
try {
  await bacaBerkasTabel(berkas('bukan.xlsx', Buffer.from('bukan zip sama sekali')))
}
catch (e) {
  pesan = e.message
}
cek('bukan ZIP -> pesan jelas', /bukan \.xlsx/.test(pesan), pesan)

// 6: CSV.
cek('CSV titik-koma + kutip ganda', sama(uraiCsvBaris('Nama;Catatan\r\nBudi;"a;""b"""\n'), [{ A: 'Nama', B: 'Catatan' }, { A: 'Budi', B: 'a;"b"' }]))
cek('CSV koma, sel kosong tidak ditulis', sama(uraiCsvBaris('a,,c'), [{ A: 'a', C: 'c' }]))
const csv = await bacaBerkasLembar(berkas('Data.CSV', Buffer.from('x,y')))
cek('CSV di bacaBerkasLembar = satu lembar "CSV"', sama(csv, [{ nama: 'CSV', baris: [{ A: 'x', B: 'y' }] }]))

// 7: TSV width.
cek('barisKeTsv melebar ke kolom terjauh (AA)', barisKeTsv([{ A: '1', AA: 'z' }, { B: '2' }]).split('\n').every(r => r.split('\t').length === 27))

console.log(`\n${ok} OK, ${gagal} GAGAL\n`)
process.exit(gagal ? 1 : 0)
