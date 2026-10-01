// Pure Absensi helpers — no API, no Vue. One place for the duration wording and
// for reading a coordinate out of a Google Maps link, so two screens cannot
// disagree.
//
// Source: laksamana-office/absensi/index.html:450-455 (durasi), :853-870
// (bacaKoordinat).

/** Minutes -> "1j 25m"; 0 -> "0m". The old durasi(), :450-455. */
export function durasi(n: number | null | undefined): string {
  const m = Math.max(0, Math.round(Number(n) || 0))
  if (m < 60) return `${m}m`
  const j = Math.floor(m / 60)
  const sisa = m % 60
  return `${j}j${sisa ? ` ${sisa}m` : ''}`
}

export interface Koordinat {
  lat: number
  lng: number
}

export interface KoordinatGalat {
  galat: string
}

export const isKoordinat = (v: Koordinat | KoordinatGalat): v is Koordinat => 'lat' in v

/**
 * "-0.5071, 101.4478", a Google Maps URL, or a `!3d…!4d…` link -> {lat, lng}.
 * A short `maps.app.goo.gl` link cannot be read (it has to be opened first) and
 * says so instead of failing silently. Mirrors bacaKoordinat(), :853-870.
 */
export function bacaKoordinat(teks: unknown): Koordinat | KoordinatGalat | null {
  const t = String(teks ?? '').trim()
  if (!t) return null
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(t)) {
    return { galat: 'Tautan pendek Google Maps tidak bisa dibaca. Buka dulu tautannya di peramban, lalu salin alamat panjang yang muncul.' }
  }
  // `!3d…!4d…` is the marked point; the `@` numbers are the screen centre.
  let m = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(t)
  if (!m) m = /[?&]q=(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/.exec(t)
  if (!m) m = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(t)
  if (!m) m = /^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/.exec(t)
  if (!m) return { galat: 'Tidak ketemu koordinat di teks itu. Tempel dua angka dipisah koma, atau tautan Google Maps yang panjang.' }
  const lat = Number.parseFloat(m[1]!)
  const lng = Number.parseFloat(m[2]!)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { galat: 'Koordinatnya bukan angka.' }
  if (lat < -90 || lat > 90) return { galat: 'Lintang harus antara -90 dan 90. Mungkin urutannya tertukar?' }
  if (lng < -180 || lng > 180) return { galat: 'Bujur harus antara -180 dan 180.' }
  return { lat, lng }
}

/** "-0.507100, 101.447800" — six decimals, like the old coordinate box (:848). */
export const teksKoordinat = (lat: number, lng: number) => `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`

/** A Google Maps link to a point, for the "Buka di Google Maps" link (no map embedded). */
export const tautanMaps = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
