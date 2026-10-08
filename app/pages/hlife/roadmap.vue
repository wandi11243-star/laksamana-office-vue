<!--
  Roadmap & Dreams — the old viewRoadmap (howandi_life/index.html:688-696).
  Timeline per year with the linked goals' progress, and Dreams grouped by
  category. milestoneProgress averages the linked goals (`:724`).
-->
<script setup lang="ts">
import type { HlifeDream, HlifeGoal, HlifeMilestone } from '~/composables/useHlife'
import {
  createHlifeRecord, deleteHlifeRecord, updateHlifeRecord,
  useHlifeResource,
} from '~/composables/useHlife'
import { DREAM_CAT, DREAM_STATUS, persenGoal, persenMilestone } from '~/utils/hlife'
import { PILIHAN_TANPA } from '~/utils/bd-rumus'
import { lencanaMimpi } from '~/utils/status-hlife'

definePageMeta({ access: ['howandi_life'] })

const toast = useToast()
const tahun = new Date().getFullYear()

const { data: roadmapData, refresh: refreshRoadmap } = useHlifeResource<HlifeMilestone>('roadmap')
const { data: dreamData, refresh: refreshDream } = useHlifeResource<HlifeDream>('dreams')
const { data: goalData } = useHlifeResource<HlifeGoal>('goals')

const roadmap = computed(() => roadmapData.value.rows)
const dreams = computed(() => dreamData.value.rows)
const goals = computed(() => goalData.value.rows)

const tampilan = ref<'timeline' | 'dreams'>('timeline')
const TAMPILAN: { value: 'timeline' | 'dreams', label: string }[] = [
  { value: 'timeline', label: 'Roadmap' },
  { value: 'dreams', label: 'Dreams' },
]

const tahunList = computed(() => [...new Set(roadmap.value.map(r => r.year))].sort())
const goalsMilestone = (id: string) => goals.value.filter(g => g.milestone === id)
const dreamsMilestone = (id: string) => dreams.value.filter(d => d.milestone === id)

const grupMimpi = computed(() => Object.keys(DREAM_CAT).map(cat => ({
  cat,
  meta: DREAM_CAT[cat]!,
  items: dreams.value.filter(d => d.cat === cat),
})).filter(g => g.items.length))

const opsiMilestone = computed(() => [
  { value: PILIHAN_TANPA, label: '— Tidak terhubung —' },
  ...roadmap.value.slice().sort((a, b) => a.year - b.year).map(r => ({ value: r.id, label: `${r.year} · ${r.title}` })),
])
const opsiCat = Object.keys(DREAM_CAT).map(c => ({ value: c, label: DREAM_CAT[c]!.label }))
const opsiStatus = DREAM_STATUS.map(s => ({ value: s as string, label: s }))

// --- milestone sheet (`:907-911`) -------------------------------------------

const sheetMile = ref(false)
const sibuk = ref(false)
const formMile = reactive({ id: '', title: '', desc: '', year: String(tahun + 1) })

function bukaMile(r?: HlifeMilestone) {
  Object.assign(formMile, r
    ? { id: r.id, title: r.title, desc: r.desc || '', year: r.year ? String(r.year) : String(tahun) }
    : { id: '', title: '', desc: '', year: String(tahun + 1) })
  sheetMile.value = true
}

async function simpanMile() {
  const title = formMile.title.trim()
  if (!title) {
    toast.add({ title: 'Isi milestone dulu.', color: 'error' })
    return
  }
  const body = { title, desc: formMile.desc, year: Number(formMile.year) || tahun }
  sibuk.value = true
  try {
    if (formMile.id) {
      const versi = roadmapData.value.versions[formMile.id]
      if (versi === undefined) {
        toast.add({ title: 'Versi milestone belum terbaca. Muat ulang halaman.', color: 'error' })
        return
      }
      await updateHlifeRecord('roadmap', formMile.id, { ...body, id: formMile.id, done: roadmap.value.find(r => r.id === formMile.id)?.done ?? false }, versi)
    }
    else {
      await createHlifeRecord<HlifeMilestone>('roadmap', { ...body, done: false })
    }
    await refreshRoadmap()
    sheetMile.value = false
    toast.add({ title: 'Milestone tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshRoadmap))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function toggleMile(r: HlifeMilestone) {
  const versi = roadmapData.value.versions[r.id]
  if (versi === undefined) {
    toast.add({ title: 'Versi milestone belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  try {
    await updateHlifeRecord('roadmap', r.id, { ...r, done: !r.done }, versi)
    await refreshRoadmap()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshRoadmap))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const hapusMileSheet = ref(false)
const mileHapus = ref<HlifeMilestone | null>(null)
function tanyaHapusMile(r: HlifeMilestone) {
  mileHapus.value = r
  hapusMileSheet.value = true
}
async function hapusMile() {
  const r = mileHapus.value
  hapusMileSheet.value = false
  if (!r) return
  const versi = roadmapData.value.versions[r.id]
  if (versi === undefined) return
  sibuk.value = true
  try {
    await deleteHlifeRecord('roadmap', r.id, versi)
    await refreshRoadmap()
    toast.add({ title: 'Milestone dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshRoadmap))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

// --- dream sheet (`:912-915`) -----------------------------------------------

const sheetDream = ref(false)
const formDream = reactive({ id: '', title: '', cat: 'Travel', status: 'Someday', year: '', note: '', milestone: '' })

function bukaDream(d?: HlifeDream) {
  Object.assign(formDream, d
    ? { id: d.id, title: d.title, cat: d.cat || 'Travel', status: d.status || 'Someday', year: d.year != null ? String(d.year) : '', note: d.note || '', milestone: d.milestone || PILIHAN_TANPA }
    : { id: '', title: '', cat: 'Travel', status: 'Someday', year: '', note: '', milestone: PILIHAN_TANPA })
  sheetDream.value = true
}

async function simpanDream() {
  const title = formDream.title.trim()
  if (!title) {
    toast.add({ title: 'Isi mimpinya dulu.', color: 'error' })
    return
  }
  const yr = String(formDream.year ?? '').trim()
  const year = yr ? (Number.isFinite(Number(yr)) ? Number(yr) : yr) : ''
  const body = { title, cat: formDream.cat, status: formDream.status, year, note: formDream.note, milestone: formDream.milestone === PILIHAN_TANPA ? '' : formDream.milestone }
  sibuk.value = true
  try {
    if (formDream.id) {
      const versi = dreamData.value.versions[formDream.id]
      if (versi === undefined) {
        toast.add({ title: 'Versi mimpi belum terbaca. Muat ulang halaman.', color: 'error' })
        return
      }
      await updateHlifeRecord('dreams', formDream.id, { ...body, id: formDream.id }, versi)
    }
    else {
      await createHlifeRecord<HlifeDream>('dreams', body)
    }
    await refreshDream()
    sheetDream.value = false
    toast.add({ title: 'Mimpi tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshDream))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function toggleDream(d: HlifeDream) {
  const versi = dreamData.value.versions[d.id]
  if (versi === undefined) {
    toast.add({ title: 'Versi mimpi belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  try {
    await updateHlifeRecord('dreams', d.id, { ...d, status: d.status === 'Done' ? 'Planning' : 'Done' }, versi)
    await refreshDream()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshDream))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

const hapusDreamSheet = ref(false)
const dreamHapus = ref<HlifeDream | null>(null)
function tanyaHapusDream(d: HlifeDream) {
  dreamHapus.value = d
  hapusDreamSheet.value = true
}
async function hapusDream() {
  const d = dreamHapus.value
  hapusDreamSheet.value = false
  if (!d) return
  const versi = dreamData.value.versions[d.id]
  if (versi === undefined) return
  sibuk.value = true
  try {
    await deleteHlifeRecord('dreams', d.id, versi)
    await refreshDream()
    toast.add({ title: 'Mimpi dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refreshDream))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    title="Roadmap & Dreams"
    description="Target karir & hidup per tahun, dan semua mimpi masa depan."
  >
    <template #actions>
      <div class="flex flex-wrap items-center gap-2">
        <AppSeg
          v-model="tampilan"
          :options="TAMPILAN"
          size="sm"
        />
        <UButton
          label="Tambah"
          icon="i-lucide-plus"
          @click="tampilan === 'timeline' ? bukaMile() : bukaDream()"
        />
      </div>
    </template>

    <!-- Timeline -->
    <template v-if="tampilan === 'timeline'">
      <AppPanel
        v-for="y in tahunList"
        :key="y"
        :title="`${y}`"
        :count="`${roadmap.filter(r => r.year === y && r.done).length}/${roadmap.filter(r => r.year === y).length}`"
      >
        <div class="divide-y divide-default">
          <div
            v-for="r in roadmap.filter(x => x.year === y)"
            :key="r.id"
            class="flex items-start gap-3 py-3"
          >
            <button
              type="button"
              class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-primary"
              :class="r.done ? 'border-success bg-success text-white' : 'border-default bg-default text-transparent hover:border-success'"
              :aria-label="r.done ? 'Tandai belum selesai' : 'Tandai selesai'"
              @click="toggleMile(r)"
            >
              <UIcon
                name="i-lucide-check"
                class="size-3.5"
              />
            </button>
            <div class="min-w-0 flex-1">
              <p
                class="font-semibold"
                :class="r.done ? 'text-dimmed line-through' : 'text-highlighted'"
              >
                {{ r.title }}
                <span
                  v-if="goalsMilestone(r.id).length"
                  class="text-primary-700 num"
                >· {{ persenMilestone(r, goals) }}%</span>
              </p>
              <p
                v-if="r.desc"
                class="text-sm text-muted"
              >
                {{ r.desc }}
              </p>
              <div
                v-if="goalsMilestone(r.id).length"
                class="mt-2 space-y-1"
              >
                <div
                  v-for="g in goalsMilestone(r.id)"
                  :key="g.id"
                  class="flex items-center gap-2 text-xs"
                >
                  <UIcon
                    name="i-lucide-target"
                    class="size-3.5 shrink-0 text-primary-600"
                  />
                  <ULink
                    to="/hlife/goals"
                    class="min-w-0 flex-1 truncate text-muted hover:text-highlighted"
                  >
                    {{ g.name }}
                  </ULink>
                  <span class="shrink-0 text-muted num">{{ persenGoal(g) }}%</span>
                </div>
              </div>
              <div
                v-if="dreamsMilestone(r.id).length"
                class="mt-2 flex flex-wrap gap-1"
              >
                <ULink
                  v-for="d in dreamsMilestone(r.id)"
                  :key="d.id"
                  to="/hlife/roadmap"
                >
                  <AppStatus
                    size="sm"
                    :color="lencanaMimpi(d.status).color"
                    :icon="DREAM_CAT[d.cat]?.icon ?? 'i-lucide-sparkles'"
                  >
                    {{ d.title }}
                  </AppStatus>
                </ULink>
              </div>
            </div>
            <div class="flex shrink-0 gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Ubah milestone"
                @click="bukaMile(r)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Hapus milestone"
                @click="tanyaHapusMile(r)"
              />
            </div>
          </div>
        </div>
      </AppPanel>
      <p
        v-if="!roadmap.length"
        class="rounded-panel border border-dashed border-default bg-default px-6 py-10 text-center text-muted shadow-panel"
      >
        Belum ada milestone. Tambahkan target karir/hidup pertama.
      </p>
    </template>

    <!-- Dreams -->
    <template v-else>
      <AppPanel
        v-for="g in grupMimpi"
        :key="g.cat"
        :title="g.meta.label"
        :count="g.items.length"
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="d in g.items"
            :key="d.id"
            class="flex items-start gap-3 rounded-field border border-default p-3"
          >
            <AppStatus
              size="sm"
              :color="g.meta.tone"
              :icon="g.meta.icon"
            >
              {{ d.cat }}
            </AppStatus>
            <div class="min-w-0 flex-1">
              <p
                class="font-semibold"
                :class="d.status === 'Done' ? 'text-dimmed line-through' : 'text-highlighted'"
              >
                {{ d.title }}
              </p>
              <div class="mt-1 flex flex-wrap gap-1">
                <AppStatus
                  size="sm"
                  :color="lencanaMimpi(d.status).color"
                  :icon="lencanaMimpi(d.status).icon"
                >
                  {{ lencanaMimpi(d.status).label }}
                </AppStatus>
                <AppStatus
                  v-if="d.year"
                  size="sm"
                  color="neutral"
                  icon="i-lucide-calendar"
                >
                  {{ d.year }}
                </AppStatus>
              </div>
              <p
                v-if="d.note"
                class="mt-1 text-xs text-muted"
              >
                {{ d.note }}
              </p>
              <ULink
                v-if="d.milestone"
                to="/hlife/roadmap"
                class="mt-1 inline-block"
              >
                <AppStatus
                  size="sm"
                  color="vip"
                  icon="i-lucide-map"
                >
                  → {{ opsiMilestone.find(o => o.value === d.milestone)?.label || 'Milestone' }}
                </AppStatus>
              </ULink>
            </div>
            <div class="flex shrink-0 flex-col gap-1">
              <UButton
                icon="i-lucide-check"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Tandai selesai"
                @click="toggleDream(d)"
              />
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Ubah mimpi"
                @click="bukaDream(d)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Hapus mimpi"
                @click="tanyaHapusDream(d)"
              />
            </div>
          </div>
        </div>
      </AppPanel>
      <div class="text-center">
        <UButton
          label="Tambah mimpi"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          @click="bukaDream()"
        />
      </div>
    </template>

    <!-- Milestone form -->
    <ResponsiveSheet
      v-model:open="sheetMile"
      :title="formMile.id ? 'Edit milestone' : 'Milestone baru'"
    >
      <div class="space-y-4">
        <UFormField
          label="Milestone (target karir/hidup)"
          required
        >
          <UInput
            v-model="formMile.title"
            placeholder="mis. Menikah / beli rumah / 10 cabang"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Deskripsi singkat">
          <UInput
            v-model="formMile.desc"
            placeholder="Detail / target ukur…"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tahun target">
          <UInput
            v-model="formMile.year"
            type="number"
            size="xl"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          :label="formMile.id ? 'Simpan' : 'Tambah'"
          size="xl"
          :loading="sibuk"
          @click="simpanMile"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetMile = false"
        />
      </template>
    </ResponsiveSheet>

    <!-- Dream form -->
    <ResponsiveSheet
      v-model:open="sheetDream"
      :title="formDream.id ? 'Edit mimpi' : 'Mimpi baru'"
    >
      <div class="space-y-4">
        <UFormField
          label="Mimpi / bucket list"
          required
        >
          <UInput
            v-model="formDream.title"
            placeholder="mis. Kunjungi Jepang / ambil S2"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Kategori">
            <USelect
              v-model="formDream.cat"
              :items="opsiCat"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status">
            <USelect
              v-model="formDream.status"
              :items="opsiStatus"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Target tahun (opsional)">
            <UInput
              v-model="formDream.year"
              placeholder="mis. 2027"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Catatan">
            <UInput
              v-model="formDream.note"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Terhubung ke milestone (Roadmap)">
          <USelect
            v-model="formDream.milestone"
            :items="opsiMilestone"
            size="xl"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          :label="formDream.id ? 'Simpan' : 'Tambah'"
          size="xl"
          :loading="sibuk"
          @click="simpanDream"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetDream = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusMileSheet"
      title="Hapus milestone?"
      :description="mileHapus?.title"
    >
      <p class="text-sm text-muted">
        Goal yang tertaut tidak ikut terhapus.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          :loading="sibuk"
          @click="hapusMile"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="hapusMileSheet = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusDreamSheet"
      title="Hapus mimpi?"
      :description="dreamHapus?.title"
    >
      <p class="text-sm text-muted">
        Mimpi ini akan dihapus permanen.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          :loading="sibuk"
          @click="hapusDream"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="hapusDreamSheet = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
