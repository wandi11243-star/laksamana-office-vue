// Homepage module: the website's menu catalogue (module key `menu`), its news
// (module key `news`) and its event switch (module key `homepage`). Field names
// exactly as laksamana-api sends them:
//   laksamana-api/docs/api/menu.md      (Office: /menu/office/*)
//   laksamana-api/docs/api/news.md      (Office: /news/office/*)
//   laksamana-api/docs/api/homepage.md  (Office: /homepage/office/*)
//
// Versioned writes: PATCH/DELETE of kategori/item/artikel carry If-Match. The
// fast toggles (tersedia, tampil) and PUT /urutan do not, but they still bump
// `version`, so every write returns the fresh row and callers replace their
// copy with it (a stale copy would 409 on the next save).

// ─────────────────────────── shared ──

/** A file path the API hands back (`/api/v1/menu/foto/…`) → a URL on the API origin. */
export function apiFileUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const { apiBase } = useRuntimeConfig().public
  const origin = String(apiBase).replace(/\/api\/v1\/?$/, '')
  return new URL(path, `${origin}/`).href
}

/** The public website (laksamana-homepage), for "Lihat di website" links. */
export function websiteUrl(path = '/'): string {
  const { homepageBase } = useRuntimeConfig().public
  return `${String(homepageBase).replace(/\/+$/, '')}${path}`
}

export interface UploadHasil {
  key: string
  /** The public URL when the module has one; null when a file is only served by row id (promos). */
  url: string | null
}

async function upload(path: string, file: File): Promise<UploadHasil> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await useApi()<Envelope<UploadHasil>>(path, { method: 'POST', body: form })
  return data
}

// ─────────────────────────── menu ──

export type MenuJenis = 'makanan' | 'minuman'
export type MenuBagian = 'main_course' | 'snack'

export interface MenuVarian {
  id?: string
  label: string
  harga: number
  urutan?: number
}

export interface MenuKategori {
  id: string
  jenis: MenuJenis
  nama: string
  slug: string
  urutan: number
  aktif: boolean
  version: number
}

export interface MenuItem {
  id: string
  slug: string
  nama: string
  jenis: MenuJenis
  bagian: MenuBagian | null
  kategori: { slug: string, nama: string }
  deskripsi: string
  komponen: string
  foto_url: string | null
  varian: MenuVarian[]
  harga_mulai: number
  unggulan: boolean
  rekomendasi: boolean
  pedas: boolean
  vegetarian: boolean
  ramah_anak: boolean
  tersedia: boolean
  kategori_id: string
  tampil: boolean
  urutan: number
  catatan_internal: string
  version: number
}

export interface MenuState {
  kategori: MenuKategori[]
  item: MenuItem[]
  bagian: { kunci: MenuBagian, nama: string }[]
}

/** The body of POST /item and PATCH /item/{id}. `varian` replaces the whole set. */
export interface MenuItemBody {
  nama?: string
  kategori_id?: string
  bagian?: MenuBagian | null
  deskripsi?: string
  komponen?: string
  foto_key?: string | null
  varian?: { label: string, harga: number }[]
  unggulan?: boolean
  rekomendasi?: boolean
  pedas?: boolean
  vegetarian?: boolean
  ramah_anak?: boolean
  tampil?: boolean
  tersedia?: boolean
  catatan_internal?: string
}

export interface KategoriBody {
  nama?: string
  jenis?: MenuJenis
  slug?: string
  urutan?: number
  aktif?: boolean
}

/** One row of the category manager (HomepageKategori), menu or news. */
export interface KategoriBaris {
  id: string
  nama: string
  urutan: number
  aktif: boolean
  version: number
  /** How many items/articles use it; a used category cannot be deleted. */
  jumlah: number
}

export const BAGIAN_LABEL: Record<MenuBagian, string> = { main_course: 'Main course', snack: 'Snack' }
export const JENIS_LABEL: Record<MenuJenis, string> = { makanan: 'Makanan', minuman: 'Minuman' }

/** How many "Our Best Menu" cards the homepage shows (a fixed 3 × 2 grid). */
export const SLOT_UNGGULAN = 6

/** GET /menu/office/state: every item and category, drafts and inactive included. */
export const useMenuState = () =>
  useAsyncData('homepage-menu-state', () => useApi()<Envelope<MenuState>>('/menu/office/state').then(r => r.data), { dedupe: 'defer' })

/** `/foto/<key>` of an item, from its public `foto_url`. */
export const fotoKeyDari = (url: string | null) => url?.split('/').pop() ?? null

export function useMenuOffice() {
  const api = useApi()
  const base = '/menu/office'
  return {
    createItem: (body: MenuItemBody) =>
      api<Envelope<MenuItem>>(`${base}/item`, { method: 'POST', body }).then(r => r.data),
    updateItem: (id: string, body: MenuItemBody, headers: Record<string, string>) =>
      api<Envelope<MenuItem>>(`${base}/item/${id}`, { method: 'PATCH', body, headers }).then(r => r.data),
    deleteItem: (id: string, headers: Record<string, string>) =>
      api(`${base}/item/${id}`, { method: 'DELETE', headers }),
    setTersedia: (id: string, tersedia: boolean) =>
      api<Envelope<MenuItem>>(`${base}/item/${id}/tersedia`, { method: 'PATCH', body: { tersedia } }).then(r => r.data),
    setTampil: (id: string, tampil: boolean) =>
      api<Envelope<MenuItem>>(`${base}/item/${id}/tampil`, { method: 'PATCH', body: { tampil } }).then(r => r.data),
    createKategori: (body: KategoriBody) =>
      api<Envelope<MenuKategori>>(`${base}/kategori`, { method: 'POST', body }).then(r => r.data),
    updateKategori: (id: string, body: KategoriBody, headers: Record<string, string>) =>
      api<Envelope<MenuKategori>>(`${base}/kategori/${id}`, { method: 'PATCH', body, headers }).then(r => r.data),
    deleteKategori: (id: string, headers: Record<string, string>) =>
      api(`${base}/kategori/${id}`, { method: 'DELETE', headers }),
    urutan: (body: { kategori?: { id: string, urutan: number }[], item?: { id: string, urutan: number }[] }) =>
      api(`${base}/urutan`, { method: 'PUT', body }),
    uploadFoto: (file: File) => upload(`${base}/foto`, file),
  }
}

// ─────────────────────────── berita ──

export interface BeritaKategori {
  id: string
  nama: string
  slug: string
  urutan: number
  aktif: boolean
  version: number
}

export interface BeritaArtikel {
  id: string
  slug: string
  category: { slug: string, nama: string }
  title: string
  excerpt: string | null
  /** YYYY-MM-DD (WIB) of `published_at`. */
  date: string | null
  /** A path (`/api/v1/news/foto/…`) or null. */
  cover: string | null
  author: string | null
  /** Sanitized HTML. */
  content: string | null
  /** ISO-8601 in WIB, or null for a draft that was never dated. */
  published_at: string | null
  kategori_id: string
  cover_key: string | null
  tampil: boolean
  version: number
  created_at: string | null
  updated_at: string | null
}

export interface BeritaState {
  kategori: BeritaKategori[]
  artikel: BeritaArtikel[]
}

/** POST /artikel and PATCH /artikel/{id}. Indonesian names on the write side. */
export interface BeritaBody {
  judul?: string
  kategori_id?: string
  slug?: string
  ringkasan?: string | null
  isi?: string | null
  cover_key?: string | null
  penulis?: string | null
  tampil?: boolean
  published_at?: string | null
}

/** How many articles the homepage rail shows ("Kabar dari Laksamana"). */
export const SLOT_BERANDA_BERITA = 3

/** GET /news/office/state: every article (drafts included) and category. */
export const useBeritaState = () =>
  useAsyncData('homepage-berita-state', () => useApi()<Envelope<BeritaState>>('/news/office/state').then(r => r.data), { dedupe: 'defer' })

export function useBeritaOffice() {
  const api = useApi()
  const base = '/news/office'
  return {
    getArtikel: (id: string) =>
      api<Envelope<BeritaArtikel>>(`${base}/artikel/${id}`).then(r => r.data),
    createArtikel: (body: BeritaBody) =>
      api<Envelope<BeritaArtikel>>(`${base}/artikel`, { method: 'POST', body }).then(r => r.data),
    updateArtikel: (id: string, body: BeritaBody, headers: Record<string, string>) =>
      api<Envelope<BeritaArtikel>>(`${base}/artikel/${id}`, { method: 'PATCH', body, headers }).then(r => r.data),
    deleteArtikel: (id: string, headers: Record<string, string>) =>
      api(`${base}/artikel/${id}`, { method: 'DELETE', headers }),
    setTampil: (id: string, tampil: boolean) =>
      api<Envelope<BeritaArtikel>>(`${base}/artikel/${id}/tampil`, { method: 'PATCH', body: { tampil } }).then(r => r.data),
    createKategori: (body: KategoriBody) =>
      api<Envelope<BeritaKategori>>(`${base}/kategori`, { method: 'POST', body }).then(r => r.data),
    updateKategori: (id: string, body: KategoriBody, headers: Record<string, string>) =>
      api<Envelope<BeritaKategori>>(`${base}/kategori/${id}`, { method: 'PATCH', body, headers }).then(r => r.data),
    deleteKategori: (id: string, headers: Record<string, string>) =>
      api(`${base}/kategori/${id}`, { method: 'DELETE', headers }),
    urutan: (kategori: { id: string, urutan: number }[]) =>
      api(`${base}/urutan`, { method: 'PUT', body: { kategori } }),
    uploadCover: (file: File) => upload(`${base}/foto`, file),
  }
}

/**
 * The articles the homepage rail shows right now: published, in an active
 * category, newest first — the same rule as the public GET /news.
 */
export function beritaDiBeranda(state: BeritaState | null | undefined): Set<string> {
  if (!state) return new Set()
  const aktif = new Set(state.kategori.filter(k => k.aktif).map(k => k.id))
  const terbit = state.artikel
    .filter(a => a.tampil && aktif.has(a.kategori_id) && a.published_at)
    .sort((a, b) => (b.published_at! < a.published_at! ? -1 : b.published_at! > a.published_at! ? 1 : b.id.localeCompare(a.id)))
  return new Set(terbit.slice(0, SLOT_BERANDA_BERITA).map(a => a.id))
}

/** "16 Feb 2026" from the API's YYYY-MM-DD. */
export function tglBerita(date: string | null): string {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Menu prices as the card shows them: "45rb" or "R 45rb · L 55rb". */
export function hargaRingkas(varian: MenuVarian[]): string {
  if (!varian.length) return 'Belum ada harga'
  const rb = (n: number) => (n % 1000 === 0 ? `${n / 1000}rb` : new Intl.NumberFormat('id-ID').format(n))
  return varian.map(v => (v.label ? `${v.label} ${rb(v.harga)}` : rb(v.harga))).join(' · ')
}

// ─────────────────────────── event website ──

/**
 * One candidate row of the website Event switch (GET /homepage/office/events).
 * The event data itself lives in the Event (EMS) module; this module only owns
 * the `tampil` switch. `eligible` is the "boleh tampil" rule and `alasan` says
 * why not; `version` is the `homepage_event` row version (0 when none exists).
 */
export interface EventWeb {
  id: string
  title: string
  category: string
  status: string
  /** ISO-8601 WIB. */
  start: string
  /** ISO-8601 WIB, or null when EMS has no end. */
  end: string | null
  venue: string
  /** A path (`/api/v1/homepage/office/events/{id}/poster`) or null. */
  poster: string | null
  price_from: number
  is_ticketed: boolean
  tampil: boolean
  eligible: boolean
  alasan: 'belum_upcoming' | 'sudah_lewat' | null
  version: number
}

/** GET /homepage/office/events: every event that can be put on the website. */
export const useEventWeb = () =>
  useAsyncData('homepage-event-web', () => useApi()<Envelope<EventWeb[]>>('/homepage/office/events').then(r => r.data), { dedupe: 'defer' })

/**
 * An office image route sits behind the Bearer token, so a plain `<img src>`
 * cannot fetch it: pull the bytes through the API and hand the view an object
 * URL. Callers revoke the URL once they are done with it. Used by the Event
 * poster and the promo banner preview.
 */
export async function officeGambarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  // The API hands back the full path (`/api/v1/homepage/office/…`), but useApi()
  // already prepends the `/api/v1` base: strip it before calling.
  const rel = path.replace(/^\/api\/v1/, '')
  const blob = await useApi()<Blob>(rel, { responseType: 'blob' })
  return URL.createObjectURL(blob)
}

export function useEventWebOffice() {
  const api = useApi()
  const base = '/homepage/office'
  return {
    /** PATCH /events/{id}/tampil. No If-Match: a boolean, last writer wins. */
    setTampilEvent: (id: string, tampil: boolean) =>
      api<Envelope<EventWeb>>(`${base}/events/${id}/tampil`, { method: 'PATCH', body: { tampil } }).then(r => r.data),
  }
}

// ─────────────────────────── promo website ──

/** Why a promo row may not appear on the website right now (API `alasan`). */
export type PromoAlasan = 'bd_belum_mulai' | 'bd_berakhir' | 'bd_dijeda' | 'bd_tanpa_poster' | 'bd_hilang' | 'di_luar_periode'

export type PromoStatusBd = 'paused' | 'upcoming' | 'ended' | 'running'

/**
 * The slice of a BD promo the Homepage panel may see. `kode`, `partner`,
 * `kuota`, `lmPIC`, `ketentuan` and `outlet` are never sent.
 */
export interface PromoBd {
  nama: string
  tipe: string
  kategori: string
  benefit: string
  /** YYYY-MM-DD (WIB), or "" when BD has none. */
  mulai: string
  selesai: string
  status: PromoStatusBd
}

/**
 * One slide of the website promo slider (GET /homepage/office/promos): a stored
 * `homepage_banner` row (`sumber` `bd`/`unggah`), or a BD promo that has no row
 * yet — a candidate with `id: null`. A BD row only owns the switch, the alt
 * override and the link; poster and period always stay in BD
 * (docs/api/homepage.md › The promo rule).
 */
export interface PromoWeb {
  /** null for a BD candidate that has no row yet. */
  id: string | null
  sumber: 'bd' | 'unggah'
  promo_id: string | null
  alt: string | null
  href: string | null
  /** YYYY-MM-DD (WIB); the row's own window (uploads only). */
  mulai: string | null
  selesai: string | null
  tampil: boolean
  urutan: number
  version: number
  eligible: boolean
  alasan: PromoAlasan | null
  /** A path behind the Bearer token, or null when the row has no image. */
  gambar: string | null
  /** The BD promo it points at; null when that promo is gone (`bd_hilang`). */
  bd: PromoBd | null
}

export interface PromoOfficeState {
  items: PromoWeb[]
  /** true: BD could not be read; only uploaded banners can appear. */
  bd_gagal: boolean
}

/** GET /homepage/office/promos: stored rows plus BD candidates without a row. */
export const usePromoWeb = () =>
  useAsyncData('homepage-promo-web', () => useApi()<Envelope<PromoOfficeState>>('/homepage/office/promos').then(r => r.data), { dedupe: 'defer' })

/** POST /promos and PATCH /promos/{id} body. `gambar_key` is upload-only. */
export interface PromoBody {
  gambar_key?: string
  alt?: string | null
  href?: string | null
  mulai?: string | null
  selesai?: string | null
  tampil?: boolean
}

export function usePromoOffice() {
  const api = useApi()
  const base = '/homepage/office/promos'
  return {
    uploadFoto: (file: File) => upload(`${base}/foto`, file),
    create: (body: PromoBody) =>
      api<Envelope<PromoWeb>>(base, { method: 'POST', body }).then(r => r.data),
    /**
     * PATCH /promos/{id} (If-Match required: 428/409). Upload rows take
     * `alt, href, mulai, selesai, gambar_key`; BD rows only `alt, href`.
     */
    update: (id: string, body: PromoBody, headers: Record<string, string>) =>
      api<Envelope<PromoWeb>>(`${base}/${id}`, { method: 'PATCH', body, headers }).then(r => r.data),
    /** DELETE /promos/{id} (If-Match): uploads only; a BD row answers 422 pakai_saklar. */
    remove: (id: string, headers: Record<string, string>) =>
      api(`${base}/${id}`, { method: 'DELETE', headers }),
    /** PATCH /tampil of a stored row. No If-Match: a boolean, last writer wins. */
    setTampil: (id: string, tampil: boolean) =>
      api<Envelope<PromoWeb>>(`${base}/${id}/tampil`, { method: 'PATCH', body: { tampil } }).then(r => r.data),
    /** PATCH /bd/{promoId}/tampil: upserts the row of a BD promo. */
    setTampilBd: (promoId: string, tampil: boolean) =>
      api<Envelope<PromoWeb>>(`${base}/bd/${promoId}/tampil`, { method: 'PATCH', body: { tampil } }).then(r => r.data),
    /** PUT /urutan: one manual order for both kinds (10, 20, 30 …). No If-Match. */
    urutan: (items: { id: string, urutan: number }[]) =>
      api(`${base}/urutan`, { method: 'PUT', body: { items } }),
  }
}

/** The list key of a row: its id, or `promo:<id>` while it is still a candidate. */
export function promoGambarKey(p: Pick<PromoWeb, 'id' | 'promo_id'>): string {
  return p.id ?? `promo:${p.promo_id}`
}
