<!--
  Businesses — the old viewBusiness (howandi_life/index.html:792-796). One card
  per child company: field, year founded, average revenue, open task/project
  counts and the age. Click a card for the detail screen.
-->
<script setup lang="ts">
import type { HlifeBusiness, HlifeProject, HlifeTask } from '~/composables/useHlife'
import {
  createHlifeRecord, deleteHlifeRecord, updateHlifeRecord,
  useHlifeResource,
} from '~/composables/useHlife'
import { BIZ_AREAS, bizRevTotal, rupiahRingkas, stageAktif } from '~/utils/hlife'

definePageMeta({ access: ['howandi_life'] })

const toast = useToast()
const router = useRouter()
const tahun = new Date().getFullYear()

const { data: bizData, status, refresh: refreshBiz } = useHlifeResource<HlifeBusiness>('businesses')
const { data: taskData } = useHlifeResource<HlifeTask>('tasks')
const { data: projData } = useHlifeResource<HlifeProject>('projects')

const bisnis = computed(() => bizData.value.rows)
const tugas = computed(() => taskData.value.rows)
const proyek = computed(() => projData.value.rows)

const tugasAktif = (b: HlifeBusiness) => tugas.value.filter(t => t.biz === b.name && !t.done).length
const proyekAktif = (b: HlifeBusiness) => proyek.value.filter(p => p.biz === b.name && stageAktif(p) !== 'Done').length
const umur = (b: HlifeBusiness) => (b.founded ? tahun - Number(b.founded) + 1 : 0)

const opsiArea = BIZ_AREAS.map(a => ({ value: a as string, label: a }))

// --- business sheet (`:946-949`) --------------------------------------------

const sheet = ref(false)
const sibuk = ref(false)
const hapusSheet = ref(false)
const form = reactive({ id: '', name: '', field: '', founded: '', desc: '', revenue: 0, area: 'Business' })

function buka(b?: HlifeBusiness) {
  Object.assign(form, b
    ? { id: b.id, name: b.name, field: b.field || '', founded: b.founded ? String(b.founded) : '', desc: b.desc || '', revenue: b.revenue || 0, area: b.area || 'Business' }
    : { id: '', name: '', field: '', founded: '', desc: '', revenue: 0, area: 'Business' })
  sheet.value = true
}

function muatUlang() {
  return refreshBiz()
}

async function simpan() {
  const name = form.name.trim()
  if (!name) {
    toast.add({ title: 'Nama wajib diisi.', color: 'error' })
    return
  }
  const body = {
    name,
    field: form.field,
    founded: Number(form.founded) || '',
    desc: form.desc,
    revenue: Number(form.revenue) || 0,
    area: form.area,
  }
  sibuk.value = true
  try {
    if (form.id) {
      const versi = bizData.value.versions[form.id]
      if (versi === undefined) {
        toast.add({ title: 'Versi bisnis belum terbaca. Muat ulang halaman.', color: 'error' })
        return
      }
      await updateHlifeRecord('businesses', form.id, { ...body, id: form.id }, versi)
    }
    else {
      await createHlifeRecord<HlifeBusiness>('businesses', body)
    }
    await refreshBiz()
    sheet.value = false
    toast.add({ title: 'Bisnis tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

function tanyaHapus(b: HlifeBusiness) {
  form.id = b.id
  form.name = b.name
  hapusSheet.value = true
}

async function hapus() {
  if (!form.id) return
  const versi = bizData.value.versions[form.id]
  hapusSheet.value = false
  if (versi === undefined) {
    toast.add({ title: 'Versi bisnis belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    await deleteHlifeRecord('businesses', form.id, versi)
    await refreshBiz()
    sheet.value = false
    toast.add({ title: 'Bisnis dihapus. Task & project tidak ikut terhapus.', color: 'success' })
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
  <NuxtPage v-if="$route.params.id" />
  <AppPage
    v-else
    title="Businesses"
    description="Howandi Chandra Inc. — klik untuk detail tiap anak perusahaan."
  >
    <template #actions>
      <UButton
        label="Bisnis"
        icon="i-lucide-plus"
        @click="buka()"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="Total bisnis"
        icon="i-lucide-building-2"
        :value="bisnis.length"
        sub="anak perusahaan"
      />
      <AppStat
        label="Avg rev/tahun"
        icon="i-lucide-trending-up"
        :value="rupiahRingkas(bizRevTotal(bisnis))"
        sub="jumlah rata-rata semua"
        tone="success"
      />
      <AppStat
        label="Project aktif"
        icon="i-lucide-kanban"
        :value="proyek.filter(p => stageAktif(p) !== 'Done').length"
        sub="di semua bisnis"
        tone="info"
      />
    </AppStatGrid>

    <p
      v-if="status === 'pending' && !bisnis.length"
      class="mb-4 text-sm text-muted"
    >
      Memuat bisnis…
    </p>

    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="b in bisnis"
        :key="b.id"
        class="cursor-pointer rounded-panel border border-default bg-default p-4 shadow-panel transition-colors hover:border-accented"
        @click="router.push(`/hlife/business/${b.id}`)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-display text-base font-semibold text-highlighted">
              {{ b.name }}
            </h3>
            <p class="mt-0.5 text-sm text-muted">
              {{ b.field || b.area }}
            </p>
          </div>
          <AppStatus
            v-if="b.founded"
            size="sm"
            color="neutral"
            icon="i-lucide-calendar"
          >
            {{ b.founded }}
          </AppStatus>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-3">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Avg rev/thn
            </p>
            <p class="text-sm font-semibold text-primary-700 num">
              {{ rupiahRingkas(b.revenue || 0) }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Task
            </p>
            <p class="text-lg font-semibold text-highlighted num">
              {{ tugasAktif(b) }}
            </p>
          </div>
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Project
            </p>
            <p class="text-lg font-semibold text-highlighted num">
              {{ proyekAktif(b) }}
            </p>
          </div>
        </div>
        <p
          v-if="umur(b)"
          class="mt-3 text-xs text-muted num"
        >
          Berdiri {{ umur(b) }} tahun
        </p>
        <div class="mt-3 flex justify-end gap-1">
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Ubah bisnis"
            @click.stop="buka(b)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Hapus bisnis"
            @click.stop="tanyaHapus(b)"
          />
        </div>
      </article>
    </div>

    <p
      v-if="!bisnis.length && status !== 'pending'"
      class="rounded-panel border border-dashed border-default bg-default px-6 py-10 text-center text-muted shadow-panel"
    >
      Belum ada bisnis. Tambahkan anak perusahaan pertama.
    </p>

    <!-- Business form -->
    <ResponsiveSheet
      v-model:open="sheet"
      :title="form.id ? 'Edit bisnis' : 'Bisnis baru'"
    >
      <div class="space-y-4">
        <UFormField
          label="Nama bisnis"
          required
        >
          <UInput
            v-model="form.name"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Bidang / bergerak di">
            <UInput
              v-model="form.field"
              placeholder="mis. F&B — restoran"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Tahun berdiri">
            <UInput
              v-model="form.founded"
              type="number"
              placeholder="2021"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Deskripsi singkat">
          <UTextarea
            v-model="form.desc"
            :rows="3"
            placeholder="Tentang bisnis ini…"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Avg revenue / tahun (Rp)">
            <UInput
              v-model.number="form.revenue"
              type="number"
              placeholder="2400000000"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Life area">
            <USelect
              v-model="form.area"
              :items="opsiArea"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <UButton
          v-if="form.id"
          label="Hapus bisnis"
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
      title="Hapus bisnis?"
      :description="form.name"
    >
      <p class="text-sm text-muted">
        Task & project yang terhubung tidak ikut terhapus.
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
