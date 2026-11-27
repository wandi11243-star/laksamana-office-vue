<!--
  Investor Compass › Upcoming Event. What is coming, in time order (the table),
  and which dates of the month are busy (the calendar) — two questions over
  the same data, so both draw from the one agenda read. No filters, no search,
  no rupiah: investors need what and when.

  Loaded lazily when the tab opens: one investorAgenda call fans out to
  Marketing, Event and BD server-side. A module that did not answer is named
  in a warning strip — an empty list must never read as "no events".

    laksamana-office/investor/index.html:535-542  tab markup
    laksamana-office/investor/index.html:1196-1312  vEvent + calendar
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { InvestorAgendaEvent } from '~/composables/useInvestor'
import { getInvestorKalender, useInvestorAgenda } from '~/composables/useInvestor'
import { fTgl, hariIni as tglHariIni } from '~/utils/format'
import { blnPanjang, jarakHari } from '~/utils/investor'

definePageMeta({ access: ['investor'] })

const { data: agenda, status, error, refresh } = useInvestorAgenda()
const acara = computed(() => agenda.value?.event ?? [])
const gagal = computed(() => agenda.value?.gagal ?? [])
const lebih = computed(() => agenda.value?.eventLebih ?? 0)
const hariIni = computed(() => agenda.value?.hariIni ?? '')

const mode = ref<'tabel' | 'kalender'>('tabel')
/** Table or calendar: everyone who opens this page may switch (owner, 28 Nov 2026). */
const bolehKalender = computed(() => true)

const kolom = computed<TableColumn<InvestorAgendaEvent>[]>(() => [
  { accessorKey: 'tgl', header: 'Tanggal' },
  { accessorKey: 'judul', header: 'Acara' },
  { accessorKey: 'tempat', header: 'Tempat' },
  { accessorKey: 'jenis', header: 'Jenis' },
])

// --- calendar: the Radar › Kalender Terpadu look (owner, Nov 2026) ----------
// 6 weeks from the Sunday before the 1st, one pill per event in its source
// colour with a left stripe, a pax total at the foot of the day, a list on phones.
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const pad = (n: number) => String(n).padStart(2, '0')
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hariKini = tglHariIni()
const cur = ref({ y: Number(hariKini.slice(0, 4)), m: Number(hariKini.slice(5, 7)) - 1 })
const blnKal = computed(() => `${cur.value.y}-${pad(cur.value.m + 1)}`)
const nav = (n: number) => {
  const d = new Date(cur.value.y, cur.value.m + n, 1)
  cur.value = { y: d.getFullYear(), m: d.getMonth() }
}
const sekarang = () => {
  cur.value = { y: Number(hariKini.slice(0, 4)), m: Number(hariKini.slice(5, 7)) - 1 }
}
const sel = computed(() => {
  const first = new Date(cur.value.y, cur.value.m, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { iso: isoOf(d), n: d.getDate(), luar: d.getMonth() !== cur.value.m }
  })
})
// The calendar reads its own range (past days too, owner 28 Nov 2026) and the reservations per day.
const { data: kal, error: kalGagal } = useAsyncData(
  'investor-kalender',
  () => (bolehKalender.value && mode.value === 'kalender' ? getInvestorKalender(sel.value[0]!.iso, sel.value[41]!.iso) : Promise.resolve(null)),
  { watch: [() => sel.value[0]!.iso, mode], default: () => null },
)
const acaraKal = computed(() => kal.value?.event ?? [])
const rsvSel = (iso: string) => (tampil.value.rsv ? kal.value?.reservasi[iso] : undefined)

type Sumber = 'mkt' | 'evt'
const sumberDari = (e: InvestorAgendaEvent): Sumber => (e.sumber === 'Event' ? 'evt' : 'mkt')
const tampil = ref<Record<Sumber | 'rsv', boolean>>({ mkt: true, evt: true, rsv: true })
const CHIP: { k: Sumber | 'rsv', label: string, warna: string }[] = [
  { k: 'mkt', label: 'Marketing', warna: 'bg-brand-yellow' },
  { k: 'evt', label: 'Event', warna: 'bg-lilac-light' },
  { k: 'rsv', label: 'Reservasi', warna: 'bg-info' },
]
const KELAS_EV: Record<Sumber, string> = { mkt: 'bg-yellow-light text-yellow-dark', evt: 'bg-lilac-light text-ink-900' }
const GARIS_EV: Record<Sumber, string> = { mkt: 'bg-brand-yellow', evt: 'bg-vip' }
const perTanggal = computed(() => {
  const peta = new Map<string, InvestorAgendaEvent[]>()
  for (const e of acaraKal.value) {
    if (!tampil.value[sumberDari(e)]) continue
    peta.set(e.tgl, [...(peta.get(e.tgl) ?? []), e])
  }
  return peta
})
const agSel = (iso: string) => perTanggal.value.get(iso) ?? []
/** Event pax + reservation pax of a day (different groups: an estimate of the night). */
const paxSel = (iso: string) => agSel(iso).reduce((a, e) => a + (Number(e.pax) || 0), 0) + (rsvSel(iso)?.pax ?? 0)
const agBln = computed(() => acaraKal.value.filter(e => String(e.tgl).startsWith(blnKal.value) && tampil.value[sumberDari(e)]))
const hitungBulan = computed(() => agBln.value.length)
const rsvBln = computed(() => Object.entries(kal.value?.reservasi ?? {}).filter(([t]) => t.startsWith(blnKal.value)).reduce((a, [, r]) => ({ jumlah: a.jumlah + r.jumlah, pax: a.pax + r.pax }), { jumlah: 0, pax: 0 }))
const hariBerisi = computed(() => sel.value.filter(c => !c.luar && (agSel(c.iso).length || rsvSel(c.iso))))
const dipilih = ref<InvestorAgendaEvent | null>(null)
const bukaDetail = ref(false)
function buka(e: InvestorAgendaEvent) {
  dipilih.value = e
  bukaDetail.value = true
}
</script>

<template>
  <AppPage
    title="Upcoming event"
    description="Acara terjadwal dari modul Marketing & Event"
  >
    <AppPanel
      v-if="status === 'pending'"
      title="Memuat agenda"
    >
      <USkeleton class="h-24 w-full" />
    </AppPanel>

    <div v-else-if="error || !agenda">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Agenda tidak bisa dibaca"
        :description="apiErrorMessage(error, 'Periksa koneksi, lalu muat ulang halaman.')"
      />
      <UButton
        label="Muat ulang"
        color="error"
        variant="soft"
        class="mt-3"
        @click="() => refresh()"
      />
    </div>

    <template v-else>
      <UAlert
        v-if="gagal.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Daftar mungkin belum lengkap"
        :description="`Data dari ${gagal.join(', ')} tidak terbaca saat ini.`"
        class="mb-5"
      />

      <AppPanel
        title="Acara akan datang"
        icon="i-lucide-calendar-days"
        :count="acara.length"
        flush
      >
        <!-- no Calendar for this viewer: the panel keeps its own title instead of an empty bar -->
        <template
          v-if="bolehKalender"
          #head
        >
          <div class="flex w-full flex-wrap items-center gap-3">
            <AppSeg
              v-model="mode"
              :options="[
                { value: 'tabel', label: 'Tabel', icon: 'i-lucide-table' },
                { value: 'kalender', label: 'Kalender', icon: 'i-lucide-calendar-days' },
              ]"
            />
          </div>
        </template>

        <p
          v-if="!acara.length"
          class="px-4 py-6 text-sm text-muted"
        >
          Belum ada acara terjadwal. Acara Marketing &amp; Event yang tanggalnya sudah lewat hari ini muncul di sini.
        </p>

        <template v-else-if="mode === 'tabel'">
          <UTable
            class="hidden lg:block"
            :data="acara"
            :columns="kolom"
            empty="Belum ada acara."
          >
            <template #tgl-cell="{ row }">
              <span class="num">{{ fTgl(row.original.tgl) }}</span>
              <span class="block text-[13px] font-normal text-muted">{{ row.original.jam || jarakHari(row.original.tgl, hariIni) }}</span>
            </template>
            <template #judul-cell="{ row }">
              <b>{{ row.original.judul }}</b>
              <span class="block text-[13px] font-normal text-muted">{{ row.original.sumber }}</span>
            </template>
            <template #tempat-cell="{ row }">
              {{ row.original.tempat || '—' }}
            </template>
            <template #jenis-cell="{ row }">
              {{ row.original.jenis || '—' }}{{ row.original.pax ? ` · ${row.original.pax} pax` : '' }}
            </template>
          </UTable>
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="(e, i) in acara"
              :key="i"
              class="px-4 py-3"
            >
              <p class="font-semibold text-highlighted">
                {{ e.judul }}
              </p>
              <p class="mt-0.5 text-sm text-muted">
                {{ fTgl(e.tgl) }}{{ e.jam ? ` · ${e.jam}` : '' }} · {{ jarakHari(e.tgl, hariIni) }}
              </p>
              <p
                v-if="e.tempat || e.jenis"
                class="text-sm text-muted"
              >
                {{ [e.tempat, e.jenis].filter(Boolean).join(' · ') }}{{ e.pax ? ` · ${e.pax} pax` : '' }}
              </p>
            </div>
          </div>
          <p
            v-if="lebih > 0"
            class="px-4 py-2 text-[13px] text-muted"
          >
            + {{ lebih }} acara lagi tidak ditampilkan.
          </p>
        </template>

        <template v-else>
          <div class="flex flex-wrap items-center gap-3 px-4 py-3">
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                icon="i-lucide-chevron-left"
                color="neutral"
                variant="outline"
                class="min-h-11 min-w-11 justify-center lg:min-h-9 lg:min-w-9"
                aria-label="Bulan sebelumnya"
                @click="nav(-1)"
              />
              <span class="min-w-40 text-center font-display text-lg font-bold">{{ blnPanjang(blnKal) }}</span>
              <UButton
                icon="i-lucide-chevron-right"
                color="neutral"
                variant="outline"
                class="min-h-11 min-w-11 justify-center lg:min-h-9 lg:min-w-9"
                aria-label="Bulan berikutnya"
                @click="nav(1)"
              />
              <UButton
                label="Hari ini"
                color="neutral"
                variant="outline"
                class="min-h-11 lg:min-h-9"
                @click="sekarang"
              />
            </div>
            <div class="flex-1" />
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[11px] font-bold uppercase tracking-wide text-muted">Tampilkan</span>
              <button
                v-for="c in CHIP"
                :key="c.k"
                type="button"
                class="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors hover:border-gold lg:min-h-8"
                :class="tampil[c.k] ? 'border-default bg-default text-highlighted' : 'border-dashed border-default text-muted line-through'"
                :aria-pressed="tampil[c.k]"
                @click="tampil = { ...tampil, [c.k]: !tampil[c.k] }"
              >
                <i
                  class="size-2.5 rounded-full"
                  :class="c.warna"
                />{{ c.label }}
              </button>
            </div>
          </div>

          <div class="mx-4 mb-4 hidden overflow-hidden rounded-panel border border-default bg-default lg:block">
            <div class="grid grid-cols-7">
              <div
                v-for="d in HARI"
                :key="d"
                class="border-b border-default bg-muted px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-muted"
              >
                {{ d }}
              </div>
            </div>
            <div class="grid auto-rows-fr grid-cols-7">
              <div
                v-for="c in sel"
                :key="c.iso"
                class="flex min-h-36 flex-col border-b border-r border-default p-1.5 transition-colors hover:bg-gold-soft/40 [&:nth-child(7n)]:border-r-0"
                :class="[c.luar ? 'bg-muted/40 text-muted' : '', c.iso === hariKini ? 'bg-gold-soft/60 ring-2 ring-inset ring-gold' : '']"
              >
                <div class="mb-1 text-xs font-bold num">
                  <span :class="c.iso === hariKini ? 'tgl-bulat' : ''">{{ c.n }}</span>
                </div>
                <button
                  v-for="(e, k) in agSel(c.iso).slice(0, 3)"
                  :key="k"
                  type="button"
                  class="relative mb-1 block w-full overflow-hidden rounded-[4px] py-1 pl-2.5 pr-1.5 text-left text-[11px] font-semibold leading-tight transition hover:brightness-95 hover:ring-1 hover:ring-gold/50"
                  :class="[KELAS_EV[sumberDari(e)], c.luar ? 'opacity-60' : '']"
                  :title="`${e.judul} — ${e.sumber}${e.pax ? ` · ${e.pax} pax` : ''}`"
                  @click="buka(e)"
                >
                  <i
                    class="absolute inset-y-0 left-0 w-1"
                    :class="GARIS_EV[sumberDari(e)]"
                    aria-hidden="true"
                  />
                  <span class="block truncate">{{ e.judul }}</span>
                </button>
                <p
                  v-if="agSel(c.iso).length > 3"
                  class="px-1 text-[11px] text-muted"
                >
                  +{{ agSel(c.iso).length - 3 }} lagi
                </p>
                <p
                  v-if="rsvSel(c.iso)"
                  class="px-1 text-[11px] text-info"
                  :class="c.luar ? 'opacity-60' : ''"
                >
                  {{ rsvSel(c.iso)!.jumlah }} rsv · {{ rsvSel(c.iso)!.pax }} pax
                </p>
                <p
                  v-if="paxSel(c.iso)"
                  class="mt-auto border-t border-default px-1 pt-1 text-[11px] font-semibold text-highlighted num"
                  :class="c.luar ? 'opacity-60' : ''"
                >
                  Total {{ paxSel(c.iso) }} pax
                </p>
              </div>
            </div>
          </div>

          <!-- phones: the days of the month that carry an event -->
          <div class="divide-y divide-default lg:hidden">
            <div
              v-for="c in hariBerisi"
              :key="c.iso"
              class="px-4 py-3"
              :class="c.iso === hariKini ? 'bg-primary-50' : ''"
            >
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div class="min-w-0 font-semibold text-highlighted">
                  {{ fTgl(c.iso) }}<span
                    v-if="c.iso === hariKini"
                    class="ml-1 text-primary-700"
                  >· Hari ini</span>
                </div>
                <span
                  v-if="paxSel(c.iso)"
                  class="text-right text-xs font-semibold text-muted num"
                >Total {{ paxSel(c.iso) }} pax</span>
              </div>
              <div class="grid grid-cols-1 gap-1.5">
                <p
                  v-if="rsvSel(c.iso)"
                  class="flex min-h-11 items-center gap-2 rounded-field border border-default bg-default px-2.5 py-2 text-sm text-info"
                >
                  <UIcon
                    name="i-lucide-book-open"
                    class="size-4 shrink-0"
                  />{{ rsvSel(c.iso)!.jumlah }} reservasi · {{ rsvSel(c.iso)!.pax }} pax
                </p>
                <button
                  v-for="(e, k) in agSel(c.iso)"
                  :key="k"
                  type="button"
                  class="relative flex min-h-11 min-w-0 items-center gap-2 overflow-hidden rounded-md py-2 pl-4 pr-2.5 text-left text-sm"
                  :class="KELAS_EV[sumberDari(e)]"
                  @click="buka(e)"
                >
                  <span
                    class="absolute inset-y-0 left-0 w-1.5"
                    :class="GARIS_EV[sumberDari(e)]"
                    aria-hidden="true"
                  />
                  <span class="shrink-0 text-xs text-muted">{{ e.sumber }}</span>
                  <span class="min-w-0 flex-1 truncate font-semibold">{{ e.judul }}</span>
                  <span
                    v-if="e.jam"
                    class="shrink-0 text-xs text-muted num"
                  >{{ e.jam }}</span>
                </button>
              </div>
            </div>
          </div>
          <p class="px-4 py-3 text-[13px] text-muted">
            {{ hitungBulan ? `${hitungBulan} acara di ${blnPanjang(blnKal)}` : `Tidak ada acara di ${blnPanjang(blnKal)}` }}{{ rsvBln.jumlah ? ` · ${rsvBln.jumlah} reservasi (${rsvBln.pax} pax)` : '' }}{{ kalGagal ? ' · kalender belum terbaca, coba muat ulang' : '' }}{{ kal?.gagal?.length ? ` · data ${kal.gagal.join(', ')} tidak terbaca` : '' }}
          </p>
        </template>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="bukaDetail"
        :title="dipilih?.judul ?? ''"
        :description="dipilih ? `${fTgl(dipilih.tgl)}${dipilih.jam ? ` · ${dipilih.jam}` : ''}` : ''"
      >
        <dl
          v-if="dipilih"
          class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"
        >
          <dt class="text-muted">
            Sumber
          </dt>
          <dd>{{ dipilih.sumber }}</dd>
          <dt class="text-muted">
            Tempat
          </dt>
          <dd>{{ dipilih.tempat || '—' }}</dd>
          <dt class="text-muted">
            Jenis
          </dt>
          <dd>{{ dipilih.jenis || '—' }}</dd>
          <dt class="text-muted">
            Pax
          </dt>
          <dd>{{ dipilih.pax || '—' }}</dd>
        </dl>
      </ResponsiveSheet>
    </template>
  </AppPage>
</template>
