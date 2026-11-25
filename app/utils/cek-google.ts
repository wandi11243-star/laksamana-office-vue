// "Cek Google": match each review claim against the Google reviews the server
// holds. The result is a SUGGESTION stored on the claim (`rv.googleCek`);
// verifying stays a person's decision.
// Same rules as the old page (deploy/service_excellent rvgCocokDengan,
// rvgTerapkan, rvgDipakai). Pure: tested by tools/uji-cek-google.mjs.
import type { GoogleCandidate, GoogleCek, Review } from '~/composables/useServiceExcellent'

/** Only reviews of the last 30 days are matched; older claims are checked by hand. */
export const HARI_CEK_GOOGLE = 30

const norm = (s: string) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
/** The WIB date of a Google timestamp. */
export const tanggalWib = (ms: number) => new Date(Number(ms) + 7 * 3600000).toISOString().slice(0, 10)
export const geserTanggal = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** One claim against the candidates. A review may be at most one day older than the claim. */
export function cocokGoogle(rv: Pick<Review, 'reviewerName' | 'date'>, list: GoogleCandidate[], dari: string): Omit<GoogleCek, 'lemah' | 'syncAt' | 'at' | 'by'> {
  const nama = norm(rv.reviewerName)
  if (!nama) return { jenis: 'tanpaNama' }
  if (rv.date && rv.date < dari) return { jenis: 'luar' }
  const kandidat = list.filter(g => !rv.date || tanggalWib(g.waktu_ms) >= geserTanggal(rv.date, -1))
  // Crew often type the guest's Gmail. Google never shows an author's email, so
  // it can only be "similar": the author's name found inside the local part.
  const email = rv.reviewerName.includes('@')
  const lokal = email ? rv.reviewerName.split('@')[0]!.toLowerCase().normalize('NFKD').replace(/[^a-z]+/g, '') : ''
  const sama = email ? [] : kandidat.filter(g => norm(g.penulis) === nama)
  const kataNama = nama.split(' ').filter(w => w.length >= 3)
  const mirip = sama.length
    ? []
    : kandidat.filter((g) => {
        const penulis = norm(g.penulis)
        if (!penulis) return false
        if (email) {
          const rapat = penulis.replace(/ /g, '')
          const kata = penulis.split(' ').filter(w => w.length >= 3)
          return lokal.length >= 4 && ((rapat.length >= 5 && lokal.includes(rapat)) || (kata.length >= 2 && kata.every(w => lokal.includes(w))))
        }
        return kataNama.length > 0 && kataNama.every(w => penulis.split(' ').some(x => x === w || (w.length >= 4 && x.startsWith(w))))
      })
  const g = sama[0] || mirip[0]
  if (!g) return { jenis: 'tidak' }
  return {
    jenis: sama.length ? 'cocok' : 'mirip',
    id: g.id,
    penulis: g.penulis || '',
    rating: Number(g.rating) || 0,
    tgl: tanggalWib(g.waktu_ms),
    teks: (g.teks || '').slice(0, 160),
    url: g.url || '',
    tempat: g.tnama || '',
    lain: (sama.length || mirip.length) - 1,
  }
}

/** What a result says, without when and who: key order and gaps do not matter. */
const sidik = (c: Partial<GoogleCek>, denganSync: boolean) => JSON.stringify(Object.entries(c)
  .filter(([k, v]) => v !== undefined && v !== null && k !== 'at' && k !== 'by' && (denganSync || k !== 'syncAt'))
  .sort(([a], [b]) => a.localeCompare(b)))

/**
 * Put the results on the claims still waiting for verification. A decided claim
 * is never touched, and "outside the window" never replaces a match found
 * earlier. `denganSync` (the manual re-check) also rewrites a claim whose only
 * news is a newer Google sync; the automatic check does not, so opening the
 * page does not bump the list's version for nothing.
 */
export function terapkanCekGoogle(
  daftar: Review[],
  data: { review: GoogleCandidate[], sumber: string[], syncAt: number },
  opsi: { hariIni: string, oleh: string, kini: number, denganSync?: boolean },
): { next: Review[], jumlah: number } {
  const dari = geserTanggal(opsi.hariIni, -HARI_CEK_GOOGLE)
  const lemah = !data.sumber.includes('gbp')
  let jumlah = 0
  const next = daftar.map((rv) => {
    if (rv.status !== 'diklaim') return rv
    const hasil = cocokGoogle(rv, data.review, dari)
    if (hasil.jenis === 'luar' && ['cocok', 'mirip'].includes(rv.googleCek?.jenis || '')) return rv
    const baru = { ...hasil, lemah, syncAt: Number(data.syncAt) || 0 }
    if (rv.googleCek && sidik(rv.googleCek, !!opsi.denganSync) === sidik(baru, !!opsi.denganSync)) return rv
    jumlah++
    return { ...rv, googleCek: { ...baru, at: opsi.kini, by: opsi.oleh } }
  })
  return { next, jumlah }
}

/** Another live claim already holding this Google review: one review proves one claim. Computed on read. */
export function googleDipakai(daftar: Review[], rv: Review): Review | undefined {
  const id = rv.googleCek?.id
  if (!id) return undefined
  return daftar.find(x => x.id !== rv.id && ['diklaim', 'terverifikasi'].includes(x.status)
    && (x.googleReviewId === id || (x.googleCek?.jenis === 'cocok' && x.googleCek.id === id)))
}

/** The filter bucket of a waiting claim. */
export type KelompokCek = 'cocok' | 'mirip' | 'tidak' | 'manual'
export function kelompokCek(rv: Review): KelompokCek {
  const j = rv.googleCek?.jenis
  return j === 'cocok' || j === 'mirip' || j === 'tidak' ? j : 'manual'
}
