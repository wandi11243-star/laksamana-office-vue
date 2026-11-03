// BD inbox notifications — computed from data, never a table (LM Agenda,
// 30 Okt 2026). A copied notification can disagree with the board (an invite
// deleted but still "inviting"); a computed one is always the board's truth.
//
// What is stored is only the READ MARK, in the browser (localStorage, per
// account): the screen state of the reader, not team data — so it never
// travels devices, and the screen says so.
import type { BdAgenda, BdPerson, BdTask } from '~/composables/useBd'
import { menungguReviewSaya, pelaksana, pics, reviewers } from '~/utils/bd-rumus'
import { fTglP, ymdLokal } from '~/utils/format'

/** Notifications older than this are not shown. */
export const NOTIF_HARI = 45

export interface BdNotif {
  /** Stable identity: kind + row + the stamp that made it new. */
  k: string
  /** ms epoch, for sorting, the 45-day cut and read-state. */
  at: number
  /** Lucide icon name. */
  icon: string
  /** Plain words (the UI bolds names/titles itself). */
  teks: string
  /** Where a tap goes: `ag:<id>` or `t:<id>`. */
  buka: string
}

const nama = (people: BdPerson[], id?: string | null) => {
  const p = people.find(x => x.id === id)
  return p ? String(p.name).split(' ')[0] : '—'
}

/**
 * `notifBd` — every notification for one crew member: agenda invites (and
 * schedule changes), answers on my agendas, new assignments, new reviewer
 * tags, tasks waiting on my review, and review verdicts on my tasks.
 */
export function notifBd(
  agenda: BdAgenda[],
  tasks: BdTask[],
  people: BdPerson[],
  akuId?: string | null,
  sekarang = Date.now(),
): BdNotif[] {
  if (!akuId) return []
  const out: BdNotif[] = []
  const batas = sekarang - NOTIF_HARI * 86400000
  for (const e of agenda) {
    const pes = Array.isArray(e.peserta) ? e.peserta : []
    const un = (e.undang || {})[akuId]
    if (e.owner && e.owner !== akuId && pes.includes(akuId)) {
      const at = (un && un.at) || e.createdAt || 0
      out.push({
        k: `ag:${e.id}:${at}`,
        at,
        icon: 'i-lucide-calendar-days',
        teks: `${nama(people, e.owner)} ${un?.ubah ? 'mengubah jadwal' : 'mengundangmu ke'} agenda ${e.title}`,
        buka: `ag:${e.id}`,
      })
    }
    if (e.owner === akuId) {
      for (const [id, jawab] of Object.entries(e.resp || {})) {
        if (!jawab || id === akuId || !pes.includes(id)) continue
        const kata = jawab === 'hadir' ? 'menerima' : jawab === 'mungkin' ? 'menjawab "mungkin" untuk' : 'menolak'
        out.push({
          k: `agr:${e.id}:${id}:${jawab}`,
          at: e.updatedAt || 0,
          icon: 'i-lucide-users',
          teks: `${nama(people, id)} ${kata} undangan ${e.title}`,
          buka: `ag:${e.id}`,
        })
      }
    }
  }
  for (const t of tasks) {
    const to = (t.tugasOleh || {})[akuId]
    if (to && to.by !== akuId && pics(t).includes(akuId)) {
      out.push({
        k: `tg:${t.id}:${to.at}`,
        at: to.at,
        icon: 'i-lucide-check',
        teks: `${nama(people, to.by)} menugaskan task ${t.name} kepadamu${t.deadline ? ` · deadline ${fTglP(t.deadline)}` : ''}`,
        buka: `t:${t.id}`,
      })
    }
    const ro = (t.reviewOleh || {})[akuId]
    if (ro && ro.by !== akuId && reviewers(t).includes(akuId)) {
      out.push({
        k: `rt:${t.id}:${ro.at}`,
        at: ro.at,
        icon: 'i-lucide-eye',
        teks: `${nama(people, ro.by)} menandaimu sebagai reviewer task ${t.name}`,
        buka: `t:${t.id}`,
      })
    }
    if (t.status === 'Review' && reviewers(t).includes(akuId)) {
      const ra = t.reviewAt || t.updatedAt || 0
      out.push({
        k: `rv:${t.id}:${ra}`,
        at: ra,
        icon: 'i-lucide-eye',
        teks: `Task ${t.name} dari ${pics(t).map(id => nama(people, id)).join(', ') || '—'} menunggu review kamu`,
        buka: `t:${t.id}`,
      })
    }
    const h = t.reviewHasil
    if (h && h.by !== akuId && pelaksana(t).includes(akuId)) {
      out.push({
        k: `rh:${t.id}:${h.at || 0}`,
        at: h.at || 0,
        icon: h.s === 'ok' ? 'i-lucide-check' : 'i-lucide-undo-2',
        teks: `${nama(people, h.by)} ${h.s === 'ok' ? 'menyetujui' : 'mengembalikan'} task ${t.name}${h.catatan ? `: “${h.catatan}”` : ''}`,
        buka: `t:${t.id}`,
      })
    }
  }
  return out.filter(n => n.at >= batas).sort((a, b) => b.at - a.at)
}

/** `agendaku` — agendas I organise that still invite people (the "Undangan saya" tab). */
export function agendaku(daftar: BdAgenda[], akuId?: string | null): BdAgenda[] {
  if (!akuId) return []
  return daftar
    .filter(e => e.owner === akuId && (e.peserta || []).length)
    .sort((a, b) => (`${a.date}${a.start || ''}` < `${b.date}${b.start || ''}` ? -1 : 1))
}

// ---------------------------------------------------------------- read marks

export interface BacaNotif { all: number, k: Record<string, 1> }

/** Storage key: per account (`catIniAku`), so two crew on one device keep
 *  their own marks — and marks never leave the device. */
export const kunciBacaNotif = (kunciAkun: string) => `bd_notif_baca:${kunciAkun}`

export function bacaStateNotif(kunci: string): BacaNotif {
  try {
    const s = JSON.parse(localStorage.getItem(kunci) || 'null')
    if (s && typeof s === 'object' && s.k && typeof s.k === 'object') {
      return { all: typeof s.all === 'number' ? s.all : 0, k: s.k }
    }
  }
  catch { /* a foreign value never blocks the inbox */ }
  return { all: 0, k: {} }
}

export function tulisStateNotif(kunci: string, s: BacaNotif): void {
  try {
    const ks = Object.keys(s.k)
    if (ks.length > 600) ks.slice(0, ks.length - 600).forEach(k => delete s.k[k])
    localStorage.setItem(kunci, JSON.stringify(s))
  }
  catch { /* private mode: the list still works, marks just don't stick */ }
}

export const sudahDibacaNotif = (n: BdNotif, s: BacaNotif) => !!s.k[n.k] || n.at <= s.all

export const jumlahBelumDibacaNotif = (daftar: BdNotif[], s: BacaNotif) =>
  daftar.filter(n => !sudahDibacaNotif(n, s)).length

/** "Hari ini · 14:30" / "Kemarin · 09:00" / "Sab, 1 Nov 2026 · 10:00". */
export function fWaktuNotif(ms?: number | null): string {
  if (!ms) return ''
  const d = new Date(ms)
  const iso = ymdLokal(d)
  const jam = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const hari = new Date()
  hari.setHours(0, 0, 0, 0)
  const t = new Date(d)
  t.setHours(0, 0, 0, 0)
  const selisih = Math.round((+hari - +t) / 86400000)
  if (selisih === 0) return `Hari ini · ${jam}`
  if (selisih === 1) return `Kemarin · ${jam}`
  return `${fTglP(iso)} · ${jam}`
}

/** A task row the current user may decide on (approve/send back). */
export const bolehReview = (t: BdTask, akuId?: string | null) =>
  !!akuId && t.status === 'Review' && reviewers(t).includes(akuId)

/** Waiting on my review, over the visible list. */
export const reviewTertunda = (daftar: BdTask[], akuId?: string | null) =>
  menungguReviewSaya(daftar, akuId ?? undefined)
