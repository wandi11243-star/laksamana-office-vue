<!--
  Event Idea Bank — hidden route (`#/ideas` kept, not in the menu): idea grid
  with ROI, evaluations and "make event" prefill (`event/index.html:11119-11189`).
-->
<script setup lang="ts">
import type { EvaluasiIde, Ide } from '~/composables/useEvent'
import { createEvent, patchEvent, removeEvent, useDaftarEvent } from '~/composables/useEvent'
import { FREQS, IDEA_CATS, roiIde } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { rupiah } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const bolehUbah = computed(() => bolehUbahEvent('ideas', peranEvent(me.value)))

const fKategori = ref('semua')
const fFrekuensi = ref('semua')
const { data: daftar, status, refresh } = useDaftarEvent<Ide>('ideas', {}, 'event-ideas')

const list = computed(() => daftar.value.rows.filter((i) => {
  if (fKategori.value !== 'semua' && i.category !== fKategori.value) return false
  if (fFrekuensi.value !== 'semua' && i.frequency !== fFrekuensi.value) return false
  return true
}).sort((a, b) => roiIde(Number(a.budget) || 0, Number(a.potential_revenue) || 0) - roiIde(Number(b.budget) || 0, Number(b.potential_revenue) || 0)).reverse())

// --- idea form (`ideaForm :11137`) ---
const sheet = ref(false)
const ideId = ref('')
const fi = ref({ name: '', category: IDEA_CATS[0] as string, target: '', frequency: FREQS[0] as string, budget: 10000000, potential_revenue: 20000000, difficulty: 'Medium', description: '' })
function bukaBaru() {
  ideId.value = ''
  fi.value = { name: '', category: IDEA_CATS[0]!, target: '', frequency: FREQS[0]!, budget: 10000000, potential_revenue: 20000000, difficulty: 'Medium', description: '' }
  sheet.value = true
}
async function simpan() {
  if (!fi.value.name.trim()) {
    toast.add({ title: 'Nama wajib.', color: 'error' })
    return
  }
  sheet.value = false
  try {
    if (ideId.value) {
      const lama = daftar.value.rows.find(i => i.id === ideId.value)
      await patchEvent('ideas', ideId.value, { ...fi.value, name: fi.value.name.trim(), updatedAt: Date.now() }, daftar.value.versions[ideId.value])
      void lama
    }
    else {
      await createEvent('ideas', { ...fi.value, name: fi.value.name.trim(), evaluations: [], createdAt: Date.now(), updatedAt: Date.now() })
    }
    toast.add({ title: 'Ide disimpan', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
const hapusId = ref('')
const sheetHapus = computed({ get: () => hapusId.value !== '', set: v => (hapusId.value = v ? hapusId.value : '') })
async function hapus() {
  const id = hapusId.value
  sheetHapus.value = false
  if (!id) return
  try {
    await removeEvent('ideas', id, daftar.value.versions[id])
    toast.add({ title: 'Ide dihapus', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- spawn event (`spawnEvent :11189`, prefill) ---
async function buatEvent(ide: Ide) {
  try {
    const r = await createEvent('events', {
      title: ide.name,
      category: 'Community',
      theme: '',
      venue: '',
      capacity: 100,
      start_datetime: '',
      end_datetime: '',
      pic: me.value?.name ?? '',
      description: String(ide.description ?? ''),
      is_ticketed: false,
      status: 'Planning',
      createdBy: me.value?.name ?? '',
      createdById: me.value?.id ?? '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    toast.add({ title: 'Event dibuat dari ide', color: 'success' })
    await navigateTo(`/event/events/${(r.data as { id: string }).id}`)
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- evaluation (`evalIdea :11155`, `simpanEval :11171`) ---
const evalId = ref('')
const sheetEval = computed({ get: () => evalId.value !== '', set: v => (evalId.value = v ? evalId.value : '') })
const ideEval = computed(() => daftar.value.rows.find(i => i.id === evalId.value) ?? null)
const fe = ref({ date: '', omzet: 0, hadir: 0, biaya: 0, skor: 5, ulang: 'Ya', baik: '', perbaiki: '' })
function bukaEval(ide: Ide) {
  fe.value = { date: '', omzet: 0, hadir: 0, biaya: Number(ide.budget) || 0, skor: 5, ulang: 'Ya', baik: '', perbaiki: '' }
  evalId.value = ide.id
}
async function simpanEval() {
  const ide = ideEval.value
  if (!ide) return
  if (Number(fe.value.skor) < 1 || Number(fe.value.skor) > 10) {
    toast.add({ title: 'Skor harus 1–10.', color: 'error' })
    return
  }
  const ev: EvaluasiIde = {
    id: `ev${Date.now().toString(36)}`,
    date: fe.value.date,
    omzet: fe.value.omzet,
    hadir: fe.value.hadir,
    biaya: fe.value.biaya,
    skor: fe.value.skor,
    ulang: fe.value.ulang,
    baik: fe.value.baik,
    perbaiki: fe.value.perbaiki,
    profit: fe.value.omzet - fe.value.biaya,
  }
  sheetEval.value = false
  try {
    await patchEvent('ideas', ide.id, { evaluations: [...(ide.evaluations ?? []), ev], updatedAt: Date.now() }, daftar.value.versions[ide.id])
    toast.add({ title: 'Evaluasi disimpan', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Event idea bank"
    description="Database ide event + evaluasi"
    :back="{ label: 'Perencanaan', to: '/event/planning' }"
  >
    <template #actions>
      <UButton
        v-if="bolehUbah"
        color="primary"
        icon="i-lucide-plus"
        @click="bukaBaru()"
      >
        Ide baru
      </UButton>
    </template>

    <AppPanel class="mb-4">
      <AppFilterGrid>
        <UFormField label="Kategori">
          <USelect
            v-model="fKategori"
            :items="[{ value: 'semua', label: 'Semua kategori' }, ...IDEA_CATS.map(c => ({ value: c, label: c }))]"
          />
        </UFormField>
        <UFormField label="Frekuensi">
          <USelect
            v-model="fFrekuensi"
            :items="[{ value: 'semua', label: 'Semua frekuensi' }, ...FREQS.map(f => ({ value: f, label: f }))]"
          />
        </UFormField>
      </AppFilterGrid>
    </AppPanel>

    <div
      v-if="status === 'pending'"
      class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-44"
      />
    </div>
    <div
      v-else
      class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
    >
      <AppPanel
        v-for="i in list"
        :key="i.id"
      >
        <b class="block truncate text-base text-highlighted">{{ i.name }}</b>
        <p class="mt-0.5 text-xs text-muted">
          {{ i.category }} · {{ i.frequency }} · {{ i.difficulty }}
        </p>
        <div class="mt-2 flex items-baseline justify-between text-sm">
          <span class="text-muted num">Budget {{ rupiah(Number(i.budget) || 0) }}</span>
          <b
            class="num"
            :class="roiIde(Number(i.budget) || 0, Number(i.potential_revenue) || 0) >= 0 ? 'text-success' : 'text-error'"
          >ROI {{ roiIde(Number(i.budget) || 0, Number(i.potential_revenue) || 0) }}%</b>
        </div>
        <p
          v-if="(i.evaluations ?? []).length"
          class="mt-1 text-xs text-muted num"
        >
          {{ (i.evaluations ?? []).length }} evaluasi · terakhir skor {{ (i.evaluations ?? []).at(-1)?.skor }}
        </p>
        <div
          v-if="bolehUbah"
          class="mt-2.5 flex flex-wrap gap-1.5"
        >
          <UButton
            color="primary"
            variant="outline"
            size="sm"
            icon="i-lucide-arrow-right"
            @click="buatEvent(i)"
          >
            Buat event
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            @click="bukaEval(i)"
          >
            Evaluasi
          </UButton>
          <UButton
            color="error"
            variant="ghost"
            size="sm"
            icon="i-lucide-trash-2"
            @click="hapusId = i.id"
          />
        </div>
      </AppPanel>
    </div>
    <p
      v-if="!list.length && status !== 'pending'"
      class="py-10 text-center text-sm text-dimmed"
    >
      Belum ada ide di saringan ini.
    </p>

    <ResponsiveSheet
      v-model:open="sheet"
      :title="ideId ? 'Edit ide' : 'Ide baru'"
    >
      <div class="grid gap-3 lg:grid-cols-2">
        <UFormField
          label="Nama"
          required
          class="lg:col-span-2"
        >
          <UInput
            v-model="fi.name"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Kategori">
          <USelect
            v-model="fi.category"
            :items="IDEA_CATS.map(c => ({ value: c, label: c }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Frekuensi">
          <USelect
            v-model="fi.frequency"
            :items="FREQS.map(f => ({ value: f, label: f }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Target market">
          <UInput
            v-model="fi.target"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Difficulty">
          <USelect
            v-model="fi.difficulty"
            :items="['Easy', 'Medium', 'Hard'].map(d => ({ value: d, label: d }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Budget">
          <UInput
            v-model.number="fi.budget"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Potensi uang masuk">
          <UInput
            v-model.number="fi.potential_revenue"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Deskripsi"
          class="lg:col-span-2"
        >
          <UTextarea
            v-model="fi.description"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          color="primary"
          @click="simpan()"
        >
          Simpan ide
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          @click="sheet = false"
        >
          Batal
        </UButton>
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetEval"
      :title="`Evaluasi ${ideEval?.name ?? ''}`"
    >
      <div class="grid gap-3 lg:grid-cols-2">
        <UFormField label="Tanggal pelaksanaan">
          <UInput
            v-model="fe.date"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Omzet">
          <UInput
            v-model.number="fe.omzet"
            type="number"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jumlah hadir">
          <UInput
            v-model.number="fe.hadir"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Biaya aktual">
          <UInput
            v-model.number="fe.biaya"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Skor keseluruhan (1–10)">
          <UInput
            v-model.number="fe.skor"
            type="number"
            min="1"
            max="10"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Layak diulang?">
          <USelect
            v-model="fe.ulang"
            :items="['Ya', 'Perlu perbaikan', 'Tidak'].map(u => ({ value: u, label: u }))"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Yang berjalan baik">
          <UTextarea
            v-model="fe.baik"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Yang perlu diperbaiki">
          <UTextarea
            v-model="fe.perbaiki"
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="mt-2 text-sm text-muted num">
        Profit: {{ rupiah(fe.omzet - fe.biaya) }}
      </p>
      <template #footer>
        <UButton
          color="primary"
          @click="simpanEval()"
        >
          Simpan evaluasi
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          @click="sheetEval = false"
        >
          Batal
        </UButton>
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetHapus"
      title="Hapus ide?"
    >
      <p class="text-sm text-muted">
        Ide ini dihapus permanen.
      </p>
      <template #footer>
        <UButton
          color="error"
          @click="hapus()"
        >
          Ya, hapus
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          @click="sheetHapus = false"
        >
          Batal
        </UButton>
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
