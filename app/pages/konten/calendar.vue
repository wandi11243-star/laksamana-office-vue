<!--
  Konten › Content Calendar (old VIEWS.calendar + moveCalEvent,
  deploy/konten/index.html:2608-2680; konten.md D.4). Month grid Mon–Sun, six
  rows, max three events per cell + "+n lagi"; the legend toggles each kind.
  Dragging an event to another day moves it (desktop): publish needs edit on
  `content`, a KOL visit needs edit on `kol`, production needs and tasks move
  freely — as in the old client.

  Correction vs the old client: cells and "today" use LOCAL dates. The old grid
  built each cell's date with toISOString() from local midnight, which in WIB
  is the PREVIOUS day, so every cell showed the day before's events.
-->
<script setup lang="ts">
import type { AcaraKalender, FilterKalender, KontenItem } from '~/utils/konten'
import { PROD_TYPES, acaraKalender } from '~/utils/konten'
import { ikonAcaraKonten, warnaAcaraKonten } from '~/utils/status-konten'
import { fTgl, hariIni } from '~/utils/format'

// Kalender: one tab with two views — Jadwal tayang (this grid) and Rencana posting (KontenKalenderPosting).
const tampil = ref<'tayang' | 'posting'>(useRoute().query.tampil === 'posting' ? 'posting' : 'tayang')

definePageMeta({ access: ['konten'] })

const router = useRouter()
const toast = useToast()
const { data: st, error } = useStateKonten()
const { can } = useAksesKonten()
const brand = useBrandKonten()
const f = useState<FilterKalender>('konten-cal-filter', () => ({ publish: true, shoot: true, design: true, edit: true, visit: true }))
const bulan = useState('konten-cal-bulan', () => hariIni().slice(0, 7))

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hari = hariIni()
const judul = computed(() => new Date(`${bulan.value}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))
function geserBulan(n: number) {
  const d = new Date(`${bulan.value}-01T00:00:00`)
  d.setMonth(d.getMonth() + n)
  bulan.value = iso(d).slice(0, 7)
}

/** 6×7 cells starting on Monday (:2610-2617). */
const sel = computed(() => {
  const [y, m] = bulan.value.split('-').map(Number)
  const first = new Date(y!, m! - 1, 1)
  const mulai = new Date(first)
  mulai.setDate(1 - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(mulai)
    d.setDate(mulai.getDate() + i)
    return { d: d.getDate(), tgl: iso(d), lain: d.getMonth() !== m! - 1 }
  })
})

const acara = computed(() => acaraKalender({
  content: saringBrand(st.value.content, brand.value),
  prodTasks: saringBrand(st.value.prodTasks, brand.value),
  shootings: saringBrand(st.value.shootings, brand.value),
  visits: saringBrand(st.value.visits, brand.value),
  namaKol: id => st.value.kols.find(k => k.id === id)?.name ?? '',
}, f.value))
const perTgl = computed(() => {
  const m = new Map<string, AcaraKalender[]>()
  for (const e of acara.value) m.set(e.date, [...(m.get(e.date) ?? []), e])
  return m
})

const legenda = [
  { k: 'publish', l: 'Tayang' },
  { k: 'shoot', l: PROD_TYPES.shoot.label },
  { k: 'design', l: PROD_TYPES.design.label },
  { k: 'edit', l: PROD_TYPES.edit.label },
  { k: 'visit', l: 'Kunjungan KOL & Medpar' },
] as const

/** Where an event leads (old calOpenEvent): content → detail, visit → its form, task → its form. */
function buka(e: AcaraKalender) {
  if (e.cid) return router.push(`/konten/detail/${e.cid}`)
  if (e.vid) return router.push(`/konten/kol?tab=visit&buka=${e.vid}`)
  if (e.kind && e.tid) return router.push(`/konten/${PROD_TYPES[e.kind].view}?buka=${e.tid}`)
  if (e.kind) return router.push(`/konten/${PROD_TYPES[e.kind].view}`)
  return router.push('/konten/shooting')
}

// ---- +n lagi: the day's full list (calDay) ----
const hariBuka = ref<string | null>(null)
const hariSheet = computed({ get: () => !!hariBuka.value, set: (v) => {
  if (!v) hariBuka.value = null
} })

// ---- drag & drop to another day (moveCalEvent, :2656-2668) ----
const seret = ref<AcaraKalender | null>(null)
const atas = ref<string | null>(null)
async function lepas(tgl: string) {
  atas.value = null
  const e = seret.value
  seret.value = null
  if (!e || e.date === tgl) return
  const pesan = `Jadwal dipindah ke ${fTgl(tgl)}`
  if (e.cid) {
    const c = st.value.content.find(x => x.id === e.cid)
    if (!c) return
    if (e.type === 'publish') {
      if (!can('content')) return toast.add({ title: 'Tidak punya akses ubah jadwal', color: 'error' })
      return kontenSimpan(() => tambalKonten<KontenItem>('content', c.id, { publishDate: tgl }, c.updatedAt), pesan, { action: 'menggeser jadwal tayang', target: c.title })
    }
    if (e.type === 'visit' || !c.prod?.[e.type]) return
    const prod = { ...c.prod, [e.type]: { ...c.prod[e.type], date: tgl } }
    return kontenSimpan(() => tambalKonten<KontenItem>('content', c.id, { prod }, c.updatedAt), pesan, { action: `menggeser jadwal ${e.type}`, target: c.title })
  }
  if (e.sid) {
    const s = st.value.shootings.find(x => x.id === e.sid)
    if (s) return kontenSimpan(() => tambalKonten('shootings', s.id, { date: tgl }, s.updatedAt), pesan, { action: 'menggeser shooting', target: s.title || 'Shooting' })
    return
  }
  if (e.tid) {
    const t = st.value.prodTasks.find(x => x.id === e.tid)
    if (t) return kontenSimpan(() => tambalKonten('prod-tasks', t.id, { date: tgl }, t.updatedAt), pesan, { action: 'menggeser tugas produksi', target: t.title })
    return
  }
  if (e.vid) {
    const v = st.value.visits.find(x => x.id === e.vid)
    if (!v) return
    if (!can('kol')) return toast.add({ title: 'Tidak punya akses ubah jadwal', color: 'error' })
    return kontenSimpan(() => tambalKonten('visits', v.id, { date: tgl }, v.updatedAt), pesan, { action: 'menggeser event kunjungan', target: e.title })
  }
}
</script>

<template>
  <KontenGerbang lihat="calendar">
    <AppPage
      title="Kalender"
      :description="tampil === 'posting' ? 'Rencana posting & pengingat tayang' : 'Jadwal tayang lintas brand'"
    >
      <AppSeg
        v-model="tampil"
        class="mb-4"
        :options="[{ value: 'tayang', label: 'Jadwal tayang', icon: 'i-lucide-calendar' }, { value: 'posting', label: 'Rencana posting', icon: 'i-lucide-calendar-clock' }]"
      />
      <KontenKalenderPosting v-if="tampil === 'posting'" />
      <template v-else>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
        />

        <KontenBrandBar :brands="st.brands" />

        <AppPanel>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="outline"
              size="sm"
              aria-label="Bulan sebelumnya"
              @click="geserBulan(-1)"
            />
            <span class="min-w-36 text-center font-display text-lg font-semibold capitalize">{{ judul }}</span>
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="outline"
              size="sm"
              aria-label="Bulan berikutnya"
              @click="geserBulan(1)"
            />
            <UButton
              label="Hari ini"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="bulan = hari.slice(0, 7)"
            />
            <div class="flex flex-wrap gap-1.5 lg:ml-auto">
              <button
                v-for="x in legenda"
                :key="x.k"
                type="button"
                class="rounded-full transition-opacity"
                :class="f[x.k] ? '' : 'opacity-40'"
                :aria-pressed="f[x.k]"
                @click="f[x.k] = !f[x.k]"
              >
                <AppStatus
                  :color="warnaAcaraKonten(x.k)"
                  :icon="ikonAcaraKonten(x.k)"
                  size="sm"
                >
                  {{ x.l }}
                </AppStatus>
              </button>
            </div>
          </div>
          <p class="mt-2 hidden text-xs text-muted lg:block">
            Seret (drag & drop) event ke tanggal lain untuk memindahkan jadwal.
          </p>
        </AppPanel>

        <AppPanel flush>
          <div class="grid grid-cols-7 border-b border-default text-center text-[11px] font-bold tracking-wide text-muted uppercase">
            <div
              v-for="d in ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']"
              :key="d"
              class="py-2"
            >
              {{ d }}
            </div>
          </div>
          <div class="grid grid-cols-7">
            <div
              v-for="s in sel"
              :key="s.tgl"
              class="min-h-20 min-w-0 border-r border-b border-default p-1 lg:min-h-28 lg:p-1.5"
              :class="[s.lain ? 'bg-muted/60' : '', s.tgl === hari ? 'bg-primary-50' : '', atas === s.tgl ? 'ring-2 ring-primary-400 ring-inset' : '']"
              @dragover.prevent="atas = s.tgl"
              @dragleave="atas === s.tgl && (atas = null)"
              @drop.prevent="lepas(s.tgl)"
            >
              <p
                class="num mb-1 text-xs"
                :class="s.lain ? 'text-dimmed' : 'text-muted'"
              >
                <span :class="s.tgl === hari ? 'tgl-bulat' : ''">{{ s.d }}</span>
              </p>
              <button
                v-for="(e, i) in (perTgl.get(s.tgl) ?? []).slice(0, 3)"
                :key="i"
                type="button"
                draggable="true"
                class="mb-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[10.5px] leading-tight lg:text-[11px]"
                :class="[
                  { success: 'bg-success/12 text-success', info: 'bg-info/12 text-info', vip: 'bg-vip/12 text-vip', warning: 'bg-warning/12 text-warning', gold: 'bg-primary-100 text-primary-800', neutral: 'bg-muted text-muted', error: 'bg-error/12 text-error' }[warnaAcaraKonten(e.type)],
                  e.done ? 'line-through opacity-55' : '',
                ]"
                :title="`${e.label}: ${e.title}`"
                @dragstart="seret = e"
                @dragend="seret = null; atas = null"
                @click="buka(e)"
              >
                <b class="hidden lg:inline">{{ e.label }}</b> {{ e.title }}
              </button>
              <button
                v-if="(perTgl.get(s.tgl)?.length ?? 0) > 3"
                type="button"
                class="text-[10.5px] font-semibold text-primary-700"
                @click="hariBuka = s.tgl"
              >
                +{{ (perTgl.get(s.tgl)?.length ?? 0) - 3 }} lagi
              </button>
            </div>
          </div>
        </AppPanel>

        <ResponsiveSheet
          v-model:open="hariSheet"
          :title="hariBuka ? fTgl(hariBuka) : ''"
        >
          <ul class="divide-y divide-default">
            <li
              v-for="(e, i) in (hariBuka ? perTgl.get(hariBuka) ?? [] : [])"
              :key="i"
            >
              <button
                type="button"
                class="flex w-full items-center gap-3 py-2.5 text-left"
                :class="e.done ? 'line-through opacity-55' : ''"
                @click="hariBuka = null; buka(e)"
              >
                <AppStatus
                  :color="warnaAcaraKonten(e.type)"
                  :icon="ikonAcaraKonten(e.type)"
                  size="sm"
                >
                  {{ e.label }}
                </AppStatus>
                <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ e.title }}</span>
                <span
                  v-if="e.time"
                  class="num text-xs text-muted"
                >{{ e.time }}</span>
              </button>
            </li>
          </ul>
        </ResponsiveSheet>
      </template>
    </AppPage>
  </KontenGerbang>
</template>
