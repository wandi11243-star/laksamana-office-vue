// Google Review — the Campaign Analytics panel (`#greview`,
// deploy/konten/analytics/index.html, 17 Okt 2026).
//
// Reads and writes use the v1 Campaign Analytics API.
//
// Priority is COMPUTED here (`skorPrioritas`), never stored — the weights can
// be retuned without touching data, and the newest AI flags join in at once.

/** Load state of the Google Review screen. */
export type StatusMuatGreview = 'idle' | 'muat' | 'ok' | 'galat'

export type SumberReview = 'gbp' | 'places'

/** One guest review, as the planned `GET /konten/analytics/google` returns it. */
export interface ReviewGoogle {
  id: string
  sumber: SumberReview
  tempatId: string
  penulis: string
  foto: string
  rating: number
  teks: string
  waktuMs: number
  url: string
  balasan: string | null
  balasanAt: number
  balasanOleh: string
  ditangani: number
  tanganiCatatan: string | null
  tanganiOleh: string
  tanganiAt: number
  /** Derived (never stored): `skorPrioritas` + `tingkatPrioritas`. */
  skor?: number
  tingkat?: '' | 'segera' | 'tinggi' | 'sedang'
}

export interface TempatGoogle {
  id: string
  sumber: SumberReview
  nama: string
  alamat: string
  rating: number | null
  total: number | null
  url: string
  aktif: number
  syncAt: number
  galat: string
}

export interface GoogleReviewData {
  tempat: TempatGoogle[]
  review: ReviewGoogle[]
  totalTersimpan: number
  syncAt: number
  galat: string
  akun?: { nama?: string, terhubung: boolean } | null
  ai?: AnalisaGoogle | null
}

export interface AnalisaGoogle {
  ringkasan: string
  sentimen: Record<string, number> | null
  kekuatan: { tema: string, penjelasan: string }[]
  perbaikan: { area: string, masalah: string, prioritas: string, saran: string }[]
  tangani: { id: string, urgensi: string, alasan: string, tindakan: string }[]
}

export type SaringGreview = 'tangani' | 'segera' | 'belum' | 'rendah' | 'dibalas' | 'selesai' | 'semua'

/** Priority score (`grSkor`): low stars weigh most, then long complaints
 * ("guests who complain a lot"), then recency, then AI flags. Replied ones
 * drop a little — the guest got a public answer, but the inside follow-up
 * may not be done. Handled ones (`ditangani`) score 0 and leave the queue. */
export function skorPrioritas(r: Pick<ReviewGoogle, 'ditangani' | 'rating' | 'teks' | 'waktuMs' | 'balasan'>, aiUrgensi?: string): number {
  if (Number(r.ditangani) === 1) return 0
  const bobot: Record<number, number> = { 1: 100, 2: 80, 3: 50, 4: 12, 5: 0 }
  const dasar = bobot[Math.round(Number(r.rating))] ?? 0
  if (!dasar && !aiUrgensi) return 0
  const umurHari = r.waktuMs ? (Date.now() - Number(r.waktuMs)) / 86400e3 : 999
  const s = dasar + Math.min(25, String(r.teks || '').length / 30)
    + (umurHari <= 3 ? 25 : umurHari <= 7 ? 15 : umurHari <= 30 ? 5 : 0)
    + ({ segera: 40, tinggi: 25, sedang: 10 }[String(aiUrgensi || '')] || 0)
    - (r.balasan ? 20 : 0)
  return Math.max(0, Math.round(s))
}

/** Score band (`grTingkat`). */
export function tingkatPrioritas(skor: number): '' | 'segera' | 'tinggi' | 'sedang' {
  return skor >= 110 ? 'segera' : skor >= 75 ? 'tinggi' : skor >= 40 ? 'sedang' : ''
}

export const LABEL_TINGKAT_GREVIEW: Record<string, string> = { segera: 'Segera', tinggi: 'Tinggi', sedang: 'Sedang' }

/** Official reservation number inserted in public Google replies (mirrors `GR_NOMOR_RESERVASI`). */
export const NOMOR_RESERVASI_GREVIEW = '0856-5839-2519'

const POLA_HP_GREVIEW = /\(?(?:\+62|62|0)\)?[\s.()-]?8(?:[\s.()-]{0,2}\d){8,12}/g

/** Replace any Indonesian mobile number in a draft with the official one. */
export function nomorResmiGreview(teks: string): string {
  if (!teks) return teks
  return teks.replace(POLA_HP_GREVIEW, NOMOR_RESERVASI_GREVIEW)
}

/** Read saved reviews and their latest analysis. */
export const getGoogleReview = () =>
  useApi()<Envelope<Omit<GoogleReviewData, 'review'> & { review: (ReviewGoogle & { tempat_id?: string, waktu_ms?: number, balasan_at?: number, balasan_oleh?: string })[] }>>('/konten/analytics/google')

/** Synchronize configured review sources. */
export const sinkronGoogleReview = () =>
  useApi()<Envelope<{ jumlah: number, galat: string[] }>>('/konten/analytics/google/sync', { method: 'POST' })

/**
 * Send a reply to Google. The reply goes PUBLIC on Google Maps under the
 * business name, so the caller confirms with the guest's name in the
 * question — a content-free OK trains people to press OK.
 */
export const balasGoogleReview = (id: string, teks: string) =>
  useApi()<Envelope<{ at: number }>>('/konten/analytics/google/reply', { method: 'POST', body: { id, teks } })

/** Mark a review handled (or reopen it), with an optional follow-up note. */
export const tanganiGoogleReview = (id: string, ditangani: boolean, catatan: string) =>
  useApi()<unknown>('/konten/analytics/google/flag', { method: 'POST', body: { id, ditangani, catatan } })

/**
 * Shared loader for the screen: `idle` (never tried) → `muat` → `ok`/`galat`
 * + Coba lagi. A missing endpoint reads as "Segera" (G-24), not a raw error.
 */
export function useGoogleReviewState() {
  const status = ref<StatusMuatGreview>('idle')
  const data = ref<GoogleReviewData | null>(null)
  const galat = ref('')
  const sinkronJalan = ref(false)

  async function muat() {
    status.value = 'muat'
    galat.value = ''
    try {
      const r = await getGoogleReview()
      data.value = {
        ...r.data,
        review: (r.data.review || []).map((x) => {
          const review = { ...x, tempatId: x.tempat_id ?? x.tempatId, waktuMs: Number(x.waktu_ms ?? x.waktuMs), balasanAt: Number(x.balasan_at ?? x.balasanAt ?? 0), balasanOleh: x.balasan_oleh ?? x.balasanOleh }
          const skor = skorPrioritas(review, r.data.ai?.tangani.find(t => t.id === x.id)?.urgensi)
          return { ...review, skor, tingkat: tingkatPrioritas(skor) }
        }),
      }
      status.value = 'ok'
    }
    catch (e) {
      galat.value = apiErrorMessage(e)
      status.value = 'galat'
    }
  }

  async function sinkronkan() {
    sinkronJalan.value = true
    try {
      await sinkronGoogleReview()
      await muat()
      return true
    }
    catch (e) {
      galat.value = apiErrorMessage(e)
      status.value = 'galat'
      return false
    }
    finally {
      sinkronJalan.value = false
    }
  }

  return { status, data, galat, sinkronJalan, muat, sinkronkan }
}
