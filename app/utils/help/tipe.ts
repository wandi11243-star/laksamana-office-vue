// The structured data of one Help chapter, ported from the old Office
// (laksamana-office/deploy/help/panduan/*.js). A chapter is NEVER HTML: the
// renderer (app/components/PanduanBlok.vue) draws each block with real Vue
// elements and Vue escapes every text interpolation. The old test banned
// <button>, <input>, <form>, <script> and onclick inside chapter data — that ban
// still holds, and `satisfies Panduan` on every file makes an unknown block a
// type error (the old `uji-help.js` checked that by reading the data).

/** One paragraph. `*kata*` marks emphasis; the renderer turns it into <strong>. */
export interface BlokTeks { t: 'teks', isi: string }

/** A numbered step list, with an optional bold heading. */
export interface BlokLangkah { t: 'langkah', judul?: string, isi: string[] }

/** A bullet list. */
export interface BlokDaftar { t: 'daftar', isi: string[] }

/** A term table: `kepala` is the head row, `baris` the body rows. */
export interface BlokTabel { t: 'tabel', kepala: string[], baris: string[][] }

/** A coloured note. `nada` is the old class: info (default), awas (danger), ok. */
export interface BlokCatatan { t: 'catatan', nada?: 'info' | 'awas' | 'ok', judul?: string, isi: string }

/** A collapsible FAQ list. */
export interface BlokTanya { t: 'tanya', isi: { t: string, j: string }[] }

/** A screenshot. `berkas` is relative to public/help/gambar/. */
export interface BlokGambar { t: 'gambar', berkas: string, teks?: string, tandai?: string[] }

export type Blok = BlokTeks | BlokLangkah | BlokDaftar | BlokTabel | BlokCatatan | BlokTanya | BlokGambar

/** One section of a chapter. `id` is the anchor used by the table of contents. */
export interface BagianPanduan { id: string, judul: string, isi: Blok[] }

/** One chapter. `key` must equal the data file name (tools/uji-help.mjs checks it). */
export interface Panduan {
  key: string
  ringkas: string
  untuk?: string
  bagian: BagianPanduan[]
}
