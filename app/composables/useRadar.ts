// Radar — the read-only coordination board. Field names exactly as
// laksamana-api sends them: laksamana-api/docs/api/radar.md.
//
// Radar holds no data and writes nothing ("Radar hanya membaca. Perubahan
// dilakukan di modul asalnya."), so this file has reads only. The API joins the
// four source modules on the server, because a Radar holder usually does not
// hold marketing/event/reservasi/bd — and money figures only reach a Head
// (`bolehUang`).

export type SumberAgenda = 'mkt' | 'evt' | 'vip'

export interface RadarAgenda {
  sumber: SumberAgenda
  id: string
  tgl: string
  judul: string
  jam: string
  selesai: string
  tempat: string
  status: string
  pax: number
  jenis: string
  fb: string
  paxMin?: number
  paxMax?: number
}

export interface RadarReservasi {
  id: string
  date: string
  time?: string
  name?: string
  pax?: number | string
  table?: string
  category?: string
  status?: string
  vip?: boolean
  notes?: string
  foodReq?: string
  drinkReq?: string
  cancelReason?: string
  source?: string
  picName?: string
  phone?: string
  member?: boolean
  memberNo?: string
  /** Only with `bolehUang`. */
  dpAmount?: number | string
  dpStatus?: string
}

export interface RadarSumber {
  id: 'mkt' | 'evt' | 'rsv' | 'bd'
  nama: string
  ok: boolean
  pesan: string
  n?: number
}

/** Daily entertainment from Event › Talent Schedule (MC, DJ, Band …). Separate from the agenda. */
export interface RadarHiburan { id: string, tanggal: string, mulai: string, selesai: string, talent: string, kategori: string, status: string }

export interface RadarBoard {
  agenda: RadarAgenda[]
  reservations: RadarReservasi[]
  /** Missing on an older API: treat as empty. */
  hiburan?: RadarHiburan[]
  /** Marketing's F&B format list; null when Marketing never saved one (use the seed). */
  fbFormats: string[] | null
  sumber: RadarSumber[]
  bolehUang: boolean
  from: string
  to: string
}

export interface RadarKlien {
  nama: string
  perusahaan: string
  pic: string
  hp: string
}

export interface RadarDetail extends RadarAgenda {
  bolehUang: boolean
  klien?: RadarKlien | null
  mkt?: { mktPIC: string, pembayaran: number | null, detail: Record<string, unknown> }
  vip?: { mktPIC: string, hp: string, perusahaan: string, catatan: string }
  event?: { venue: string, category: string, capacity: number | string | null, pic: string, co_pic: string, theme: string, is_ticketed: boolean, description: string }
  talents?: { nama: string, jam: string, tipe: string }[]
}

export interface RadarPromo {
  status: 'running' | 'upcoming'
  id?: string
  nama?: string
  tipe?: string
  kategori?: string
  benefit?: string
  partner?: string
  kode?: string
  ketentuan?: string
  outlet?: string
  hari?: number[] | string
  jamMulai?: string
  jamSelesai?: string
  kuota?: number | string
  lmPIC?: string
  poster?: string
  mulai?: string
  selesai?: string
  paused?: boolean
}

export interface RadarPromos {
  promos: RadarPromo[]
  arsip: number
  sumber: RadarSumber[]
}

/** What the detail panel shows: an agenda item (loaded) or a reservation (from the board row). */
export type RadarPilihan = { jenis: 'ag', a: RadarAgenda } | { jenis: 'rs', r: RadarReservasi } | null

/** GET /radar/board?from&to — reloads when the range changes. */
export function useRadarBoard(key: string, from: Ref<string>, to: Ref<string>) {
  return useAsyncData(
    key,
    () => useApi()<Envelope<RadarBoard>>('/radar/board', { query: { from: from.value, to: to.value } }).then(r => r.data),
    { watch: [from, to] },
  )
}

/** GET /radar/agenda/{sumber}/{id} — the detail panel and Detail Lengkap. */
export const getRadarDetail = (sumber: SumberAgenda, id: string) =>
  useApi()<Envelope<RadarDetail>>(`/radar/agenda/${sumber}/${encodeURIComponent(id)}`).then(r => r.data)

/** GET /radar/promos */
export const useRadarPromos = () =>
  useAsyncData('radar-promos', () => useApi()<Envelope<RadarPromos>>('/radar/promos').then(r => r.data), { dedupe: 'defer' })

/**
 * GET /radar/files/{key} as an object URL. The endpoint streams the binary and
 * needs the Bearer token, so an <img src> cannot point at it directly. The
 * caller revokes the URL when done.
 */
export async function getRadarFileUrl(key: string): Promise<string> {
  const blob = await useApi()<Blob>(`/radar/files/${encodeURIComponent(key)}`, { responseType: 'blob' })
  return URL.createObjectURL(blob)
}

/**
 * Silent refresh every 5 minutes (SEGAR_MS), as the old page: no toast — a
 * toast every 5 minutes on a screen left on all day is noise. `tunda` returns
 * true while a detail sheet is open, so the refresh never pulls the rug from
 * under someone reading.
 */
export function useSegarSenyap(refresh: () => Promise<unknown>, tunda: () => boolean = () => false) {
  let t: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    t = setInterval(() => {
      if (!tunda()) refresh()
    }, 5 * 60 * 1000)
  })
  onBeforeUnmount(() => clearInterval(t))
}
