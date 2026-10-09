<!--
  Marketing › design/video request form (drForm, :15932). Brand & PIC ride on
  option lists when Konten lent them, free text when it did not — an old value
  missing from the list stays selectable and marked, never silently replaced.
  Photo refs ride inside the row (2 MB each, 6 MB per request).
-->
<script setup lang="ts">
import type { EventMkt, RequestDesainMkt } from '~/utils/marketing'
import type { OpsiDesainMkt } from '~/composables/useMarketing'
import {
  DR_JENIS_MKT, DR_PLATFORM_MKT, DR_PRIO_MKT, DR_TOTAL_MB, refFotoBesarMkt, refFotoPenuhMkt, refLinkMkt,
} from '~/utils/marketing-vip'

const props = defineProps<{
  awal?: RequestDesainMkt | null
  events: EventMkt[]
  opsi: OpsiDesainMkt | null
}>()

const emit = defineEmits<{ simpan: [v: RequestDesainMkt] }>()

const f = reactive({
  jenis: props.awal?.jenis ?? 'design',
  prioritas: (props.awal?.prioritas ?? 'medium') as (typeof DR_PRIO_MKT)[number][0],
  judul: props.awal?.judul ?? '',
  deadline: props.awal?.deadline ?? '',
  brand: props.awal?.brand ?? '',
  brandBebas: '',
  pic: props.awal?.pic ?? '',
  picBebas: '',
  platforms: [...(props.awal?.platforms ?? [])],
  acara: props.awal?.acara ?? '',
  brief: props.awal?.brief ?? '',
  refs: (props.awal?.refs ?? []).map(r => ({ ...r })),
})
const salah = ref('')

const evOpsi = computed(() => {
  const Semua = [...props.events]
    .filter(e => !e.tanggal || e.tanggal >= '2026-01-01')
    .sort((a, b) => String(a.tanggal ?? '9999').localeCompare(String(b.tanggal ?? '9999')))
    .map(e => `${e.nama}${e.tanggal ? ` · ${e.tanggal}` : ''}`)
  if (f.acara && !Semua.includes(f.acara)) Semua.unshift(f.acara)
  return Semua
})
const brandOpsi = computed(() => {
  const daftar = [...(props.opsi?.brands ?? [])]
  if (f.brand && !daftar.includes(f.brand)) daftar.unshift(`${f.brand} (lama)`)
  return daftar
})
const picOpsi = computed(() => {
  const daftar = [...(props.opsi?.pics ?? [])]
  if (f.pic && !daftar.includes(f.pic)) daftar.unshift(`${f.pic} (lama)`)
  return daftar
})
const namaBersih = (v: string) => v.replace(/\s*\(lama\)\s*$/, '').trim()

function togglePlat(p: string) {
  f.platforms = f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p]
}

const refLink = ref('')
function tambahLink() {
  const v = refLinkMkt(refLink.value)
  if (!v) {
    salah.value = 'Link kosong — tempel dulu linknya.'
    return
  }
  refLink.value = ''
  if (f.refs.some(r => r.t === 'link' && r.v === v)) {
    salah.value = 'Link itu sudah ada di daftar.'
    return
  }
  f.refs.push({ t: 'link', v, n: v.replace(/^https?:\/\//i, '').slice(0, 60) })
  salah.value = ''
}
// Shrunk in the browser first (1280px JPEG, like the old drKecilkanGambar)
// so the request row does not balloon; every skipped photo says why.
async function tambahFoto(files: FileList | null) {
  const pesan: string[] = []
  for (const file of [...(files ?? [])]) {
    const tolak = refFotoBesarMkt(file.name, file.type, file.size)
    if (tolak) {
      pesan.push(tolak)
      continue
    }
    try {
      const data = await kecilkanGambarKonten(file)
      if (refFotoPenuhMkt(f.refs, data)) pesan.push(`Total foto sudah penuh (maks ${DR_TOTAL_MB} MB per request) — ${file.name} tidak ditambahkan.`)
      else f.refs.push({ t: 'img', v: data, n: file.name })
    }
    catch (e) {
      pesan.push(`${file.name}: ${e instanceof Error ? e.message : 'gagal diproses'}.`)
    }
  }
  salah.value = pesan.join(' ')
}

function kirim() {
  if (!f.judul.trim() || !f.brief.trim()) {
    salah.value = 'Lengkapi data — Judul & Brief wajib diisi, tim Konten mengerjakannya dari brief ini.'
    return
  }
  salah.value = ''
  emit('simpan', {
    ...(props.awal ?? {}),
    jenis: f.jenis, prioritas: f.prioritas, judul: f.judul.trim(), deadline: f.deadline,
    brand: f.brandBebas.trim() || namaBersih(f.brand), brandNama: f.brandBebas.trim() || namaBersih(f.brand),
    pic: f.picBebas.trim() || namaBersih(f.pic), picNama: f.picBebas.trim() || namaBersih(f.pic),
    platforms: [...f.platforms], acara: f.acara, brief: f.brief.trim(), refs: f.refs,
  } as RequestDesainMkt)
}
</script>

<template>
  <div class="grid gap-3">
    <div class="grid gap-3 lg:grid-cols-2">
      <UFormField
        label="Jenis"
        required
      >
        <USelect
          v-model="f.jenis"
          :items="[{ value: 'design', label: `Desain — masuk ${DR_JENIS_MKT.design.q}` }, { value: 'edit', label: `Video / Editing — masuk ${DR_JENIS_MKT.edit.q}` }]"
          value-key="value"
          label-key="label"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Prioritas">
        <USelect
          v-model="f.prioritas"
          :items="DR_PRIO_MKT.map(x => ({ value: x[0], label: x[1] }))"
          value-key="value"
          label-key="label"
          class="w-full"
        />
      </UFormField>
    </div>
    <UFormField
      label="Judul permintaan"
      required
    >
      <UInput v-model="f.judul" />
    </UFormField>
    <UFormField
      label="Deadline pengerjaan"
      hint="Kapan hasilnya harus siap — bukan tanggal tayang."
    >
      <UInput
        v-model="f.deadline"
        type="date"
      />
    </UFormField>
    <div class="grid gap-3 lg:grid-cols-2">
      <UFormField label="Brand">
        <USelect
          v-if="brandOpsi.length"
          v-model="f.brand"
          :items="brandOpsi"
          placeholder="Pilih…"
          class="w-full"
        />
        <UInput
          v-model="f.brandBebas"
          :placeholder="brandOpsi.length ? 'Atau ketik brand lain…' : 'Ketik brand…'"
        />
      </UFormField>
      <UFormField label="PIC yang diminta">
        <USelect
          v-if="picOpsi.length"
          v-model="f.pic"
          :items="picOpsi"
          placeholder="Pilih…"
          class="w-full"
        />
        <UInput
          v-model="f.picBebas"
          :placeholder="picOpsi.length ? 'Atau ketik nama…' : 'Ketik nama…'"
        />
      </UFormField>
    </div>
    <div>
      <p class="mb-1 text-sm font-semibold">
        Platform
      </p>
      <div class="flex flex-wrap gap-1.5">
        <UCheckbox
          v-for="p in DR_PLATFORM_MKT"
          :key="p"
          :model-value="f.platforms.includes(p)"
          :label="p"
          @update:model-value="togglePlat(p)"
        />
      </div>
    </div>
    <UFormField label="Untuk acara">
      <USelect
        v-model="f.acara"
        :items="['', ...evOpsi]"
        :placeholder="'— tidak terkait acara tertentu —'"
        class="w-full"
      />
    </UFormField>
    <UFormField
      label="Brief"
      required
      hint="Tulis selengkap mungkin — tim Konten membacanya dari antrian mereka."
    >
      <UTextarea
        v-model="f.brief"
        :rows="5"
        autoresize
      />
    </UFormField>
    <div>
      <p class="mb-1 text-sm font-semibold">
        Referensi
      </p>
      <p class="mb-2 text-xs text-muted">
        Tautan (Drive, IG, Pinterest) & foto contoh. Foto ikut tersimpan di dalam data modul — pakai seperlunya, maks 2 MB per foto, 6 MB per request.
      </p>
      <div class="mb-2 flex flex-wrap gap-2">
        <UInput
          v-model="refLink"
          placeholder="Tempel link lalu Enter"
          class="min-w-44 flex-1"
          @keydown.enter.prevent="tambahLink"
        />
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          label="Link"
          @click="tambahLink"
        />
        <UInput
          type="file"
          accept="image/*"
          multiple
          class="max-w-52"
          @change="tambahFoto(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="(r, i) in f.refs"
          :key="i"
          class="flex items-center gap-1.5 rounded-field border border-default px-2 py-1 text-xs"
        >
          <img
            v-if="r.t === 'img'"
            :src="r.v"
            :alt="r.n ?? ''"
            class="size-10 rounded object-cover"
          >
          <UIcon
            v-else
            name="i-lucide-link"
            class="size-4 text-info"
          />
          <a
            v-if="r.t === 'link'"
            :href="r.v"
            target="_blank"
            rel="noopener"
            class="max-w-40 truncate text-info underline"
          >{{ r.n || r.v }}</a>
          <span
            v-else
            class="max-w-28 truncate text-muted"
          >{{ r.n }}</span>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Hapus referensi"
            @click="f.refs.splice(i, 1)"
          />
        </div>
      </div>
    </div>
    <p
      v-if="salah"
      class="text-sm text-error"
    >
      {{ salah }}
    </p>
    <div class="flex justify-end gap-2">
      <UButton
        :label="awal ? 'Simpan Perubahan' : 'Kirim ke Tim Konten'"
        @click="kirim"
      />
    </div>
  </div>
</template>
