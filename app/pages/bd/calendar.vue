<!--
  BD OS › Calendar (old `vCalendar`, deploy/bd/index.html:4329-4455).

  One list of everything that has a date: task deadlines (red), milestones
  (violet), unbought POs (blue), unfinished coordination (amber) and team agenda
  (gold). Only a TASK can be dragged to another day; the others have consequences
  outside the calendar and are edited in their own form. The filter is the SAME
  state as Projects. Desktop gets the full grid, a phone gets the day list.
-->
<script setup lang="ts">
import type { BdAgenda, BdTask } from '~/composables/useBd'
import { bdTulisDiam, tambalBd, useBdState, versiBaris } from '~/composables/useBd'
import {
  OWNER_DIVS, PILIHAN_SEMUA, cariAku, isoOf, lingkupIds, pics, poBeres, saringLingkup, selesai, todayISO,
} from '~/utils/bd-rumus'
import BdAgendaSheet from '~/widgets/bd/BdAgendaSheet.vue'
import BdPicFilter from '~/widgets/bd/BdPicFilter.vue'
import { BULAN } from '~/utils/format'

definePageMeta({ access: ['bd'] })

const me = useMe()
const { data: state } = useBdState()
const fPics = useState<string[]>('bd-fPics', () => [])
const f = useState('bd-proj-filter', () => ({ scope: 'tim', div: PILIHAN_SEMUA }))

const people = computed(() => state.value.people)
const aku = computed(() => cariAku(people.value, me.value))
const lingkup = computed(() => lingkupIds(people.value, aku.value?.id, isAdminOf(me.value, 'bd')))
const cocokPic = (o: { pics?: string[], pic?: string }) => !fPics.value.length || pics(o).some(id => fPics.value.includes(id))

interface CalItem { date: string, title: string, jenis: string, tone: 'error' | 'vip' | 'info' | 'warning' | 'gold', id?: string, geser?: boolean }

const items = computed<CalItem[]>(() => {
  const out: CalItem[] = []
  saringLingkup(state.value.tasks, f.value.scope, lingkup.value, aku.value?.id).filter(cocokPic)
    .filter(t => (f.value.div === PILIHAN_SEMUA || t.div === f.value.div) && t.deadline && !selesai(t))
    .forEach(t => out.push({ date: t.deadline, title: t.name, jenis: 'Deadline', tone: 'error', id: t.id, geser: true }))
  saringLingkup(state.value.projects, f.value.scope, lingkup.value, aku.value?.id).filter(cocokPic)
    .filter(p => f.value.div === PILIHAN_SEMUA || p.div === f.value.div)
    .forEach(p => (p.milestones || []).forEach((ms) => {
      if (ms.date) out.push({ date: ms.date, title: `${ms.t} (${p.name})`, jenis: 'Milestone', tone: 'vip' })
    }))
  state.value.po.filter(o => !poBeres(o) && o.needBy && (f.value.div === PILIHAN_SEMUA || o.div === f.value.div) && (!fPics.value.length || fPics.value.includes(o.pic)))
    .forEach(o => out.push({ date: o.needBy, title: `PO: ${o.item}`, jenis: 'PO', tone: 'info' }))
  state.value.coord.filter(c => c.status !== 'Selesai' && c.due)
    .forEach(c => out.push({ date: c.due, title: `Koord: ${c.title}`, jenis: 'Koordinasi', tone: 'warning' }))
  state.value.agenda.forEach((e) => {
    if (e.date) out.push({ date: e.date, title: e.title, jenis: e.type || 'Agenda', tone: 'gold', id: e.id })
  })
  return out
})

const awal = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const label = computed(() => `${BULAN[awal.value.getMonth()]} ${awal.value.getFullYear()}`)
function geserBulan(n: number) {
  awal.value = new Date(awal.value.getFullYear(), awal.value.getMonth() + n, 1)
}
function bulanIni() {
  const d = new Date()
  awal.value = new Date(d.getFullYear(), d.getMonth(), 1)
}

const hariIni = todayISO()
const sel = computed(() => {
  const y = awal.value.getFullYear()
  const mo = awal.value.getMonth()
  const mulaiDow = (new Date(y, mo, 1).getDay() + 6) % 7
  const jml = new Date(y, mo + 1, 0).getDate()
  const out: { iso: string, hari: number, luar: boolean, items: CalItem[] }[] = []
  const push = (d: Date, luar: boolean) => {
    const iso = isoOf(d)
    out.push({ iso, hari: d.getDate(), luar, items: items.value.filter(x => x.date === iso) })
  }
  for (let i = 0; i < mulaiDow; i++) push(new Date(y, mo, 1 - mulaiDow + i), true)
  for (let d = 1; d <= jml; d++) push(new Date(y, mo, d), false)
  const total = mulaiDow + jml
  for (let k = total; k < Math.ceil(total / 7) * 7; k++) push(new Date(y, mo, jml + (k - total) + 1), true)
  return out
})
/** Phone: one row per day of the month that has something. */
const hariBerisi = computed(() => sel.value.filter(c => !c.luar && c.items.length))

const skop = [
  { value: 'tim', label: 'Tim saya' },
  { value: 'saya', label: 'Ditugaskan ke saya' },
  { value: 'semua', label: 'Semua' },
]
const opsiDiv = [{ value: PILIHAN_SEMUA, label: 'Semua divisi' }, ...OWNER_DIVS.map(d => ({ value: d, label: d }))]
const resetAktif = computed(() => fPics.value.length || f.value.div !== PILIHAN_SEMUA || f.value.scope !== 'tim')
function reset() {
  fPics.value = []
  f.value = { ...f.value, div: PILIHAN_SEMUA, scope: 'tim' }
}

// ---- agenda sheet & task drag ----
const bukaAgenda = ref(false)
const agendaPilih = ref<BdAgenda | null>(null)
function bukaAgendaSheet(e?: BdAgenda) {
  agendaPilih.value = e || null
  bukaAgenda.value = true
}

let dragId: string | null = null
function dragMulai(ev: DragEvent, id: string) {
  dragId = id
  ev.dataTransfer?.setData('text/plain', id)
}
function dropHari(iso: string) {
  const t = state.value.tasks.find(x => x.id === dragId) as BdTask | undefined
  dragId = null
  if (!t || t.deadline === iso) return
  bdTulisDiam(() => tambalBd<BdTask>('tasks', t.id, { deadline: iso }, versiBaris(t)))
}
</script>

<template>
  <AppPage
    title="Calendar"
    description="Deadline, milestone & agenda."
  >
    <template #actions>
      <div class="inline-flex items-center overflow-hidden rounded-full border border-default">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Bulan sebelumnya"
          @click="geserBulan(-1)"
        />
        <span class="px-2 text-sm font-semibold text-highlighted">{{ label }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Bulan berikutnya"
          @click="geserBulan(1)"
        />
      </div>
      <UButton
        label="Bulan ini"
        color="neutral"
        variant="outline"
        size="sm"
        @click="bulanIni"
      />
      <UButton
        label="Agenda"
        icon="i-lucide-plus"
        @click="bukaAgendaSheet()"
      />
    </template>

    <AppPanel>
      <AppFilterGrid>
        <UFormField label="Lingkup">
          <USelect
            v-model="f.scope"
            :items="skop"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Divisi">
          <USelect
            v-model="f.div"
            :items="opsiDiv"
            class="w-full"
          />
        </UFormField>
      </AppFilterGrid>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <BdPicFilter
          v-model="fPics"
          :people="people"
        />
        <div class="flex-1" />
        <UButton
          v-if="resetAktif"
          label="Reset"
          icon="i-lucide-x"
          color="neutral"
          variant="outline"
          size="sm"
          @click="reset"
        />
      </div>
    </AppPanel>

    <AppPanel
      title="Kalender"
      icon="i-lucide-calendar-days"
      :description="label"
    >
      <div class="hidden lg:block">
        <div class="grid grid-cols-7 gap-1">
          <div
            v-for="d in ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']"
            :key="d"
            class="px-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted"
          >
            {{ d }}
          </div>
          <div
            v-for="c in sel"
            :key="c.iso"
            class="min-h-24 rounded-field border p-1.5"
            :class="[c.luar ? 'border-default bg-muted/40 opacity-60' : 'border-default bg-default', c.iso === hariIni ? 'ring-2 ring-primary-400' : '']"
            @dragover.prevent
            @drop="dropHari(c.iso)"
          >
            <span
              class="text-xs font-semibold"
              :class="c.iso === hariIni ? 'text-primary-700' : 'text-muted'"
            >{{ c.hari }}</span>
            <div class="mt-1 grid gap-1">
              <span
                v-for="(e, i) in c.items.slice(0, 4)"
                :key="i"
                class="block truncate rounded border px-1 py-0.5 text-[10.5px] font-semibold"
                :class="[
                  e.tone === 'error' ? 'border-error/40 bg-error/10 text-error'
                  : e.tone === 'vip' ? 'border-vip/40 bg-vip/10 text-vip'
                    : e.tone === 'info' ? 'border-info/40 bg-info/10 text-info'
                      : e.tone === 'warning' ? 'border-warning/40 bg-warning/10 text-warning'
                        : 'border-primary-400/40 bg-primary-100 text-primary-800',
                  e.geser ? 'cursor-grab' : '',
                ]"
                :title="`${e.jenis} — ${e.title}`"
                :draggable="e.geser ? 'true' : 'false'"
                @dragstart="e.geser && e.id && dragMulai($event, e.id)"
              >{{ e.title }}</span>
              <span
                v-if="c.items.length > 4"
                class="text-[10px] text-dimmed"
              >+{{ c.items.length - 4 }} lagi</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-3 lg:hidden">
        <div
          v-for="c in hariBerisi"
          :key="c.iso"
          class="rounded-field border border-default p-3"
          :class="c.iso === hariIni ? 'ring-2 ring-primary-400' : ''"
        >
          <p
            class="text-sm font-semibold"
            :class="c.iso === hariIni ? 'text-primary-700' : 'text-highlighted'"
          >
            {{ c.hari }} — {{ c.items.length }} agenda
          </p>
          <div class="mt-2 grid gap-1.5">
            <span
              v-for="(e, i) in c.items"
              :key="i"
              class="block rounded border px-2 py-1 text-xs font-semibold"
              :class="e.tone === 'error' ? 'border-error/40 bg-error/10 text-error'
                : e.tone === 'vip' ? 'border-vip/40 bg-vip/10 text-vip'
                  : e.tone === 'info' ? 'border-info/40 bg-info/10 text-info'
                    : e.tone === 'warning' ? 'border-warning/40 bg-warning/10 text-warning'
                      : 'border-primary-400/40 bg-primary-100 text-primary-800'"
            >{{ e.jenis }} — {{ e.title }}</span>
          </div>
        </div>
        <p
          v-if="!hariBerisi.length"
          class="py-6 text-center text-sm text-muted"
        >
          <b class="block text-highlighted">Tidak ada agenda bulan ini</b>
        </p>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-default pt-3 text-xs text-muted">
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-error" /> Deadline task</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-vip" /> Milestone</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-info" /> PO</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-warning" /> Koordinasi</span>
        <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-primary-400" /> Agenda tim</span>
        <span class="text-primary-700">Seret <b>deadline task</b> ke kotak lain untuk memindahkan tanggalnya (di HP: buka task dan ubah deadlinenya).</span>
      </div>
    </AppPanel>

    <BdAgendaSheet
      v-model:open="bukaAgenda"
      :agenda="agendaPilih"
      :people="people"
      :aku="aku"
    />
  </AppPage>
</template>
