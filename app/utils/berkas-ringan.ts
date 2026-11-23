// Proof uploads stored as data URIs inside the reservation row. Images are
// shrunk before saving — same as the old app's `downscaleImage(…, 1200, 0.7)`
// in deploy/reservasi/index.html:4570 — so a 6 MB phone photo lands as a
// ~150-300 KB JPEG instead of bloating every list read. PDFs pass through.

/** An image may be bigger than this only before shrinking; PDFs must stay under it. */
export const MAKS_BUKTI = 5 * 1024 * 1024
/** Raw photo limit: anything this big is shrunk, never rejected for size alone. */
export const MAKS_FOTO_MENTAH = 20 * 1024 * 1024

const MAKS_SISI = 1200
const MUTU = 0.7

export const adalahGambar = (f: File) => /^image\//.test(f.type || '')

/** Readable reason a file cannot be used as a proof, or '' when it is fine. */
export function tolakBukti(f: File): string {
  if (adalahGambar(f)) return f.size > MAKS_FOTO_MENTAH ? 'Foto terlalu besar (maks 20 MB)' : ''
  return f.size > MAKS_BUKTI ? 'File PDF terlalu besar (maks 5 MB)' : ''
}

const bacaMentah = (f: File): Promise<string> => new Promise((resolve, reject) => {
  const fr = new FileReader()
  fr.onload = () => resolve(String(fr.result))
  fr.onerror = () => reject(fr.error)
  fr.readAsDataURL(f)
})

function kecilkan(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let w = img.width
      let h = img.height
      if (w > MAKS_SISI || h > MAKS_SISI) {
        const s = Math.min(MAKS_SISI / w, MAKS_SISI / h)
        w = Math.round(w * s)
        h = Math.round(h * s)
      }
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d')
      if (!g) {
        resolve(dataUrl)
        return
      }
      // White under transparent PNGs, otherwise JPEG turns them black.
      g.fillStyle = '#fff'
      g.fillRect(0, 0, w, h)
      g.drawImage(img, 0, 0, w, h)
      try {
        const hasil = c.toDataURL('image/jpeg', MUTU)
        resolve(hasil.length < dataUrl.length ? hasil : dataUrl)
      }
      catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/** File → data URI to store: images shrunk to JPEG 1200px, other files as they are. */
export async function buktiKeDataUri(f: File): Promise<string> {
  const mentah = await bacaMentah(f)
  return adalahGambar(f) ? kecilkan(mentah) : mentah
}

/** Stored file name matching the converted content (photo.png → photo.jpg). */
export function namaBukti(f: File, dataUri: string): string {
  if (!dataUri.startsWith('data:image/jpeg') || /\.jpe?g$/i.test(f.name)) return f.name
  return f.name.replace(/\.[^.]+$/, '') + '.jpg'
}
