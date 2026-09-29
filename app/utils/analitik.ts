// Analitik — performance and business insight, in pure functions.
//
// Owned by reservasi (PLAN.md §4), read by analitik.vue. Peak hour and peak
// day are PAX counts, never row counts: one 20-person booking makes an hour
// far busier than two 2-person ones (`:10440-10451`).
//
// Source: laksamana-office/deploy/reservasi/index.html:10349-10482.

import type { Reservasi } from '~/composables/useReservasi'
import { normPhone } from './dp-reservasi'
import { arrivedPax } from './kunci-meja'
import { durasiDuduk, keterlambatanDatang, PUNCTUAL_TOL } from './riwayat'

const paxPesan = (r: Reservasi) => Number(r.pax) || 0
const paxDatang = (r: Reservasi) => arrivedPax(r) || paxPesan(r)

/** Daily/monthly operational performance (`dailyPerfPanel`, `:10349-10403`). */
export interface PerformaPeriode {
  label: string
  reservasi: number
  walkin: number
  hariAktif: number
  hadir: number
  diharapkan: number
  kehadiran: number
  tepat: number
  telat: number
  telatRata: number
  tepatPersen: number
  durasiRata: number | null
  durasiN: number
  masihDuduk: number
  paxPesan: number
  paxDatang: number
  paxRealisasi: number
  noShow: number
  batal: number
  tersibuk: { tgl: string, total: number } | null
  trenHarian: { tgl: string, total: number, hadir: number, pax: number }[]
  palingTelat: { nama: string, telat: number, booking: string, tgl: string, datang: number }[]
  dudukTerlama: { nama: string, meja: string, durasi: number }[]
}

export function performaPeriode(baris: Reservasi[], label: string, bulanan: boolean): PerformaPeriode {
  const dipesan = baris.filter(r => r.source !== 'Walk-in')
  const walkin = baris.filter(r => r.source === 'Walk-in')
  const datang = baris.filter(r => r.status === 'Datang')
  const dipesanDatang = dipesan.filter(r => r.status === 'Datang')
  const noShow = dipesan.filter(r => r.status === 'No-show')
  const batal = dipesan.filter(r => r.status === 'Cancelled')
  const diharapkan = dipesanDatang.length + noShow.length

  const tepatData = dipesanDatang.map(r => keterlambatanDatang(r)).filter((l): l is number => l != null)
  const tepat = tepatData.filter(l => l <= PUNCTUAL_TOL).length
  const telatList = tepatData.filter(l => l > PUNCTUAL_TOL)

  const durasi = baris.map(r => durasiDuduk(r)).filter((d): d is number => d != null)
  const masihDuduk = baris.filter(r => r.status === 'Datang' && r.checkinAt && !r.leftAt).length

  const paxB = datang.reduce((a, r) => a + paxPesan(r), 0)
  const paxA = datang.reduce((a, r) => a + paxDatang(r), 0)

  const perHari = new Map<string, { total: number, hadir: number, pax: number }>()
  if (bulanan) {
    for (const r of baris) {
      const e = perHari.get(r.date) ?? { total: 0, hadir: 0, pax: 0 }
      e.total++
      if (r.status === 'Datang') {
        e.hadir++
        e.pax += paxDatang(r)
      }
      perHari.set(r.date, e)
    }
  }
  const trenHarian = [...perHari.entries()]
    .map(([tgl, v]) => ({ tgl, ...v }))
    .sort((a, b) => a.tgl.localeCompare(b.tgl))
  const tersibuk = trenHarian.length
    ? trenHarian.reduce((a, b) => (b.total > a.total ? b : a))
    : null

  return {
    label,
    reservasi: dipesan.length,
    walkin: walkin.length,
    hariAktif: new Set(baris.map(r => r.date)).size,
    hadir: dipesanDatang.length,
    diharapkan,
    kehadiran: diharapkan ? Math.round(dipesanDatang.length / diharapkan * 100) : 0,
    tepat,
    telat: telatList.length,
    telatRata: telatList.length ? Math.round(telatList.reduce((a, l) => a + l, 0) / telatList.length) : 0,
    tepatPersen: tepatData.length ? Math.round(tepat / tepatData.length * 100) : 0,
    durasiRata: durasi.length ? Math.round(durasi.reduce((a, d) => a + d, 0) / durasi.length) : null,
    durasiN: durasi.length,
    masihDuduk,
    paxPesan: paxB,
    paxDatang: paxA,
    paxRealisasi: paxB ? Math.round(paxA / paxB * 100) : 0,
    noShow: noShow.length,
    batal: batal.length,
    tersibuk: tersibuk ? { tgl: tersibuk.tgl, total: tersibuk.total } : null,
    trenHarian,
    palingTelat: dipesanDatang
      .map(r => ({ r, l: keterlambatanDatang(r) }))
      .filter((x): x is { r: Reservasi, l: number } => x.l != null && x.l > PUNCTUAL_TOL)
      .sort((a, b) => b.l - a.l)
      .slice(0, 5)
      .map(x => ({ nama: x.r.name, telat: x.l, booking: x.r.time, tgl: x.r.date, datang: x.r.checkinAt || 0 })),
    dudukTerlama: baris
      .map(r => ({ r, d: durasiDuduk(r) }))
      .filter((x): x is { r: Reservasi, d: number } => x.d != null)
      .sort((a, b) => b.d - a.d)
      .slice(0, 5)
      .map(x => ({ nama: x.r.name, meja: x.r.table || '-', durasi: x.d })),
  }
}

/** Whole-range summary (`renderAnalitik`, `:10464-10482`). */
export interface RingkasKeseluruhan {
  total: number
  totalPax: number
  rataPax: string
  noShow: number
  dinilai: number
  rasioNoShow: number
  unik: number
  perSumber: { label: string, n: number }[]
  perPic: { nama: string, total: number, hadirPersen: number }[]
  perJam: { jam: string, pax: number }[]
  perHari: { hari: string, pax: number }[]
  perBulan: { bulan: string, n: number }[]
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export function ringkasKeseluruhan(baris: Reservasi[]): RingkasKeseluruhan {
  const perSumber = new Map<string, number>()
  const perPic = new Map<string, { total: number, hadir: number }>()
  const perJam = new Map<string, number>()
  const perHari = [0, 0, 0, 0, 0, 0, 0]
  const perBulan = new Map<string, number>()

  for (const r of baris) {
    if (r.source) perSumber.set(r.source, (perSumber.get(r.source) ?? 0) + 1)
    const pic = (r.picName || '').trim() || (r.picType === 'Marketing' ? 'Marketing' : 'Host/Captain')
    const e = perPic.get(pic) ?? { total: 0, hadir: 0 }
    e.total++
    if (r.status === 'Datang') e.hadir++
    perPic.set(pic, e)
    // Peak hour and peak day count PAX, never rows.
    perJam.set((r.time || '0').split(':')[0] || '0', (perJam.get((r.time || '0').split(':')[0] || '0') ?? 0) + paxPesan(r))
    const d = new Date(`${r.date}T00:00:00`)
    if (!Number.isNaN(+d)) perHari[d.getDay()] = (perHari[d.getDay()] ?? 0) + paxPesan(r)
    const m = r.date.slice(0, 7)
    if (m) perBulan.set(m, (perBulan.get(m) ?? 0) + 1)
  }

  const dinilai = baris.filter(r => ['Datang', 'No-show'].includes(r.status))
  const noShow = baris.filter(r => r.status === 'No-show').length
  const totalPax = baris.reduce((a, r) => a + paxPesan(r), 0)

  return {
    total: baris.length,
    totalPax,
    rataPax: baris.length ? (totalPax / baris.length).toFixed(1) : '0',
    noShow,
    dinilai: dinilai.length,
    rasioNoShow: dinilai.length ? Math.round(noShow / dinilai.length * 100) : 0,
    unik: new Set(baris.map(r => normPhone(r.phone))).size,
    perSumber: [...perSumber.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    perPic: [...perPic.entries()]
      .map(([nama, v]) => ({ nama, total: v.total, hadirPersen: v.total ? Math.round(v.hadir / v.total * 100) : 0 }))
      .sort((a, b) => b.total - a.total),
    perJam: [...perJam.entries()].map(([jam, pax]) => ({ jam, pax })).sort((a, b) => a.jam.localeCompare(b.jam)),
    perHari: perHari.map((pax, i) => ({ hari: HARI[i]!, pax })),
    perBulan: [...perBulan.entries()].map(([bulan, n]) => ({ bulan, n })).sort((a, b) => a.bulan.localeCompare(b.bulan)),
  }
}
