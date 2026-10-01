// The status map of Akademi — one source for every pill's colour, icon and word
// (DESIGN.md rule 4/5). Screens import these, they never build the map inline.
//
// Source: badge classes in laksamana-office/deploy/akademi/index.html:311-315
// (TYPES), :1463-1466 (program status), :1176 (crew status), :1156-1158 (wajib).
import type { StatKru } from '~/utils/akademi-hitung'
import type { TipeMateri } from '~/composables/useAkademi'
import { LABEL_TIPE } from '~/utils/akademi-konstanta'

export interface StatusTampil {
  label: string
  icon: string
  tone: 'success' | 'warning' | 'error' | 'info' | 'vip' | 'neutral' | 'gold'
}

/**
 * Material type pills. The old classes were b-info (video), b-gold (modul),
 * b-ink (sop), b-warn (menu), b-ok (quiz); b-ink becomes `neutral` here.
 */
export const STATUS_TIPE: Record<TipeMateri, StatusTampil> = {
  video: { label: 'Video', icon: 'i-lucide-clapperboard', tone: 'info' },
  modul: { label: 'Modul', icon: 'i-lucide-book-open', tone: 'gold' },
  sop: { label: 'SOP', icon: 'i-lucide-clipboard-list', tone: 'neutral' },
  menu: { label: 'Menu Baru', icon: 'i-lucide-utensils', tone: 'warning' },
  quiz: { label: 'Kuis', icon: 'i-lucide-circle-help', tone: 'success' },
}

export const statusTipe = (t: TipeMateri): StatusTampil => STATUS_TIPE[t] ?? { label: LABEL_TIPE[t] ?? t, icon: 'i-lucide-file', tone: 'neutral' }

/** The status pill of a monthly program (`:1463-1466`), in the old priority order. */
export function statusProgram(p: { total: number, pct: number, over: boolean, isCur: boolean }): StatusTampil {
  if (p.total === 0) return { label: 'Tidak ada item divisimu', icon: 'i-lucide-minus', tone: 'neutral' }
  if (p.pct === 100) return { label: 'Tuntas', icon: 'i-lucide-circle-check', tone: 'success' }
  if (p.over) return { label: 'Lewat deadline, segera selesaikan', icon: 'i-lucide-alarm-clock', tone: 'error' }
  if (p.isCur) return { label: 'Berjalan', icon: 'i-lucide-play', tone: 'gold' }
  return { label: 'Arsip', icon: 'i-lucide-archive', tone: 'neutral' }
}

/** The crew status of Progress Tim (`:1176`). */
export function statusKru(st: Pick<StatKru, 'certified' | 'mandTotal' | 'mandPct'>): StatusTampil {
  if (st.certified) return { label: 'Tersertifikasi', icon: 'i-lucide-medal', tone: 'success' }
  if (st.mandPct >= 50) return { label: 'Proses', icon: 'i-lucide-hourglass', tone: 'warning' }
  return { label: 'Perlu didorong', icon: 'i-lucide-trending-down', tone: 'error' }
}

/** Mandatory material done / not yet (`:1156-1158`). */
export function statusWajib(done: boolean): StatusTampil {
  return done
    ? { label: 'Selesai', icon: 'i-lucide-circle-check', tone: 'success' }
    : { label: 'Belum', icon: 'i-lucide-clock', tone: 'warning' }
}

/** A material row's own done / not yet pill on the crew tables. */
export function statusSelesai(done: boolean): StatusTampil {
  return done
    ? { label: 'Selesai', icon: 'i-lucide-circle-check', tone: 'success' }
    : { label: 'Belum', icon: 'i-lucide-circle', tone: 'neutral' }
}

/** Publish state of a material in Kelola Materi (`:1258`). */
export function statusTerbit(published: boolean): StatusTampil {
  return published
    ? { label: 'Terbit', icon: 'i-lucide-eye', tone: 'success' }
    : { label: 'Draft', icon: 'i-lucide-eye-off', tone: 'neutral' }
}

/** The certification chip on Beranda / Sertifikat. */
export function statusSertifikasi(certified: boolean): StatusTampil {
  return certified
    ? { label: 'Tersertifikasi', icon: 'i-lucide-medal', tone: 'success' }
    : { label: 'Belum Sertifikasi', icon: 'i-lucide-hourglass', tone: 'warning' }
}
