// Hand-rolled QR encoder (byte mode, EC level M, versions 1–10), ported from
// the old client (deploy/event/index.html:1778-2021) so the code on screen is
// pixel-identical to the server PDFs. No dependency: tokens are short, and a
// library would only add weight for the same squares.
//
// The one modernisation: UTF-8 bytes via TextEncoder instead of
// unescape(encodeURIComponent()) — byte-identical output, no deprecated API.
const QR_M: Record<number, [number, number, number, number, number]> = {
  1: [10, 1, 16, 0, 0], 2: [16, 1, 28, 0, 0], 3: [26, 1, 44, 0, 0], 4: [18, 2, 32, 0, 0],
  5: [24, 2, 43, 0, 0], 6: [16, 4, 27, 0, 0], 7: [18, 4, 31, 0, 0], 8: [22, 2, 38, 2, 39],
  9: [22, 3, 36, 2, 37], 10: [26, 4, 43, 1, 44],
}
const QR_ALIGN: Record<number, number[]> = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
}

/** GF(256) tables for Reed-Solomon (polynomial 0x11d). */
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]!
}
const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!)

/** Generator polynomial for n EC codewords, highest degree first. */
function rsGen(n: number): number[] {
  let poly = [1]
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j]!, GF_EXP[i]!)
      next[j + 1] ^= poly[j]!
    }
    poly = next
  }
  return poly.reverse()
}
function rsEncode(data: number[], n: number): number[] {
  const gen = rsGen(n)
  const res = new Array(n).fill(0)
  for (const d of data) {
    const faktor = d ^ res[0]!
    res.shift()
    res.push(0)
    for (let j = 0; j < n; j++) res[j] ^= gfMul(gen[j + 1]!, faktor)
  }
  return res
}

/** Format & version info (BCH). Level M = 00, XORed with the standard mask. */
function bch(nilai: number, gen: number, bit: number): number {
  let v = nilai << (bit - 1)
  const panjang = (x: number) => {
    let n = 0
    while (x) {
      n++
      x >>>= 1
    }
    return n
  }
  while (panjang(v) >= panjang(gen)) v ^= gen << (panjang(v) - panjang(gen))
  return v
}
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask
  return ((data << 10) | bch(data, 0b10100110111, 11)) ^ 0b101010000010010
}
function versionBits(v: number): number {
  return (v << 12) | bch(v, 0b1111100100101, 13)
}

/** The 15 format-info cells, twice. Written once and shared by the placer and
 *  the writer below, so the two can never disagree. */
function formatSel(N: number): [number, number][] {
  const s: [number, number][] = []
  for (let i = 0; i <= 5; i++) s.push([i, 8])
  s.push([7, 8])
  s.push([8, 8])
  s.push([8, 7])
  for (let i = 9; i < 15; i++) s.push([8, 14 - i])
  for (let i = 0; i < 8; i++) s.push([8, N - 1 - i])
  for (let i = 8; i < 15; i++) s.push([N - 15 + i, 8])
  return s
}

/** Smallest version that fits, then the full matrix (1 = dark). */
export function qrMatrix(text: string): number[][] {
  const bytes = [...new TextEncoder().encode(text)]

  let ver = 0
  for (let v = 1; v <= 10; v++) {
    const [, b1, d1, b2, d2] = QR_M[v]!
    if (bytes.length + 2 <= b1 * d1 + b2 * d2) {
      ver = v
      break
    }
  }
  if (!ver) throw new Error('Teks terlalu panjang untuk QR versi 10 (maks ~210 karakter)')

  const [ecLen, b1, d1, b2, d2] = QR_M[ver]!
  const totalData = b1 * d1 + b2 * d2

  // Bit stream: mode 0100 + length + payload + terminator + pad.
  const bits: number[] = []
  const push = (nilai: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((nilai >> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, ver <= 9 ? 8 : 16)
  for (const b of bytes) push(b, 8)
  for (let i = 0; i < 4 && bits.length < totalData * 8; i++) bits.push(0)
  while (bits.length % 8) bits.push(0)
  const kata: number[] = []
  for (let i = 0; i < bits.length; i += 8) kata.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0))
  const isian = [0xec, 0x11]
  for (let i = 0; kata.length < totalData; i++) kata.push(isian[i % 2]!)

  // Split into blocks, Reed-Solomon each, then interleave.
  const blokData: number[][] = []
  const blokEc: number[][] = []
  let p = 0
  for (let i = 0; i < b1 + b2; i++) {
    const n = i < b1 ? d1 : d2
    const d = kata.slice(p, p + n)
    p += n
    blokData.push(d)
    blokEc.push(rsEncode(d, ecLen))
  }
  const akhir: number[] = []
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blokData) if (i < b.length) akhir.push(b[i]!)
  for (let i = 0; i < ecLen; i++) for (const b of blokEc) akhir.push(b[i]!)

  // Skeleton.
  const N = ver * 4 + 17
  const m: (number | null)[][] = Array.from({ length: N }, () => new Array(N).fill(null))
  const taruh = (r: number, c: number, v: number) => {
    if (r >= 0 && r < N && c >= 0 && c < N) m[r]![c] = v
  }
  const finder = (r: number, c: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = r + dr
        const cc = c + dc
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue
        const di = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        const hitam = di && ((dr === 0 || dr === 6 || dc === 0 || dc === 6) || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4))
        taruh(rr, cc, hitam ? 1 : 0)
      }
    }
  }
  finder(0, 0)
  finder(0, N - 7)
  finder(N - 7, 0)

  for (let i = 8; i < N - 8; i++) {
    const v = i % 2 === 0 ? 1 : 0
    taruh(6, i, v)
    taruh(i, 6, v)
  }

  for (const r of QR_ALIGN[ver]!) {
    for (const c of QR_ALIGN[ver]!) {
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= N - 9) || (r >= N - 9 && c <= 8)) continue
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) taruh(r + dr, c + dc, (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0)
      }
    }
  }
  taruh(N - 8, 8, 1)

  // Format-info cells are reserved first so data never claims them.
  const selFmt = formatSel(N)
  for (const [r, c] of selFmt) if (m[r]![c] === null) m[r]![c] = 0

  if (ver >= 7) {
    const vb = versionBits(ver)
    for (let i = 0; i < 18; i++) {
      const bit = (vb >> i) & 1
      taruh(Math.floor(i / 3), N - 11 + (i % 3), bit)
      taruh(N - 11 + (i % 3), Math.floor(i / 3), bit)
    }
  }

  // Data zig-zag from the bottom right.
  const kosong = m.map(baris => baris.map(v => v === null))
  let bitIdx = 0
  let naik = true
  const ambilBit = () => {
    const byte = akhir[bitIdx >> 3]
    const b = byte === undefined ? 0 : (byte >> (7 - (bitIdx & 7))) & 1
    bitIdx++
    return b
  }
  for (let col = N - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let i = 0; i < N; i++) {
      const row = naik ? N - 1 - i : i
      for (const c of [col, col - 1]) if (kosong[row]![c]) m[row]![c] = ambilBit()
    }
    naik = !naik
  }

  // The mask with the smallest penalty wins.
  const rumus = [
    (r: number, c: number) => (r + c) % 2 === 0,
    (r: number, _c: number) => r % 2 === 0,
    (r: number, c: number) => c % 3 === 0,
    (r: number, c: number) => (r + c) % 3 === 0,
    (r: number, c: number) => (((r >> 1) + Math.floor(c / 3)) % 2) === 0,
    (r: number, c: number) => ((r * c) % 2 + (r * c) % 3) === 0,
    (r: number, c: number) => (((r * c) % 2 + (r * c) % 3) % 2) === 0,
    (r: number, c: number) => (((r + c) % 2 + (r * c) % 3) % 2) === 0,
  ]
  let terbaik: (number | null)[][] | null = null
  let dendaMin = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const uji = m.map(b => b.slice())
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) if (kosong[r]![c] && rumus[mask]!(r, c)) uji[r]![c]! ^= 1
    }
    const fb = formatBits(mask)
    selFmt.forEach(([r, c], i) => {
      uji[r]![c] = (fb >> (i % 15)) & 1
    })
    uji[N - 8]![8] = 1
    const d = denda(uji, N)
    if (d < dendaMin) {
      dendaMin = d
      terbaik = uji
    }
  }
  return terbaik as number[][]
}

// Standard penalty: same-colour runs, 2×2 blocks, finder-like patterns, imbalance.
function denda(m: (number | null)[][], N: number): number {
  let s = 0
  for (let r = 0; r < N; r++) {
    for (let arah = 0; arah < 2; arah++) {
      let run = 1
      for (let i = 1; i < N; i++) {
        const a = arah ? m[i - 1]![r] : m[r]![i - 1]
        const b = arah ? m[i]![r] : m[r]![i]
        if (a === b) {
          run++
          if (run === 5) s += 3
          else if (run > 5) s++
        }
        else run = 1
      }
    }
  }
  for (let r = 0; r < N - 1; r++) {
    for (let c = 0; c < N - 1; c++) {
      if (m[r]![c] === m[r]![c + 1] && m[r]![c] === m[r + 1]![c] && m[r]![c] === m[r + 1]![c + 1]) s += 3
    }
  }
  const pola = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
  const polaR = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]
  for (let r = 0; r < N; r++) {
    for (let c = 0; c <= N - 11; c++) {
      let cocok1 = true
      let cocok2 = true
      let cocok3 = true
      let cocok4 = true
      for (let i = 0; i < 11; i++) {
        if (m[r]![c + i] !== pola[i]) cocok1 = false
        if (m[r]![c + i] !== polaR[i]) cocok2 = false
        if (m[c + i]![r] !== pola[i]) cocok3 = false
        if (m[c + i]![r] !== polaR[i]) cocok4 = false
      }
      if (cocok1) s += 40
      if (cocok2) s += 40
      if (cocok3) s += 40
      if (cocok4) s += 40
    }
  }
  let hitam = 0
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) hitam += m[r]![c]!
  s += Math.floor(Math.abs(hitam * 100 / (N * N) - 50) / 5) * 10
  return s
}

/** Render-ready SVG, pasteable into a page. */
export function qrSvg(text: string, ukuran = 200): string {
  const m = qrMatrix(text)
  const N = m.length
  const tepi = 4
  const total = N + tepi * 2
  const px = (ukuran || 200) / total
  let kotak = ''
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (m[r]![c]) {
        kotak += `<rect x="${((c + tepi) * px).toFixed(2)}" y="${((r + tepi) * px).toFixed(2)}" width="${px.toFixed(2)}" height="${px.toFixed(2)}"/>`
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ukuran || 200}" height="${ukuran || 200}" viewBox="0 0 ${ukuran || 200} ${ukuran || 200}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${kotak}</g></svg>`
}
