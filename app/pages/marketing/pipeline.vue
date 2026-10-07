<!--
  Marketing › Sales Pipeline & Event (old renderPipeline + pipeIsiEvents,
  deploy/marketing/index.html:6163-6923; marketing.md D.3). One PIC row on top
  for both tabs, the "Peluang Aktif" strip, then:

  - Kanban: the six PIPE_COLS (Event Done has no column, F.11). A card opens
    in place (Client, Pax, Nilai, Buka Event). Dragging to another column asks
    "Pindahkan ke X?" first; Quotation Terkirim needs an approved offer letter
    (pindahBolehMkt, F.3). Moving up is never blocked, only reminded (F.10).
    Moving to Deal opens the handover tasks. On phones the columns stack and
    an open card has "Pindah tahap" instead of dragging.
  - Daftar Event: period (Semua / Hari ini / Minggu ini / Bulan ini + month
    stepper), status (default "Semua kecuali selesai"), search, Reset filter.

  Correction vs the old client: dragging a card never checked edit_event, so
  anyone who could open the board could move a stage. It needs edit_event here.

  Not here yet: "Ajukan Revisi" on a card and the Internal / Client / Draft
  documents belong to the offer letter and brief (#59); the buttons show as
  "Segera" until then.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { EventMkt, KolomMkt, PeriodeEventMkt } from '~/utils/marketing'
import {
  PERIODE_EVENT_MKT, PIPE_COLS_MKT, STATUS_EVENT_MKT, hMinusMkt, ingatTahapMkt, jenisEvent, kolomPipeMkt, menuFixMkt,
  pindahBolehMkt, rentangPeriodeMkt, rentangTglMkt, tglMkt, timMarketing, tugasDealMkt,
} from '~/utils/marketing'
import { eventFinance } from '~/utils/marketing-uang'
import { ikonStatusMkt, warnaJenisMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { BULAN, hariIni, rupiah } from '~/utils/format'
import { inisial } from '~/utils/bd-rumus'

definePageMeta({ access: ['marketing'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { data: st, error } = useStateMkt()
const { can } = useAksesMkt()
const hari = hariIni()

const tab = useState<'kanban' | 'events'>('mkt-pipe-tab', () => 'kanban')
if (route.query.tab === 'events') tab.value = 'events'
const pic = useState('mkt-pipe-pic', () => '')
const buka = ref('')
const eventBaru = ref(false)

const grand = (e: EventMkt) => eventFinance(e, st.value.settings).grand
const namaClient = (id: string) => st.value.clients.find(c => c.id === id)?.nama ?? '—'
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? '—'
const depan = (id?: string) => namaUser(id).split(' ')[0]

/** Marketing-team users that are active, plus anyone holding an event (pipeDaftarPIC, :6165-6171). */
const daftarPic = computed(() => {
  const ada = new Set<string>()
  for (const u of st.value.users) if (u.active !== false && timMarketing(u)) ada.add(u.id)
  for (const e of st.value.events) if (e.mktPIC) ada.add(e.mktPIC)
  return [...ada].sort((a, b) => namaUser(a).localeCompare(namaUser(b)))
})
const opsiPic = computed(() => [{ value: '', label: 'Semua' }, ...daftarPic.value.map(id => ({ value: id, label: `${inisial(namaUser(id))} · ${depan(id)}` }))])
const cocokPic = (e: EventMkt) => !pic.value || e.mktPIC === pic.value

// ---- ringkasan (pipeRingkas, :6390-6422) ----
const aktif = computed(() => st.value.events.filter(e => kolomPipeMkt(e) !== 'Event Done' && cocokPic(e)))
const ringkas = computed(() => PIPE_COLS_MKT.map((k) => {
  const it = aktif.value.filter(e => kolomPipeMkt(e) === k)
  return { k, n: it.length, v: it.reduce((a, e) => a + grand(e), 0) }
}))
const totalAktif = computed(() => aktif.value.reduce((a, e) => a + grand(e), 0))

// ---- kanban ----
const kolom = computed(() => PIPE_COLS_MKT.map(c => ({ c, items: st.value.events.filter(e => kolomPipeMkt(e) === c && cocokPic(e)) })))
const seret = ref<string | null>(null)
const atas = ref<string | null>(null)
const pindah = ref<{ e: EventMkt, ke: string } | null>(null)
const pindahBuka = computed({ get: () => !!pindah.value, set: (v) => {
  if (!v) pindah.value = null
} })
const sibuk = ref(false)

function minta(e: EventMkt, ke: string) {
  if (kolomPipeMkt(e) === ke) return
  if (!can('edit_event')) return toast.add({ title: 'Akses ditolak', description: 'Kamu tidak punya izin mengubah tahap event.', color: 'error' })
  const tolak = pindahBolehMkt(e, ke)
  if (tolak) return toast.add({ title: 'Belum bisa ke Quotation Terkirim', description: tolak, color: 'error' })
  pindah.value = { e, ke }
}
function lepas(col: string) {
  atas.value = null
  const id = seret.value
  seret.value = null
  const e = st.value.events.find(x => x.id === id)
  if (e) minta(e, col)
}
async function pindahkan() {
  const p = pindah.value
  if (!p) return
  const { e, ke } = p
  const dari = e.status
  const ingat = ingatTahapMkt(e, ke)
  const ubah: Partial<EventMkt> = { pipeCol: ke, status: ke }
  if (ke === 'Deal') ubah.tasks = tugasDealMkt(e, formatFbMkt(st.value))
  sibuk.value = true
  const ok = await mktSimpan(
    () => tambalMkt<EventMkt>('events', e.id, ubah, e.updatedAt),
    ke === 'Deal' ? undefined : `${e.nama}: ${dari} → ${ke}`,
    { refType: 'event', refId: e.id, action: 'Pipeline dipindah', detail: `${dari} → ${ke}` },
  )
  sibuk.value = false
  pindah.value = null
  if (!ok) return
  if (ke === 'Deal') toast.add({ title: 'Deal!', description: `${e.nama} masuk tahap eksekusi & handover divisi.`, color: 'success' })
  if (ingat) setTimeout(() => toast.add({ title: 'Data dasar belum lengkap', description: ingat, color: 'warning' }), 700)
}
const opsiPindah = (e: EventMkt) => [PIPE_COLS_MKT.filter(c => c !== kolomPipeMkt(e)).map(c => ({ label: c, onSelect: () => minta(e, c) }))]

// ---- Daftar Event (pipeIsiEvents / paintEvents, :6718-6922) ----
const AKTIF = '__aktif__'
const SEMUA = '__semua'
const fe = useState('mkt-ev-filter', () => ({ periode: '' as PeriodeEventMkt, bulan: '', status: AKTIF, q: '' }))
const bawaan = computed(() => fe.value.periode === '' && fe.value.status === AKTIF && !fe.value.q && !pic.value)
function reset() {
  fe.value = { periode: '', bulan: '', status: AKTIF, q: '' }
  pic.value = ''
}
const bulanAktif = computed(() => fe.value.bulan || hari.slice(0, 7))
const labelBulan = computed(() => `${BULAN[+bulanAktif.value.slice(5, 7) - 1]} ${bulanAktif.value.slice(0, 4)}`)
function geserBulan(n: number) {
  const b = bulanAktif.value
  const d = new Date(+b.slice(0, 4), +b.slice(5, 7) - 1 + n, 1)
  fe.value.bulan = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  fe.value.periode = 'pilih'
}
function bulanIni() {
  fe.value.bulan = ''
  fe.value.periode = 'bulan'
}
const fStatus = computed({ get: () => fe.value.status || SEMUA, set: (v: string) => {
  fe.value.status = v === SEMUA ? '' : v
} })
const opsiStatus = [{ value: AKTIF, label: 'Semua kecuali selesai' }, { value: SEMUA, label: 'Semua status (termasuk selesai)' }, ...STATUS_EVENT_MKT.map(s => ({ value: s, label: s }))]
const periodeSeg = computed({ get: () => fe.value.periode, set: (v: PeriodeEventMkt) => {
  fe.value.periode = v
} })

const rentang = computed(() => rentangPeriodeMkt(fe.value.periode, hari, fe.value.bulan))
const seperiode = computed(() => {
  const r = rentang.value
  const semua = st.value.events.filter(cocokPic)
  return r ? semua.filter(e => !!e.tanggal && e.tanggal >= r.a && e.tanggal <= r.b) : semua
})
const nSelesai = computed(() => seperiode.value.filter(e => e.status === 'Event Done').length)
const daftar = computed(() => {
  let evs = seperiode.value
  if (fe.value.status === AKTIF) evs = evs.filter(e => e.status !== 'Event Done')
  else if (fe.value.status) evs = evs.filter(e => e.status === fe.value.status)
  const q = fe.value.q.trim().toLowerCase()
  if (q) evs = evs.filter(e => `${e.nama} ${namaClient(e.clientId)}`.toLowerCase().includes(q))
  return evs
})
const KOL: KolomMkt<EventMkt>[] = [
  { k: 'nama', t: 'Event', v: e => e.nama },
  { k: 'tanggal', t: 'Tanggal', v: e => e.tanggal, turun: true, def: true },
  { k: 'pax', t: 'Pax', v: e => +(e.pax ?? 0) || 0, turun: true },
  { k: 'status', t: 'Status', v: e => e.status },
  { k: 'pic', t: 'PIC Marketing', v: e => (e.mktPIC ? namaUser(e.mktPIC) : '') },
  { k: 'grand', t: 'Grand Total', v: e => grand(e), turun: true },
]
const tbl = useTabelMkt('events', KOL, () => fe.value.q)
const urut = computed(() => tbl.susun(daftar.value))
const hal = computed(() => tbl.potong(urut.value))
const kolomTabel: TableColumn<EventMkt>[] = [
  ...KOL.map(k => ({ id: k.k, header: tbl.kepala(k.k, k.t) })),
  { id: 'dok', header: 'Dokumen' },
  { id: 'buka', header: '' },
]
const hitung = computed(() => {
  const r = rentang.value
  return `${daftar.value.length} dari ${seperiode.value.length} event`
    + (r ? ` · ${tglMkt(r.a)}${r.a !== r.b ? ` – ${tglMkt(r.b)}` : ''}` : '')
    + (fe.value.status === AKTIF && nSelesai.value ? ` · ${nSelesai.value} selesai disembunyikan` : '')
})
const kosong = computed(() => {
  const ada = !bawaan.value
  if (!ada && nSelesai.value > 0) return { t: 'Semua event di sini sudah selesai', d: `${nSelesai.value} event selesai disembunyikan. Pilih Semua status (termasuk selesai) di kotak status untuk melihatnya.` }
  if (ada) return { t: 'Tidak ada yang cocok', d: `Longgarkan saringan periode/status, kosongkan pencariannya${pic.value ? `, atau pilih PIC Semua — sekarang tersaring ke ${namaUser(pic.value)}` : ''} — atau tekan Reset filter.` }
  return { t: 'Belum ada event', d: 'Buat event dari client yang sudah Deal.' }
})
</script>

<template>
  <AppPage
    title="Sales Pipeline & Event"
    description="Papan peluang dan daftar seluruh event — satu tempat, satu penyaring orang."
  >
    <template #actions>
      <AppSeg
        v-model="tab"
        :options="[{ value: 'kanban', label: 'Kanban' }, { value: 'events', label: 'Daftar Event' }]"
      />
      <UButton
        v-if="can('edit_event')"
        label="Event Baru"
        icon="i-lucide-plus"
        @click="eventBaru = true"
      />
    </template>

    <MarketingGerbang layar="pipeline">
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Marketing: ${apiErrorMessage(error)}`"
        class="mb-5"
      />

      <div
        v-if="daftarPic.length"
        class="mb-4 flex flex-wrap items-center gap-2"
      >
        <span class="flex items-center gap-1 text-xs font-bold tracking-wider text-muted uppercase">
          <UIcon
            name="i-lucide-user"
            class="size-4"
          />PIC
        </span>
        <AppChips
          v-model="pic"
          :options="opsiPic"
          @update:model-value="buka = ''"
        />
      </div>

      <div class="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <div
          class="col-span-2 rounded-panel border border-primary-300 bg-primary-50 p-3 sm:col-span-1"
          :title="`${aktif.length} peluang · ${rupiah(totalAktif)}`"
        >
          <p class="text-xs font-bold tracking-wide text-primary-800 uppercase">
            Peluang Aktif
          </p>
          <p class="num font-display text-2xl font-bold text-highlighted">
            {{ aktif.length }}
          </p>
          <p class="text-xs text-muted">
            {{ pic ? depan(pic) : 'seluruh tim' }}
          </p>
        </div>
        <div
          v-for="r in ringkas"
          :key="r.k"
          class="rounded-panel border border-default bg-default p-3"
          :class="r.n ? '' : 'opacity-60'"
          :title="`${r.k}: ${r.n} peluang${r.v ? ` · ${rupiah(r.v)}` : ''}`"
        >
          <AppStatus
            :color="warnaStatusMkt(r.k)"
            :icon="ikonStatusMkt(r.k)"
            size="sm"
          >
            {{ r.k === 'Quotation Terkirim' ? 'Quotation' : r.k }}
          </AppStatus>
          <p class="num mt-1 font-display text-2xl font-bold text-highlighted">
            {{ r.n }}
          </p>
          <p class="text-xs text-muted">
            peluang
          </p>
        </div>
      </div>

      <!-- Kanban -->
      <div
        v-if="tab === 'kanban'"
        class="grid gap-3 lg:grid-cols-6"
      >
        <section
          v-for="k in kolom"
          :key="k.c"
          class="flex min-w-0 flex-col rounded-panel border bg-muted"
          :class="atas === k.c ? 'border-primary-400 bg-primary-50' : 'border-default'"
          @dragover.prevent="atas = k.c"
          @dragleave="atas === k.c && (atas = null)"
          @drop.prevent="lepas(k.c)"
        >
          <header class="flex items-center gap-2 px-3 py-2.5">
            <AppStatus
              :color="warnaStatusMkt(k.c)"
              :icon="ikonStatusMkt(k.c)"
              size="sm"
            >
              {{ k.c }}
            </AppStatus>
            <span class="num ml-auto rounded-full bg-default px-2 text-xs font-bold">{{ k.items.length }}</span>
          </header>
          <div class="flex min-h-16 flex-1 flex-col gap-2 px-2 pb-2">
            <div
              v-for="e in k.items"
              :key="e.id"
              :draggable="can('edit_event')"
              class="cursor-pointer rounded-field border bg-default p-2.5 shadow-panel"
              :class="[buka === e.id ? 'border-primary-400' : 'border-default hover:border-accented', seret === e.id ? 'opacity-40' : '']"
              @dragstart="seret = e.id"
              @dragend="seret = null; atas = null"
              @click="buka = buka === e.id ? '' : e.id"
            >
              <p class="text-sm font-semibold text-highlighted">
                {{ e.nama }}<span
                  v-if="e.mktPIC"
                  class="font-normal text-muted"
                > · {{ depan(e.mktPIC) }}</span>
              </p>
              <p class="truncate text-xs text-muted">
                {{ namaClient(e.clientId) }} · {{ jenisEvent(e) }}
              </p>
              <p
                v-if="grand(e)"
                class="num mt-1 text-xs font-semibold text-primary-700"
              >
                {{ rupiah(grand(e)) }}
              </p>
              <div
                v-if="buka === e.id"
                class="mt-2 border-t border-default pt-2"
                @click.stop
              >
                <dl class="grid grid-cols-[3.5rem_1fr] gap-x-2 gap-y-0.5 text-xs">
                  <dt class="text-muted">
                    Client
                  </dt>
                  <dd class="font-semibold">
                    {{ namaClient(e.clientId) }}
                  </dd>
                  <dt class="text-muted">
                    Pax
                  </dt>
                  <dd class="num">
                    {{ e.pax || '—' }}
                  </dd>
                  <dt class="text-muted">
                    Nilai
                  </dt>
                  <dd class="num">
                    {{ grand(e) ? rupiah(grand(e)) : 'belum ada angka' }}
                  </dd>
                </dl>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <UDropdownMenu
                    v-if="can('edit_event')"
                    :items="opsiPindah(e)"
                  >
                    <UButton
                      label="Pindah tahap"
                      size="xs"
                      color="neutral"
                      variant="outline"
                      trailing-icon="i-lucide-chevron-down"
                      class="lg:hidden"
                    />
                  </UDropdownMenu>
                  <UButton
                    label="Buka Event"
                    size="xs"
                    @click="router.push(`/marketing/event/${e.id}`)"
                  />
                </div>
              </div>
            </div>
            <p
              v-if="!k.items.length"
              class="py-3 text-center text-xs text-dimmed"
            >
              -
            </p>
          </div>
        </section>
      </div>

      <!-- Daftar Event -->
      <template v-else>
        <AppPanel>
          <div class="flex flex-wrap items-center gap-2.5">
            <AppSeg
              v-model="periodeSeg"
              :options="PERIODE_EVENT_MKT"
              size="sm"
            />
            <div class="flex items-center gap-1.5">
              <UButton
                icon="i-lucide-chevron-left"
                color="neutral"
                variant="outline"
                size="xs"
                aria-label="Bulan sebelumnya"
                @click="geserBulan(-1)"
              />
              <b
                class="min-w-32 text-center text-sm"
                :class="fe.periode === 'pilih' ? 'text-primary-700' : ''"
              >{{ labelBulan }}</b>
              <UButton
                icon="i-lucide-chevron-right"
                color="neutral"
                variant="outline"
                size="xs"
                aria-label="Bulan berikutnya"
                @click="geserBulan(1)"
              />
              <UButton
                v-if="fe.periode === 'pilih'"
                label="Bulan ini"
                color="neutral"
                variant="outline"
                size="xs"
                @click="bulanIni"
              />
            </div>
            <USelect
              v-model="fStatus"
              :items="opsiStatus"
              class="w-full sm:w-60"
              aria-label="Status"
            />
            <UInput
              v-model="fe.q"
              icon="i-lucide-search"
              placeholder="Cari event / client..."
              class="w-full sm:w-64"
            />
            <UButton
              v-if="!bawaan"
              label="Reset filter"
              icon="i-lucide-rotate-ccw"
              color="neutral"
              variant="outline"
              size="sm"
              @click="reset"
            />
            <span class="text-xs text-muted">{{ hitung }}</span>
          </div>
        </AppPanel>

        <AppPanel flush>
          <div
            v-if="!daftar.length"
            class="p-8 text-center text-sm text-muted"
          >
            <b class="block text-base text-highlighted">{{ kosong.t }}</b>
            {{ kosong.d }}
          </div>
          <template v-else>
            <UTable
              :data="hal"
              :columns="kolomTabel"
              class="hidden lg:block"
              :ui="{ tr: 'cursor-pointer' }"
              @select="(_e: Event, r: { original: EventMkt }) => router.push(`/marketing/event/${r.original.id}`)"
            >
              <template #nama-cell="{ row }">
                <p class="flex flex-wrap items-center gap-1.5 font-semibold text-highlighted">
                  {{ row.original.nama }}
                  <AppStatus
                    :color="warnaJenisMkt(row.original.jenis)"
                    size="sm"
                  >
                    {{ jenisEvent(row.original) }}
                  </AppStatus>
                  <AppStatus
                    v-if="!menuFixMkt(row.original)"
                    color="warning"
                    icon="i-lucide-circle-help"
                    size="sm"
                  >
                    Menu belum ditentukan
                  </AppStatus>
                </p>
                <p class="text-xs text-muted">
                  {{ namaClient(row.original.clientId) }}
                </p>
              </template>
              <template #tanggal-cell="{ row }">
                <p class="num">
                  {{ rentangTglMkt(row.original) }}
                </p>
                <p class="text-xs text-muted">
                  {{ hMinusMkt(row.original.tanggal, hari) }}
                </p>
              </template>
              <template #pax-cell="{ row }">
                <span class="num">{{ row.original.pax || '—' }}</span>
              </template>
              <template #status-cell="{ row }">
                <AppStatus
                  :color="warnaStatusMkt(row.original.status)"
                  :icon="ikonStatusMkt(row.original.status)"
                  size="sm"
                >
                  {{ row.original.status }}
                </AppStatus>
              </template>
              <template #pic-cell="{ row }">
                <span
                  v-if="row.original.mktPIC"
                  class="flex items-center gap-2"
                >
                  <span class="flex size-6 items-center justify-center rounded-md bg-primary-100 text-[10px] font-bold text-primary-800">{{ inisial(namaUser(row.original.mktPIC)) }}</span>
                  {{ depan(row.original.mktPIC) }}
                </span>
                <span
                  v-else
                  class="text-xs text-muted"
                >belum ada PIC</span>
              </template>
              <template #grand-cell="{ row }">
                <span class="num">{{ rupiah(grand(row.original)) }}</span>
              </template>
              <template #dok-cell>
                <div
                  class="flex gap-1"
                  @click.stop
                >
                  <UButton
                    v-for="d in ['Internal', 'Client', 'Draft']"
                    :key="d"
                    :label="d"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    disabled
                    title="Segera — menyusul bersama Event Brief (#59)"
                  />
                </div>
              </template>
              <template #buka-cell>
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-4 text-muted"
                />
              </template>
            </UTable>
            <ul class="divide-y divide-default lg:hidden">
              <li
                v-for="e in hal"
                :key="e.id"
              >
                <NuxtLink
                  :to="`/marketing/event/${e.id}`"
                  class="flex items-start justify-between gap-3 p-4 hover:bg-muted"
                >
                  <span class="min-w-0">
                    <b class="block text-highlighted">{{ e.nama }}</b>
                    <span class="block text-xs text-muted">{{ namaClient(e.clientId) }} · {{ jenisEvent(e) }} · {{ e.pax || '—' }} pax</span>
                    <span class="num block text-xs text-muted">{{ rentangTglMkt(e) }} · {{ hMinusMkt(e.tanggal, hari) }}</span>
                    <span class="mt-1 flex flex-wrap gap-1">
                      <AppStatus
                        :color="warnaStatusMkt(e.status)"
                        :icon="ikonStatusMkt(e.status)"
                        size="sm"
                      >{{ e.status }}</AppStatus>
                      <AppStatus
                        v-if="!menuFixMkt(e)"
                        color="warning"
                        icon="i-lucide-circle-help"
                        size="sm"
                      >Menu belum ditentukan</AppStatus>
                    </span>
                  </span>
                  <span class="shrink-0 text-right">
                    <span class="num block text-sm font-semibold">{{ rupiah(grand(e)) }}</span>
                    <span class="block text-xs text-muted">{{ e.mktPIC ? depan(e.mktPIC) : 'belum ada PIC' }}</span>
                  </span>
                </NuxtLink>
              </li>
            </ul>
            <MarketingPager
              v-model="tbl.hal.value"
              :total="daftar.length"
            />
          </template>
        </AppPanel>
      </template>
    </MarketingGerbang>

    <MarketingEventBaru v-model:open="eventBaru" />

    <ResponsiveSheet
      v-model:open="pindahBuka"
      :title="pindah ? `Pindahkan ke ${pindah.ke}?` : ''"
      :description="pindah?.e.nama"
    >
      <p
        v-if="pindah"
        class="text-sm text-muted"
      >
        Tahapnya berubah dari <b>{{ kolomPipeMkt(pindah.e) }}</b> jadi <b>{{ pindah.ke }}</b>.
        <template v-if="pindah.ke === 'Deal'">
          Task handover per divisi ikut dibuat.
        </template>
        <template v-if="pindah.ke === 'Lost'">
          Event ini berhenti dihitung sebagai peluang aktif.
        </template>
      </p>
      <template #footer>
        <UButton
          label="Ya, pindahkan"
          :loading="sibuk"
          @click="pindahkan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="pindah = null"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
