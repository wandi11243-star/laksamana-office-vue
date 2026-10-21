// Service Excellent — the second Panel of the same Backend (module key
// `service_excellent`, same /api/v1/reservasi routes and the same master blob as
// the Reservasi Panel). It owns the master sections `reviews`, `reviewCfg`,
// `feedbacks`, `seCrew` and `sePerms`, so the transport lives in
// useReservasi.ts and this file only adds the types of its own records plus the
// reads its screens need. Nothing is copied from useReservasi.ts.
//
// The waiting list is shared state in `master.waitlist`; it has no Service
// Excellent screen of its own.

/** `status` of a Google Review claim. Only "terverifikasi" counts towards a target. */
export type StatusReview = 'diminta' | 'diklaim' | 'terverifikasi' | 'ditolak'

/** One review claim. `proofData` is foto 1 (required at claim), `proof2Data` foto 2 (required before verifying). */
export interface Review {
  id: string
  resId: string
  name: string
  phone: string
  reviewerName: string
  /** The host the points go to. Taken from the token on first claim, kept on edit. */
  host: string
  tableNo: string
  date: string
  status: StatusReview
  rating?: number
  proofData: string
  proofName: string
  proof2Data: string
  proof2Name: string
  by: string
  at: number
  /** When the invitation went out. Old notes lack it and fall back to `at`. */
  askedAt?: number
  askedBy?: string
  claimedBy: string
  claimedAt: number
  verifiedBy: string
  verifiedAt: number
  rejectNote: string
}

/** One thing the guest said, with the division it belongs to. */
export interface FeedbackItem {
  cat: FeedbackKategori
  catOther: string
  text: string
}

/** The seven divisions the old client used (FB_CATS), `other` needing `catOther`. */
export type FeedbackKategori = 'bar' | 'kitchen' | 'floor' | 'kasir' | 'hygiene' | 'system' | 'other'

export interface Feedback {
  id: string
  resId: string
  name: string
  phone: string
  date: string
  tone: 'negatif' | 'positif'
  items: FeedbackItem[]
  status: 'baru' | 'proses' | 'selesai'
  actionNote: string
  proofData: string
  proofName: string
  by: string
  at: number
  handledBy: string
  handledAt: number
}

/** One reward step: reach `rv` verified reviews, get `bonus`. Paid as the highest step passed, never summed. */
export interface RewardTier {
  rv: number
  bonus: number
}

/** `master.reviewCfg`. */
export interface ReviewCfg {
  /** The Google review link sent to guests. Required for a "diminta" note. */
  link: string
  /** Global WhatsApp switch. A record without the key counts as on (old data has no key at all). */
  waAktif?: boolean
  /** Accumulated monthly team target. Not the sum of the per-person targets. */
  target: number
  /** Per-person monthly target, by host name. The team target is read from these elsewhere, not from `target`. */
  targets: Record<string, number>
  /** `{"YYYY-MM": {start, end}}` — reviews counted in Google at the start and end of the month. */
  counts: Record<string, { start?: number, end?: number }>
  reward: { min: number, tiers: RewardTier[] }
}

/** One Service Excellent crew member. Roles are the module's own three levels, not Reservasi's six. */
export interface SeKru {
  id: string
  name: string
  divisi: string
  role: 'staff' | 'manager' | 'admin'
  /** Set only by a human picking the level: `staff` from a roster sync and `staff` picked here look identical without it. */
  roleSetAt?: number
  roleSetBy?: string
}

/** `master.sePerms` — the module's own matrix; it is NOT the same object as Reservasi's `perms`. */
export type SePerms = Record<string, Record<string, 0 | 1 | 2>>

// ---------------------------------------------------------------- reads

export const getReviews = () => getSection<Review[]>('reviews')
export const getFeedbacks = () => getSection<Feedback[]>('feedbacks')
export const getReviewCfg = () => getSection<ReviewCfg>('reviewCfg')
export const getSeCrew = () => getSection<SeKru[]>('seCrew')
export const getSePerms = () => getSection<SePerms>('sePerms')

export const useReviews = () => useAsyncData('se-reviews', () => getReviews().then(r => r.data), { dedupe: 'defer', default: () => [] })
export const useFeedbacks = () => useAsyncData('se-feedbacks', () => getFeedbacks().then(r => r.data), { dedupe: 'defer', default: () => [] })
export const useReviewCfg = () => useAsyncData('se-reviewcfg', () => getReviewCfg().then(r => r.data), { dedupe: 'defer', default: () => undefined })
export const useSeCrew = () => useAsyncData('se-crew', () => getSeCrew().then(r => r.data), { dedupe: 'defer', default: () => [] })
export const useSePerms = () => useAsyncData('se-perms', () => getSePerms().then(r => r.data), { dedupe: 'defer', default: () => undefined })

/** The module's own level per person: staff, manager or admin. */
export type SeTingkat = SeKru['role']

/** The two inputs of the in-module matrix (`master.seCrew` + `master.sePerms`). */
export interface PeranSE {
  crew: SeKru[]
  perms: SePerms | null
}

/** The loaded matrix, shared by every screen's `Layar.boleh`. */
export const usePeranSE = () => useState<PeranSE>('se-peran', () => ({ crew: [], perms: null }))

// ---------------------------------------------------------------- period
// Harian / Mingguan / Bulanan, shared by capaian, review and feedback: every
// number on one screen answers the same time (`:7853-7860`).

export type ModePeriodeReview = 'hari' | 'minggu' | 'bulan'

export interface PeriodeReview {
  mode: ModePeriodeReview
  date: string
  month: string
}

export const usePeriodeReview = () => useState<PeriodeReview>('se-periode', () => ({
  mode: 'bulan',
  date: hariIni(),
  month: hariIni().slice(0, 7),
}))

/** Load `master.seCrew` and `master.sePerms` once, on the module home. */
export const muatPeranSE = () => {
  const state = usePeranSE()
  const { data: crew } = useSeCrew()
  const { data: perms } = useSePerms()
  watchEffect(() => {
    state.value = { crew: crew.value ?? [], perms: perms.value ?? null }
  })
  return state
}

// ---------------------------------------------------------------- writes
// Every write is versioned with the section version, same rules as Reservasi
// (fondasi F1). `putSectionItem` and `deleteSectionItem` come from useReservasi.ts.

export const putReviewCfg = (cfg: ReviewCfg, versi?: Versi) => putSection('reviewCfg', cfg, versi)
export const putSeCrew = (crew: SeKru[], versi?: Versi) => putSection('seCrew', crew, versi)
export const putSePerms = (perms: SePerms, versi?: Versi) => putSection('sePerms', perms, versi)

export const putReview = (id: string, rv: Review, versi?: Versi) => putSectionItem('reviews', id, rv, versi)
export const putFeedback = (id: string, fb: Feedback, versi?: Versi) => putSectionItem('feedbacks', id, fb, versi)
