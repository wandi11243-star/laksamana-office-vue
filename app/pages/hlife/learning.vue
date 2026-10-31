<!--
  Learning & Refleksi — the old viewLearning (howandi_life/index.html:698-703).
  Each note keeps its key takeaway; the rating is 0–5 and the hidden `date`
  stays as first saved (`:921`).
-->
<script setup lang="ts">
import type { HlifeLearning } from '~/composables/useHlife'
import {
  createHlifeRecord, deleteHlifeRecord, updateHlifeRecord,
  useHlifeResource,
} from '~/composables/useHlife'
import { LEARN_STATUS, LEARN_TYPES } from '~/utils/hlife'
import { lencanaBelajar } from '~/utils/status-hlife'
import { angka, hariIni } from '~/utils/format'

definePageMeta({ access: ['howandi_life'] })

const toast = useToast()

const { data: learnData, status, refresh: refreshLearning } = useHlifeResource<HlifeLearning>('learning')
const learning = computed(() => learnData.value.rows)
const selesai = computed(() => learning.value.filter(l => l.status === 'Selesai').length)

const opsiTipe = LEARN_TYPES.map(t => ({ value: t as string, label: t }))
const opsiStatus = LEARN_STATUS.map(s => ({ value: s as string, label: s }))

const sheet = ref(false)
const sibuk = ref(false)
const hapusSheet = ref(false)
const form = reactive({ id: '', title: '', type: 'Buku', source: '', status: 'Sedang', rating: 0, take: '', date: '' })

function buka(l?: HlifeLearning) {
  Object.assign(form, l
    ? { id: l.id, title: l.title, type: l.type || 'Buku', source: l.source || '', status: l.status || 'Sedang', rating: l.rating || 0, take: l.take || '', date: l.date || hariIni() }
    : { id: '', title: '', type: 'Buku', source: '', status: 'Sedang', rating: 0, take: '', date: hariIni() })
  sheet.value = true
}

function muatUlang() {
  return refreshLearning()
}

async function simpan() {
  const title = form.title.trim()
  if (!title) {
    toast.add({ title: 'Judul wajib diisi.', color: 'error' })
    return
  }
  const body = {
    title,
    type: form.type,
    source: form.source,
    status: form.status,
    rating: Math.max(0, Math.min(5, Number(form.rating) || 0)),
    take: form.take,
    date: form.date || hariIni(),
  }
  sibuk.value = true
  try {
    if (form.id) {
      const versi = learnData.value.versions[form.id]
      if (versi === undefined) {
        toast.add({ title: 'Versi catatan belum terbaca. Muat ulang halaman.', color: 'error' })
        return
      }
      await updateHlifeRecord('learning', form.id, { ...body, id: form.id }, versi)
    }
    else {
      await createHlifeRecord<HlifeLearning>('learning', body)
    }
    await refreshLearning()
    sheet.value = false
    toast.add({ title: 'Catatan tersimpan.', color: 'success' })
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
  const versi = learnData.value.versions[form.id]
  hapusSheet.value = false
  if (versi === undefined) {
    toast.add({ title: 'Versi catatan belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    await deleteHlifeRecord('learning', form.id, versi)
    await refreshLearning()
    sheet.value = false
    toast.add({ title: 'Catatan dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

function tanyaHapus(l: HlifeLearning) {
  form.id = l.id
  form.title = l.title
  hapusSheet.value = true
}
</script>

<template>
  <AppPage
    title="Learning & Refleksi"
    description="Pelajaran dari buku, video, film, podcast — apa yang kamu ambil."
  >
    <template #actions>
      <UButton
        label="Catatan"
        icon="i-lucide-plus"
        @click="buka()"
      />
    </template>

    <AppPanel>
      <div class="flex flex-wrap items-center gap-3">
        <UIcon
          name="i-lucide-book-open"
          class="size-5 text-primary-600"
        />
        <div class="min-w-0">
          <p class="font-semibold text-highlighted num">
            {{ angka(selesai) }} selesai · {{ angka(learning.length) }} total
          </p>
          <p class="text-sm text-muted">
            Tiap catatan menyimpan key takeaway supaya ilmunya nempel, bukan cuma dikonsumsi.
          </p>
        </div>
      </div>
    </AppPanel>

    <div
      v-if="status === 'pending' && !learning.length"
      class="mb-4 space-y-2"
    >
      <!-- Loading cards mirror the note panels below. -->
      <div class="grid gap-5 lg:grid-cols-2">
        <USkeleton
          v-for="i in 2"
          :key="i"
          class="h-28 rounded-panel"
        />
      </div>
      <p class="pt-1 text-sm text-muted">
        Memuat catatan…
      </p>
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <AppPanel
        v-for="l in learning"
        :key="l.id"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-display text-base font-semibold text-highlighted">
              {{ l.title }}
            </h3>
            <p class="mt-0.5 text-sm text-muted">
              {{ l.type }}{{ l.source ? ` · ${l.source}` : '' }}
            </p>
          </div>
          <AppStatus
            size="sm"
            :color="lencanaBelajar(l.status).color"
            :icon="lencanaBelajar(l.status).icon"
          >
            {{ lencanaBelajar(l.status).label }}
          </AppStatus>
        </div>
        <div
          v-if="l.rating"
          class="mt-2 flex items-center gap-0.5"
          :aria-label="`Rating ${l.rating} dari 5`"
        >
          <UIcon
            v-for="i in 5"
            :key="i"
            name="i-lucide-star"
            class="size-4"
            :class="i <= l.rating ? 'text-primary-500' : 'text-dimmed'"
          />
          <span class="ms-1 text-xs text-muted num">{{ l.rating }}/5</span>
        </div>
        <p
          v-if="l.take"
          class="mt-3 whitespace-pre-line rounded-field bg-muted p-3 text-sm text-default"
        >
          {{ l.take }}
        </p>
        <p
          v-else
          class="mt-3 text-sm text-dimmed"
        >
          Belum ada catatan takeaway.
        </p>
        <div class="mt-3 flex gap-2">
          <UButton
            label="Edit"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="buka(l)"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Hapus catatan"
            @click="tanyaHapus(l)"
          />
        </div>
      </AppPanel>
    </div>

    <p
      v-if="!learning.length && status !== 'pending'"
      class="rounded-panel border border-dashed border-default bg-default px-6 py-10 text-center text-muted shadow-panel"
    >
      Belum ada catatan belajar.
    </p>

    <!-- Learning form -->
    <ResponsiveSheet
      v-model:open="sheet"
      :title="form.id ? 'Edit catatan' : 'Catatan belajar'"
    >
      <div class="space-y-4">
        <UFormField
          label="Judul"
          required
        >
          <UInput
            v-model="form.title"
            placeholder="Judul buku/video/film"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Tipe">
            <USelect
              v-model="form.type"
              :items="opsiTipe"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Sumber / penulis">
            <UInput
              v-model="form.source"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Status">
            <USelect
              v-model="form.status"
              :items="opsiStatus"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Rating (0–5)">
            <UInput
              v-model.number="form.rating"
              type="number"
              min="0"
              max="5"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Key takeaway / refleksi">
          <UTextarea
            v-model="form.take"
            :rows="4"
            placeholder="Apa yang kamu ambil? Bagaimana diterapkan?"
            class="w-full"
          />
        </UFormField>
        <UButton
          v-if="form.id"
          label="Hapus catatan"
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
      title="Hapus catatan?"
      :description="form.title"
    >
      <p class="text-sm text-muted">
        Catatan belajar ini akan dihapus permanen.
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
