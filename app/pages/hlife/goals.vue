<!--
  Goals — the old viewGoals (howandi_life/index.html:682-686). One card per
  goal with the percentage gauge, now/target, and its optional Roadmap
  milestone link. goalPct handles the legacy inverted goal (F, `:557`).
-->
<script setup lang="ts">
import type { HlifeGoal, HlifeMilestone } from '~/composables/useHlife'
import {
  createHlifeRecord, deleteHlifeRecord, updateHlifeRecord,
  useHlifeResource,
} from '~/composables/useHlife'
import { GOAL_AREAS, PILIHAN_TANPA, persenGoal } from '~/utils/hlife'
import { angka } from '~/utils/format'

definePageMeta({ access: ['howandi_life'] })

const toast = useToast()
const tahun = new Date().getFullYear()

const { data: goalData, status, refresh: refreshGoal } = useHlifeResource<HlifeGoal>('goals')
const { data: roadmapData } = useHlifeResource<HlifeMilestone>('roadmap')

const goals = computed(() => goalData.value.rows)
const roadmap = computed(() => roadmapData.value.rows)

const labelMilestone = (id: string) => {
  const r = roadmap.value.find(x => x.id === id)
  return r ? `${r.year} · ${r.title}` : ''
}

const opsiArea = GOAL_AREAS.map(a => ({ value: a as string, label: a }))
const opsiMilestone = computed(() => [
  { value: PILIHAN_TANPA, label: '— Tidak terhubung —' },
  ...roadmap.value.slice().sort((a, b) => a.year - b.year).map(r => ({ value: r.id, label: `${r.year} · ${r.title}` })),
])

// --- goal sheet (`:901-904`) ------------------------------------------------

const sheet = ref(false)
const sibuk = ref(false)
const hapusSheet = ref(false)
const form = reactive({
  id: '',
  name: '',
  desc: '',
  cur: 0,
  target: 100,
  unit: '',
  area: 'Finance',
  milestone: '',
})

function buka(g?: HlifeGoal) {
  Object.assign(form, g
    ? { id: g.id, name: g.name, desc: g.desc || '', cur: g.cur || 0, target: g.target || 100, unit: g.unit || '', area: g.area || 'Finance', milestone: g.milestone || PILIHAN_TANPA }
    : { id: '', name: '', desc: '', cur: 0, target: 100, unit: '', area: 'Finance', milestone: PILIHAN_TANPA })
  sheet.value = true
}

function muatUlang() {
  return refreshGoal()
}

function tanyaHapus(g: HlifeGoal) {
  Object.assign(form, { id: g.id, name: g.name })
  hapusSheet.value = true
}

async function simpan() {
  const name = form.name.trim()
  if (!name) {
    toast.add({ title: 'Nama wajib diisi.', color: 'error' })
    return
  }
  const body = {
    name,
    desc: form.desc,
    cur: Number(form.cur) || 0,
    target: Number(form.target) || 1,
    unit: form.unit,
    area: form.area,
    milestone: form.milestone === PILIHAN_TANPA ? '' : form.milestone,
  }
  sibuk.value = true
  try {
    if (form.id) {
      const versi = goalData.value.versions[form.id]
      if (versi === undefined) {
        toast.add({ title: 'Versi goal belum terbaca. Muat ulang halaman.', color: 'error' })
        return
      }
      await updateHlifeRecord('goals', form.id, { ...body, id: form.id }, versi)
    }
    else {
      await createHlifeRecord<HlifeGoal>('goals', body)
    }
    await refreshGoal()
    sheet.value = false
    toast.add({ title: 'Goal tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function hapus() {
  if (!form.id) return
  const versi = goalData.value.versions[form.id]
  hapusSheet.value = false
  if (versi === undefined) {
    toast.add({ title: 'Versi goal belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    await deleteHlifeRecord('goals', form.id, versi)
    await refreshGoal()
    sheet.value = false
    toast.add({ title: 'Goal dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    :title="`Goals ${tahun}`"
    description="Target terukur (numerik) + deskripsi singkat."
  >
    <template #actions>
      <UButton
        label="Goal"
        icon="i-lucide-plus"
        @click="buka()"
      />
    </template>

    <p
      v-if="status === 'pending' && !goals.length"
      class="mb-4 text-sm text-muted"
    >
      Memuat goal…
    </p>

    <div class="grid gap-5 lg:grid-cols-2">
      <AppPanel
        v-for="g in goals"
        :key="g.id"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-display text-base font-semibold text-highlighted">
              {{ g.name }}
            </h3>
            <AppStatus
              v-if="g.area"
              size="sm"
              color="gold"
              icon="i-lucide-tag"
              class="mt-1"
            >
              {{ g.area }}
            </AppStatus>
          </div>
          <span class="font-display text-2xl font-bold text-primary-700 num">{{ persenGoal(g) }}%</span>
        </div>
        <p
          v-if="g.desc"
          class="mt-2 text-sm text-muted"
        >
          {{ g.desc }}
        </p>
        <ULink
          v-if="g.milestone"
          to="/hlife/roadmap"
          class="mt-2 inline-block"
        >
          <AppStatus
            color="vip"
            icon="i-lucide-map"
          >
            → Roadmap: {{ labelMilestone(g.milestone) }}
          </AppStatus>
        </ULink>
        <AppBar
          class="mt-3"
          label="Progress"
          :value="`${persenGoal(g)}%`"
          :persen="persenGoal(g)"
          :tone="g.area === 'Health' || g.area === 'Learning' ? 'success' : 'gold'"
        />
        <div class="mt-2 flex items-center justify-between text-sm">
          <span class="text-muted">Sekarang: <b class="text-highlighted num">{{ angka(g.cur) }}{{ g.unit }}</b></span>
          <span class="text-muted">Target: <b class="text-highlighted num">{{ angka(g.target) }}{{ g.unit }}</b></span>
        </div>
        <div class="mt-3 flex gap-2">
          <UButton
            label="Update"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="buka(g)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Hapus goal"
            @click="tanyaHapus(g)"
          />
        </div>
      </AppPanel>
    </div>

    <p
      v-if="!goals.length && status !== 'pending'"
      class="rounded-panel border border-dashed border-default bg-default px-6 py-10 text-center text-muted shadow-panel"
    >
      Belum ada goal. Tambahkan target terukur pertama.
    </p>

    <!-- Goal form -->
    <ResponsiveSheet
      v-model:open="sheet"
      :title="form.id ? 'Update goal' : 'Goal baru'"
    >
      <div class="space-y-4">
        <UFormField
          label="Nama goal"
          required
        >
          <UInput
            v-model="form.name"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Deskripsi singkat">
          <UInput
            v-model="form.desc"
            placeholder="Kenapa goal ini penting…"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Nilai sekarang">
            <UInput
              v-model.number="form.cur"
              type="number"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Target">
            <UInput
              v-model.number="form.target"
              type="number"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Satuan">
            <UInput
              v-model="form.unit"
              placeholder=" Jt / kg / x"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Area">
            <USelect
              v-model="form.area"
              :items="opsiArea"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Terhubung ke milestone (Roadmap)"
          help="Progress goal ini otomatis tampil di milestone terkait."
        >
          <USelect
            v-model="form.milestone"
            :items="opsiMilestone"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UButton
          v-if="form.id"
          label="Hapus goal"
          color="error"
          variant="soft"
          block
          @click="hapusSheet = true"
        />
      </div>
      <template #footer>
        <UButton
          :label="form.id ? 'Simpan' : 'Tambah'"
          size="xl"
          :loading="sibuk"
          @click="simpan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheet = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusSheet"
      title="Hapus goal?"
    >
      <p class="text-sm text-muted">
        Goal ini akan dihapus permanen.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          :loading="sibuk"
          @click="hapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="hapusSheet = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
