<!--
  The event form, shared by Perencanaan (new plan) and Event Management
  (edit). Fields, defaults and validation messages follow `eventForm :6284`
  and `saveEvent :6313` exactly. PIC is locked to the creating account
  (`fieldPicEvent :6271`, F.7); `createdBy`/`createdById` are never rewritten
  on edit (`:6352`).
-->
<script setup lang="ts">
import type { Acara } from '~/composables/useEvent'
import { EVT_CATS, uploadFileEvent } from '~/composables/useEvent'
import { apiErrorMessage } from '~/composables/useApi'

const props = defineProps<{
  awal?: Partial<Acara>
  picTerkunci: string
  statusBaru?: string
}>()
const emit = defineEmits<{
  simpan: [body: Record<string, unknown>]
  batal: []
}>()

const form = ref({
  title: String(props.awal?.title ?? ''),
  category: String(props.awal?.category ?? EVT_CATS[0]),
  theme: String(props.awal?.theme ?? ''),
  venue: String(props.awal?.venue ?? ''),
  capacity: Number(props.awal?.capacity ?? 100),
  start_datetime: String(props.awal?.start_datetime ?? ''),
  end_datetime: String(props.awal?.end_datetime ?? ''),
  description: String(props.awal?.description ?? ''),
  is_ticketed: Boolean(props.awal?.is_ticketed ?? false),
})
const posterLama = ref(String(props.awal?.poster_img ?? ''))
const posterBaru = ref<File | null>(null)
const menyimpan = ref(false)
const toast = useToast()

async function simpan() {
  if (!form.value.title.trim()) {
    toast.add({ title: 'Judul wajib.', color: 'error' })
    return
  }
  if (!form.value.start_datetime) {
    toast.add({ title: 'Tanggal & jam mulai wajib diisi.', color: 'error' })
    return
  }
  if (form.value.end_datetime && form.value.end_datetime < form.value.start_datetime) {
    toast.add({ title: 'Waktu selesai tidak boleh sebelum waktu mulai.', color: 'error' })
    return
  }
  menyimpan.value = true
  try {
    let poster = posterLama.value
    if (posterBaru.value) {
      const f = posterBaru.value
      if (!/^image\//.test(f.type)) {
        toast.add({ title: 'Poster harus berupa gambar (jpg/png/webp/gif).', color: 'error' })
        menyimpan.value = false
        return
      }
      const buf = await f.arrayBuffer()
      let bin = ''
      const bytes = new Uint8Array(buf)
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
      const up = await uploadFileEvent({ dataBase64: btoa(bin), fileName: f.name, mimeType: f.type })
      poster = up.data.key
    }
    emit('simpan', {
      ...form.value,
      title: form.value.title.trim(),
      poster_img: poster,
      pic: props.awal?.pic || props.picTerkunci,
      ...(props.statusBaru ? { status: props.statusBaru } : {}),
      updatedAt: Date.now(),
    })
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}
</script>

<template>
  <div class="grid gap-3 lg:grid-cols-2">
    <UFormField
      label="Judul"
      required
      class="lg:col-span-2"
    >
      <UInput
        v-model="form.title"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Gambar poster">
      <input
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif"
        class="text-sm"
        @change="posterBaru = ($event.target as HTMLInputElement).files?.[0] ?? null"
      >
      <p
        v-if="posterLama && !posterBaru"
        class="mt-1 text-xs text-muted"
      >
        Poster lama dipertahankan.
      </p>
    </UFormField>
    <UFormField label="Kategori">
      <USelect
        v-model="form.category"
        :items="EVT_CATS.map(c => ({ value: c, label: c }))"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Theme">
      <UInput
        v-model="form.theme"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Venue">
      <UInput
        v-model="form.venue"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Kapasitas">
      <UInput
        v-model.number="form.capacity"
        type="number"
        min="0"
        class="w-full"
      />
    </UFormField>
    <UFormField
      label="Mulai"
      required
    >
      <UInput
        v-model="form.start_datetime"
        type="datetime-local"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Selesai">
      <UInput
        v-model="form.end_datetime"
        type="datetime-local"
        class="w-full"
      />
    </UFormField>
    <UFormField label="PIC (terkunci ke pembuat)">
      <UInput
        :model-value="awal?.pic || picTerkunci"
        disabled
        class="w-full"
      />
    </UFormField>
    <UFormField label="Ticketed event (aktifkan modul ticketing)">
      <USwitch v-model="form.is_ticketed" />
    </UFormField>
    <UFormField
      label="Deskripsi"
      class="lg:col-span-2"
    >
      <UTextarea
        v-model="form.description"
        class="w-full"
      />
    </UFormField>
  </div>
  <div class="mt-4 flex gap-2">
    <UButton
      color="primary"
      :loading="menyimpan"
      @click="simpan()"
    >
      Simpan event
    </UButton>
    <UButton
      color="neutral"
      variant="outline"
      @click="emit('batal')"
    >
      Batal
    </UButton>
  </div>
</template>
