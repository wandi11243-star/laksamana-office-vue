<!--
  Marketing › Reservasi VIP (docs/migrasi/marketing.md D.14, issue #61):
  Assisted/Regular bookings whose tables lock straight into Reservasi as
  `vip-<id>` rows (F.8). Assisted counts as turnover once its nominal is in;
  Regular never does. Cancelled keeps its trace; deleted removes it (unless
  the guest already arrived — then it is only marked cancelled).
  Orphan locks (in Reservasi, not here) are restored with Pulihkan.
-->
<script setup lang="ts">
import type { KolomMkt, VipMkt } from '~/utils/marketing'
import type { Reservasi } from '~/composables/useReservasi'
import type { JenisVipMkt, PeriodeVipMkt } from '~/utils/marketing-vip'
import {
  jamAtau00Mkt, mejaTerpakaiVipMkt, penggunaDariNamaMkt, vipBelumNominalMkt, vipCocokJenisMkt, vipStatusBayarMkt, vipStatusPulihMkt,
  rekapVipMkt, saringVipMkt, vipDariReservasiMkt, vipDpTotalMkt,
  vipNominalMkt, vipPaxMkt, vipPerusahaanMkt, vipResBatalMkt, vipYatimMkt,
} from '~/utils/marketing-vip'
import {
  buatMkt, hapusMkt, mktSimpan, tambalMkt, useAksesMkt, useStateMkt, useTabelMkt,
} from '~/composables/useMarketing'
import { ifMatch } from '~/utils/versi'
import { hariIni, rupiah, tambahHari } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const { data: st, status } = useStateMkt()
const { can, saya } = useAksesMkt()
const hari = hariIni()
const bisaUbah = computed(() => can('edit_vip'))

const rekap = computed(() => rekapVipMkt(st.value.vip))
const perusahaan = (v: VipMkt) => vipPerusahaanMkt(v, id => st.value.clients.find(c => c.id === id)?.perusahaan ?? st.value.clients.find(c => c.id === id)?.nama ?? '')
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? '—'

// ---- filters ----
const q = useState('mkt-vip-q', () => '')
const periode = useState<PeriodeVipMkt>('mkt-vip-periode', () => 'semua')
const rentang = useState('mkt-vip-rentang', () => ({ dari: '', sampai: '' }))
const jenis = useState<JenisVipMkt>('mkt-vip-jenis', () => 'aktif')
const bulan = computed(() => hari.slice(0, 7))
// Text + period first; the kind segments count from this, like the old nJ().
const dasar = computed(() => saringVipMkt(st.value.vip, q.value, periode.value, rentang.value.dari, rentang.value.sampai, bulan.value, hari, 'semua'))
const daftar = computed(() => dasar.value.filter(v => vipCocokJenisMkt(v, jenis.value)))
const opsiJenis = computed(() => ([
  ['aktif', 'Regular & Assisted'], ['Assisted', 'Assisted'], ['Regular', 'Regular'], ['batal', 'Dibatalkan'], ['semua', 'Semua'],
] as [JenisVipMkt, string][]).map(([value, label]) => ({ value, label, badge: dasar.value.filter(v => vipCocokJenisMkt(v, value)).length })))
// The filter is SAID in words — a list that shrinks silently is reported as lost data.
const keteranganSaring = computed(() => {
  const nj = { aktif: 'Regular & Assisted (tanpa yang dibatalkan)', Assisted: 'Assisted', Regular: 'Regular', batal: 'yang dibatalkan', semua: 'semua status' }[jenis.value]
  const np = { semua: 'semua tanggal', hari: 'hari ini', minggu: 'minggu ini', bulan: 'bulan ini', pilih: `${rentang.value.dari || '…'} – ${rentang.value.sampai || '…'}` }[periode.value]
  return `Menampilkan ${nj}, acara ${np}.`
})
const paxTeks = (v: VipMkt) => (v.paxMin && v.paxMax && +v.paxMin !== +v.paxMax ? `${v.paxMin}–${v.paxMax}` : String(vipPaxMkt(v) || '—'))
const warnaBayar = { belum: 'neutral', dp: 'warning', lunas: 'success' } as const

// ---- orphan locks (vip-yatim) ----
const rsvVip = ref<Record<string, unknown>[]>([])
const rsvGalat = ref('')
const rsvMuat = ref(false)
const yatimBatal = ref(false)
async function muatRsv() {
  rsvMuat.value = true
  rsvGalat.value = ''
  try {
    // Orphan sweep via the server VIP filter (api#311): ?vip=1&idPrefix=vip-
    // replaces the 2020–2100 walk. The client filter stays as a guard for
    // an older API that ignores the new params.
    const r = await useApi()<Envelope<Record<string, unknown>[]>>('/reservasi/reservations', {
      query: { vip: 1, idPrefix: 'vip-' },
    })
    rsvVip.value = (r.data ?? []).filter(x => x && (x as { vip?: boolean }).vip === true && String((x as { id?: string }).id ?? '').startsWith('vip-'))
  }
  catch (e) {
    rsvGalat.value = `Tidak bisa membaca modul Reservasi: ${apiErrorMessage(e)}`
  }
  finally {
    rsvMuat.value = false
  }
}
watch(status, (s) => {
  if (s === 'success') void muatRsv()
}, { immediate: true })
const sayaMarketing = computed(() => saya.value?.user.role === 'marketing' ? String(saya.value.user.name ?? '').toLowerCase() : '')
const yatim = computed(() => {
  const ada = new Set(st.value.vip.map(v => v.id))
  const list = vipYatimMkt(rsvVip.value, ada, sayaMarketing.value || undefined)
  return yatimBatal.value ? list : list.filter(r => !vipResBatalMkt(r))
})
async function pulihkan(resId: string) {
  const r = rsvVip.value.find(x => x.id === resId)
  if (!r) return
  const v = vipDariReservasiMkt(r)
  if (st.value.vip.some(x => x.id === v.id)) return
  v.mktPIC = penggunaDariNamaMkt(String(r.picName ?? ''), st.value.users)
  const ok = await mktSimpan(
    () => buatMkt<VipMkt>('vip', v),
    'Dipulihkan', { refType: 'vip', refId: v.id, action: 'Reservasi VIP dipulihkan', detail: `${v.nama ?? ''} — dibaca ulang dari modul Reservasi, nominal masih kosong` },
  )
  if (ok) toast.add({ title: 'Nominal & Pengakuan Omset masih perlu diisi', color: 'warning' })
}
async function pulihkanSemua() {
  const ya = yatim.value.filter(r => !vipResBatalMkt(r))
  if (!ya.length || !confirm(`Pulihkan ${ya.length} Reservasi VIP? Barisnya dibaca ulang dari modul Reservasi. Nominal omzet dan Pengakuan Omset tetap kosong.`)) return
  for (const r of ya) await pulihkan(String(r.id))
}

// ---- form ----
const formBuka = ref(false)
const formAwal = ref<VipMkt | null>(null)
function baru() {
  formAwal.value = null
  formBuka.value = true
}
function ubah(v: VipMkt) {
  formAwal.value = v
  formBuka.value = true
}
async function simpanForm(v: VipMkt) {
  const lama = st.value.vip.find(x => x.id === v.id)
  const ok = lama
    ? await mktSimpan(() => tambalMkt<VipMkt>('vip', v.id, v, lama.updatedAt), 'Reservasi disimpan', { refType: 'vip', refId: v.id, action: 'Reservasi VIP diubah', detail: v.nama ?? '' })
    : await mktSimpan(() => buatMkt<VipMkt>('vip', v), 'Reservasi disimpan', { refType: 'vip', refId: v.id, action: 'Reservasi VIP dibuat', detail: v.nama ?? '' })
  if (ok) {
    formBuka.value = false
    lihatId.value = v.id
  }
}

// ---- detail ----
const lihatId = ref<string | null>(null)
const lihat = computed(() => st.value.vip.find(v => v.id === lihatId.value) ?? null)
/** The linked Reservasi row: the receipt attaches to it, like the old slot. */
const rsvLihat = ref<Reservasi | null>(null)
watch(() => lihat.value?.resId, async (rid) => {
  rsvLihat.value = null
  if (!rid) return
  try {
    const r = await useApi()<Envelope<Reservasi>>(`/reservasi/reservations/${encodeURIComponent(rid)}`)
    rsvLihat.value = r.data ?? null
  }
  catch {
    rsvLihat.value = null
  }
}, { immediate: true })
async function kunciTersimpan(meja: string[], resId: string) {
  const v = lihat.value
  if (!v) return
  await mktSimpan(() => tambalMkt<VipMkt>('vip', v.id, { meja, resId }, v.updatedAt), 'Meja terkunci di Reservasi')
}

// ---- Isi Nominal ----
const nominalBuka = ref(false)
const nominalNilai = ref('')
function bukaNominal(v: VipMkt) {
  lihatId.value = v.id
  nominalNilai.value = String(v.nominal ?? '')
  nominalBuka.value = true
}
async function simpanNominal() {
  const v = lihat.value
  if (!v) return
  const ok = await mktSimpan(
    () => tambalMkt<VipMkt>('vip', v.id, { nominal: nominalNilai.value === '' ? '' : +nominalNilai.value || 0 }, v.updatedAt),
    'Nominal tersimpan', { refType: 'vip', refId: v.id, action: 'Nominal VIP diisi', detail: `${v.nama} · ${rupiah(+nominalNilai.value || 0)}` },
  )
  if (ok) nominalBuka.value = false
}

// ---- Batalkan / Hapus (both touch the Reservasi row first) ----
async function barisRsv(resId: string) {
  const r = await useApi()<Envelope<Record<string, unknown>>>(`/reservasi/reservations/${encodeURIComponent(resId)}`).catch((e: unknown) => {
    if ((e as { statusCode?: number })?.statusCode === 404) return null
    throw e
  })
  return r?.data ?? null
}
const kerja = ref(false)
async function batalkan(v: VipMkt | null) {
  if (!v || v.batalAt) return
  if (!confirm(`Batalkan reservasi ${v.nama ?? ''}? Meja ${(v.meja ?? []).join(', ') || '—'} pada ${v.tanggal ?? ''} langsung dilepas di modul Reservasi dan bisa dipesan tamu lain.${v.jenis === 'Assisted' && vipNominalMkt(v) ? ' Nominalnya juga berhenti dihitung sebagai omzet.' : ''}`)) return
  kerja.value = true
  try {
    const resId = v.resId || `vip-${v.id}`
    const rec = await barisRsv(resId)
    if (rec) {
      await useApi()(`/reservasi/reservations/${encodeURIComponent(resId)}`, {
        method: 'PATCH',
        body: { status: 'Cancelled', notes: `${String(rec.notes ?? '')}\n[Dibatalkan dari modul Marketing oleh ${saya.value?.user.name ?? ''}]` },
        headers: ifMatch((rec.updatedAt ?? 0) as never),
      })
    }
    await mktSimpan(
      () => tambalMkt<VipMkt>('vip', v.id, { batalAt: new Date().toISOString(), batalOleh: saya.value?.user.name ?? '' }, v.updatedAt),
      (v.meja ?? []).length ? `Meja ${(v.meja ?? []).join(', ')} sudah bebas lagi di Reservasi.` : 'Reservasi ditandai batal.',
      { refType: 'vip', refId: v.id, action: 'Reservasi VIP dibatalkan', detail: `${v.nama} · ${v.tanggal} · meja ${(v.meja ?? []).join(', ') || '—'}` },
    )
  }
  catch (e) {
    toast.add({ title: 'Gagal membatalkan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    kerja.value = false
  }
}
async function hapus(v: VipMkt | null) {
  if (!v) return
  if (!confirm(`Hapus reservasi ${v.nama ?? ''}? Barisnya dibuang dari daftar ini DAN dari modul Reservasi — mejanya bebas, dan tidak ada jejak bahwa pernah ada pesanan.\n\nUntuk tamu yang membatalkan, pakai Batalkan: jejaknya tetap tersimpan di Reservasi.`)) return
  kerja.value = true
  try {
    const resId = v.resId || `vip-${v.id}`
    const rec = await barisRsv(resId)
    let ditolak = ''
    if (rec) {
      if (rec.status === 'Datang' || rec.checkinAt) {
        ditolak = 'tamu sudah tercatat datang'
        await useApi()(`/reservasi/reservations/${encodeURIComponent(resId)}`, {
          method: 'PATCH', body: { status: 'Cancelled' }, headers: ifMatch((rec.updatedAt ?? 0) as never),
        })
      }
      else {
        const ada = await useApi()<Envelope<{ updatedAt?: number }>>(`/reservasi/reservations/${encodeURIComponent(resId)}`).catch((e: unknown) => {
          if ((e as { statusCode?: number })?.statusCode === 404) return null
          throw e
        })
        if (ada) {
          await useApi()(`/reservasi/reservations/${encodeURIComponent(resId)}`, { method: 'DELETE', headers: ifMatch((ada.data?.updatedAt ?? 0) as never) })
        }
      }
    }
    const ok = await mktSimpan(() => hapusMkt('vip', v.id, v.updatedAt), 'Dihapus', { refType: 'vip', refId: v.id, action: 'Reservasi VIP dihapus', detail: `${v.nama} · ${v.tanggal}` })
    if (ok) {
      lihatId.value = null
      if (ditolak) toast.add({ title: 'Di Reservasi barisnya ditandai batal, bukan dibuang', description: ditolak, color: 'warning' })
    }
  }
  catch (e) {
    toast.add({ title: 'Gagal menghapus', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    kerja.value = false
  }
}

/**
 * Reopen a cancelled booking (vipBukaLagi, :16549): the tables are locked
 * again in Reservasi — REFUSED, naming the clash, when another guest took
 * them meanwhile; never overwritten silently.
 */
async function bukaLagi(v: VipMkt | null) {
  if (!v?.batalAt) return
  if (!confirm(`Buka kembali reservasi ${v.nama ?? ''}? Meja ${(v.meja ?? []).join(', ') || '—'} pada ${v.tanggal ?? ''} dikunci lagi di modul Reservasi.${v.jenis === 'Assisted' && vipNominalMkt(v) ? ` Nominalnya (${rupiah(vipNominalMkt(v))}) dihitung lagi sebagai omzet.` : ''}\n\nKalau mejanya sudah dipesan tamu lain, pembukaan ditolak.`)) return
  kerja.value = true
  try {
    const resId = v.resId || ''
    const rec = resId ? await barisRsv(resId) : null
    if (rec) {
      const sekitar = await daftarReservasiSemua(tambahHari(v.tanggal ?? '', -1), tambahHari(v.tanggal ?? '', 1))
      const pakai = mejaTerpakaiVipMkt(sekitar ?? [], v.tanggal ?? '', jamAtau00Mkt(v.jamMulai), resId)
      const bentrok = (v.meja ?? []).filter(m => pakai[m])
      if (bentrok.length) {
        toast.add({ title: 'Tidak bisa dibuka kembali', description: `Meja ${bentrok.join(', ')} sudah dipesan tamu lain pada jam itu.`, color: 'error' })
        return
      }
      await useApi()(`/reservasi/reservations/${encodeURIComponent(resId)}`, {
        method: 'PATCH',
        body: { status: vipStatusPulihMkt(rec), cancelReason: '', notes: `${String(rec.notes ?? '')}\n[Dibuka kembali dari modul Marketing oleh ${saya.value?.user.name ?? ''}]` },
        headers: ifMatch((rec.updatedAt ?? 0) as never),
      })
    }
    await mktSimpan(
      () => tambalMkt<VipMkt>('vip', v.id, { batalAt: '', batalOleh: '' }, v.updatedAt),
      (v.meja ?? []).length ? `Meja ${(v.meja ?? []).join(', ')} dikunci lagi di Reservasi.` : 'Reservasi dibuka kembali.',
      { refType: 'vip', refId: v.id, action: 'Reservasi VIP dibuka kembali', detail: `${v.nama} · ${v.tanggal}` },
    )
  }
  catch (e) {
    toast.add({ title: 'Gagal membuka kembali', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    kerja.value = false
  }
}

// ---- table ----
const KOL: KolomMkt<VipMkt>[] = [
  { k: 'tanggal', t: 'Tanggal', v: v => v.tanggal ?? '' },
  { k: 'nama', t: 'Atas Nama', v: v => v.nama ?? '' },
  { k: 'jenis', t: 'Jenis', v: v => v.jenis ?? '' },
  { k: 'pax', t: 'Orang', v: v => vipPaxMkt(v) },
  { k: 'meja', t: 'Meja', v: v => (v.meja ?? []).join(', ') },
  { k: 'bayar', t: 'Pembayaran', v: v => vipDpTotalMkt(v) },
  { k: 'nominal', t: 'Nominal', v: v => vipNominalMkt(v) },
]
const tbl = useTabelMkt<VipMkt>('vip', KOL, () => `${q.value}${periode.value}${rentang.value.dari}${rentang.value.sampai}${jenis.value}${st.value.vip.length}`)
const hal = computed(() => tbl.potong(tbl.susun(daftar.value)))
</script>

<template>
  <AppPage
    title="Reservasi VIP"
    description="Booking ruang VIP. Mejanya langsung dikunci di modul Reservasi."
  >
    <template #actions>
      <UButton
        v-if="bisaUbah"
        icon="i-lucide-plus"
        label="Reservasi VIP Baru"
        @click="baru"
      />
    </template>
    <MarketingGerbang layar="vip">
      <AppStatGrid>
        <AppStat
          label="Total reservasi"
          :value="String(rekap.total)"
          sub="Belum dibatalkan"
          tone="info"
          icon="i-lucide-star"
        />
        <AppStat
          label="Assisted"
          :value="String(rekap.assisted)"
          sub="Dihitung omzet"
          tone="success"
          icon="i-lucide-handshake"
        />
        <AppStat
          label="Regular"
          :value="String(rekap.regular)"
          sub="Tidak dihitung omzet"
          tone="info"
          icon="i-lucide-armchair"
        />
        <AppStat
          label="Nominal assisted"
          :value="rupiah(rekap.nominal)"
          sub="Sudah termasuk tax & service"
          tone="gold"
          icon="i-lucide-banknote"
        />
      </AppStatGrid>
      <UAlert
        v-if="rekap.tanpaNominal"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :description="`${rekap.tanpaNominal} Assisted belum ada nominalnya — isi lewat tombol Isi Nominal di barisnya.`"
        class="mb-4"
      />

      <AppPanel
        v-if="rsvGalat || yatim.length"
        title="Reservasi di Reservasi yang belum ada di Marketing"
        class="mb-4"
      >
        <UAlert
          v-if="rsvGalat"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="rsvGalat"
        >
          <template #actions>
            <UButton
              size="xs"
              color="neutral"
              variant="outline"
              label="Coba lagi"
              :loading="rsvMuat"
              @click="muatRsv"
            />
          </template>
        </UAlert>
        <template v-else>
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <USwitch
              v-model="yatimBatal"
              label="Tampilkan yang sudah batal"
            />
            <span class="flex-1" />
            <UButton
              v-if="bisaUbah && yatim.length"
              size="sm"
              color="neutral"
              variant="outline"
              label="Pulihkan semua"
              @click="pulihkanSemua"
            />
          </div>
          <ul class="grid gap-2">
            <li
              v-for="r in yatim"
              :key="String(r.id)"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-field border border-default p-2.5 text-sm"
            >
              <div class="min-w-0 flex-1">
                <b>{{ String(r.name ?? '(tanpa nama)') }}</b>
                <span class="block text-xs text-muted">{{ String(r.date ?? '') }} · {{ String(r.time ?? '') }} · {{ String(r.table ?? '') }} · {{ String(r.status ?? '') }}</span>
              </div>
              <UButton
                v-if="bisaUbah"
                size="sm"
                label="Pulihkan"
                @click="pulihkan(String(r.id))"
              />
              <span
                v-else
                class="text-xs text-muted"
              >butuh izin ubah</span>
            </li>
          </ul>
        </template>
      </AppPanel>

      <AppPanel flush>
        <template #head>
          <div class="grid w-full gap-2">
            <UInput
              v-model="q"
              placeholder="Cari nama, HP, perusahaan, meja…"
              icon="i-lucide-search"
            />
            <div class="flex flex-wrap gap-2">
              <AppSeg
                v-model="periode"
                :options="[{ value: 'semua', label: 'Semua' }, { value: 'hari', label: 'Hari ini' }, { value: 'minggu', label: 'Minggu ini' }, { value: 'bulan', label: 'Bulan ini' }, { value: 'pilih', label: 'Pilih tanggal' }]"
              />
              <UInput
                v-if="periode === 'pilih'"
                v-model="rentang.dari"
                type="date"
                aria-label="Dari tanggal"
              />
              <UInput
                v-if="periode === 'pilih'"
                v-model="rentang.sampai"
                type="date"
                aria-label="Sampai tanggal"
              />
              <AppSeg
                v-model="jenis"
                :options="opsiJenis"
              />
            </div>
            <p class="text-xs text-muted">
              {{ keteranganSaring }}
            </p>
          </div>
        </template>
        <div
          v-if="!daftar.length"
          class="p-8 text-center text-sm text-muted"
        >
          <b class="block text-base text-highlighted">Tidak ada reservasi di sini</b>
        </div>
        <template v-else>
          <UTable
            :data="hal"
            :columns="[
              { accessorKey: 'tanggal', header: 'Tanggal' },
              { accessorKey: 'nama', header: 'Atas Nama' },
              { accessorKey: 'jenis', header: 'Jenis' },
              { accessorKey: 'pax', header: 'Orang' },
              { accessorKey: 'meja', header: 'Meja' },
              { accessorKey: 'bayar', header: 'Pembayaran' },
              { accessorKey: 'nominal', header: 'Nominal' },
              { id: 'aksi', header: 'Aksi' },
            ]"
            class="hidden lg:block"
            :ui="{ tr: 'cursor-pointer' }"
            @select="(_e: Event, r: { original: VipMkt }) => { lihatId = r.original.id }"
          >
            <template #nama-cell="{ row }">
              <p class="font-semibold text-highlighted">
                {{ row.original.nama }}
              </p>
              <p class="text-xs text-muted">
                {{ perusahaan(row.original) }}
              </p>
            </template>
            <template #jenis-cell="{ row }">
              <AppStatus
                :color="row.original.jenis === 'Assisted' ? 'success' : 'neutral'"
                :icon="row.original.jenis === 'Assisted' ? 'i-lucide-handshake' : 'i-lucide-armchair'"
                size="sm"
              >
                {{ row.original.jenis }}
              </AppStatus>
            </template>
            <template #pax-cell="{ row }">
              <span class="num">{{ paxTeks(row.original) }}</span>
            </template>
            <template #meja-cell="{ row }">
              <span v-if="(row.original.meja ?? []).length">{{ (row.original.meja ?? []).join(', ') }}</span>
              <span
                v-else
                class="text-xs text-muted"
              >belum dikunci</span>
            </template>
            <template #bayar-cell="{ row }">
              <AppStatus
                :color="warnaBayar[vipStatusBayarMkt(row.original).k]"
                size="sm"
              >
                {{ vipStatusBayarMkt(row.original).t }}
              </AppStatus>
              <p
                v-if="vipDpTotalMkt(row.original)"
                class="num mt-1 text-xs text-muted"
              >
                {{ rupiah(vipDpTotalMkt(row.original)) }}
              </p>
            </template>
            <!-- The fix sits beside the gap (old note :16437): the button only
                 while the nominal is missing; a filled one is a plain number. -->
            <template #nominal-cell="{ row }">
              <span
                v-if="row.original.jenis !== 'Assisted'"
                class="text-muted"
              >—</span>
              <template v-else-if="vipBelumNominalMkt(row.original)">
                <UButton
                  v-if="bisaUbah && !row.original.batalAt"
                  size="xs"
                  icon="i-lucide-banknote"
                  label="Isi Nominal"
                  @click.stop="bukaNominal(row.original)"
                />
                <AppStatus
                  v-else
                  color="warning"
                  size="sm"
                >
                  belum diisi
                </AppStatus>
              </template>
              <span
                v-else
                class="num"
              >{{ rupiah(vipNominalMkt(row.original)) }}</span>
            </template>
            <template #aksi-cell="{ row }">
              <div
                class="flex gap-1"
                @click.stop
              >
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-eye"
                  aria-label="Lihat detail & meja"
                  @click="lihatId = row.original.id"
                />
                <template v-if="bisaUbah">
                  <UButton
                    v-if="!row.original.batalAt"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-pencil"
                    aria-label="Ubah reservasi"
                    @click="ubah(row.original)"
                  />
                  <UButton
                    v-if="!row.original.batalAt"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-x"
                    aria-label="Batalkan — meja dilepas, jejaknya tetap ada di Reservasi"
                    :disabled="kerja"
                    @click="batalkan(row.original)"
                  />
                  <UButton
                    v-else
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-check"
                    aria-label="Buka kembali — mejanya dikunci lagi di Reservasi"
                    :disabled="kerja"
                    @click="bukaLagi(row.original)"
                  />
                  <UButton
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    aria-label="Hapus permanen dari sini dan dari modul Reservasi"
                    :disabled="kerja"
                    @click="hapus(row.original)"
                  />
                </template>
              </div>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="v in hal"
              :key="v.id"
              class="p-4"
            >
              <button
                type="button"
                class="block w-full text-start"
                @click="lihatId = v.id"
              >
                <b class="text-highlighted">{{ v.nama }}</b>
                <span class="block text-xs text-muted">{{ v.tanggal }} · {{ (v.meja ?? []).join(', ') || 'belum dikunci' }} · {{ paxTeks(v) }} orang</span>
                <span class="mt-1 flex flex-wrap gap-1">
                  <AppStatus
                    :color="v.jenis === 'Assisted' ? 'success' : 'neutral'"
                    size="sm"
                  >
                    {{ v.jenis }}
                  </AppStatus>
                  <AppStatus
                    :color="warnaBayar[vipStatusBayarMkt(v).k]"
                    size="sm"
                  >
                    {{ vipStatusBayarMkt(v).t }}
                  </AppStatus>
                  <AppStatus
                    v-if="v.batalAt"
                    color="error"
                    size="sm"
                  >
                    Dibatalkan
                  </AppStatus>
                </span>
                <span
                  v-if="v.jenis === 'Assisted' && !vipBelumNominalMkt(v)"
                  class="num mt-1 block text-sm"
                >{{ rupiah(vipNominalMkt(v)) }}</span>
              </button>
              <div
                v-if="bisaUbah && vipBelumNominalMkt(v) && !v.batalAt"
                class="mt-2"
              >
                <UButton
                  size="xs"
                  color="neutral"
                  variant="outline"
                  label="Isi Nominal"
                  @click="bukaNominal(v)"
                />
              </div>
            </li>
          </ul>
          <MarketingPager
            v-model="tbl.hal.value"
            :total="daftar.length"
          />
        </template>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="formBuka"
        :title="formAwal ? 'Ubah Reservasi VIP' : 'Reservasi VIP Baru'"
        description="Data ini juga yang dikirim ke modul Reservasi."
      >
        <MarketingVipForm
          :key="formAwal?.id ?? 'baru'"
          :awal="formAwal"
          :clients="st.clients"
          :users="st.users"
          :bisa-ubah="bisaUbah"
          @simpan="simpanForm"
        />
      </ResponsiveSheet>

      <ResponsiveSheet
        :open="!!lihat"
        :title="lihat?.nama ?? ''"
        :description="lihat ? `${lihat.tanggal ?? ''} · ${(lihat.meja ?? []).join(', ') || 'tanpa meja'}` : ''"
        @update:open="lihatId = $event ? lihatId : null"
      >
        <dl
          v-if="lihat"
          class="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm"
        >
          <dt class="text-muted">
            Jenis
          </dt>
          <dd>{{ lihat.jenis }}</dd>
          <dt class="text-muted">
            Perusahaan
          </dt>
          <dd>{{ perusahaan(lihat) || '—' }}</dd>
          <dt class="text-muted">
            HP
          </dt>
          <dd>{{ lihat.hp || '—' }}</dd>
          <dt class="text-muted">
            Jam
          </dt>
          <dd>{{ lihat.jamMulai || '—' }}{{ lihat.jamSelesai ? ` s/d ${lihat.jamSelesai}` : '' }}</dd>
          <dt class="text-muted">
            Orang
          </dt>
          <dd>{{ vipPaxMkt(lihat) }}</dd>
          <dt class="text-muted">
            Nominal
          </dt>
          <dd>{{ lihat.jenis === 'Assisted' ? rupiah(vipNominalMkt(lihat)) : '—' }}</dd>
          <dt class="text-muted">
            DP masuk
          </dt>
          <dd>{{ rupiah(vipDpTotalMkt(lihat)) }}</dd>
        </dl>
        <div
          v-if="lihat && vipDpTotalMkt(lihat) > 0"
          class="mt-3"
        >
          <KwitansiSlot
            :res-id="lihat.resId || ''"
            :reservasi="rsvLihat"
            :boleh-minta="bisaUbah"
          />
        </div>
        <p
          v-else-if="lihat && !lihat.resId"
          class="mt-3 text-xs text-muted"
        >
          Kunci dulu ke modul Reservasi — kwitansi menempel pada baris reservasinya.
        </p>
        <p
          v-else-if="lihat"
          class="mt-3 text-xs text-muted"
        >
          Belum ada DP yang bisa dikwitansikan.
        </p>
        <div
          v-if="lihat && bisaUbah && !lihat.batalAt"
          class="mt-3"
        >
          <MarketingVipKunci
            :key="`kunci-${lihat.id}-${lihat.updatedAt}`"
            :vip="lihat"
            :perusahaan="perusahaan(lihat)"
            :nama-pic="namaUser(lihat.mktPIC)"
            :oleh="saya?.user.name ?? ''"
            :bisa-ubah="bisaUbah"
            @kunci="kunciTersimpan"
          />
        </div>
        <div
          v-if="lihat && bisaUbah"
          class="mt-4 flex flex-wrap gap-2"
        >
          <UButton
            v-if="!lihat.batalAt"
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            size="sm"
            label="Ubah"
            @click="ubah(lihat)"
          />
          <UButton
            v-if="!lihat.batalAt"
            icon="i-lucide-ban"
            color="warning"
            variant="outline"
            size="sm"
            label="Batalkan"
            :loading="kerja"
            @click="batalkan(lihat)"
          />
          <UButton
            v-if="lihat.batalAt"
            icon="i-lucide-check"
            color="neutral"
            variant="outline"
            size="sm"
            label="Buka kembali"
            :loading="kerja"
            @click="bukaLagi(lihat)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="outline"
            size="sm"
            label="Hapus"
            :loading="kerja"
            @click="hapus(lihat)"
          />
        </div>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="nominalBuka"
        title="Isi Nominal"
        :description="lihat?.nama ?? ''"
      >
        <UFormField
          label="Nominal pendapatan (Rp)"
          hint="Sudah termasuk tax & service. Inilah angka yang masuk laporan."
        >
          <UInput
            v-model="nominalNilai"
            inputmode="numeric"
          />
        </UFormField>
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="nominalBuka = false"
          />
          <UButton
            label="Simpan"
            @click="simpanNominal"
          />
        </div>
      </ResponsiveSheet>
    </MarketingGerbang>
  </AppPage>
</template>
