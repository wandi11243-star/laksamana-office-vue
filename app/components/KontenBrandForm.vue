<!--
  Brand Baru / Edit Brand (old openBrandForm + saveBrand + delBrand,
  deploy/konten/index.html:2721-2745; konten.md D.17). Name required ("Nama
  wajib"); pillars & hashtags comma-separated; the platform accounts
  (`platforms`) are not edited here — kept as stored. Deleting says "Konten
  terkait tidak ikut terhapus".
-->
<script setup lang="ts">
import type { BrandKonten } from '~/utils/konten'
import { pisahKoma } from '~/utils/konten'

const props = defineProps<{ brand?: BrandKonten | null }>()
const open = defineModel<boolean>('open', { default: false })

const { data: st } = useStateKonten()
const { can } = useAksesKonten()

const f = reactive({ name: '', color: '#E5A823', desc: '', pic: '', website: '', audience: '', tone: '', kpiReach: '', kpiFollowers: '', freq: '', pillars: '', hashtags: '' })
const sibuk = ref(false)
const salah = ref(false)
const hapusBuka = ref(false)
const opsiPic = computed(() => st.value.users.map(u => ({ value: u.id, label: u.name })))

watch(open, (o) => {
  if (!o) return
  const b = props.brand
  salah.value = false
  Object.assign(f, {
    name: b?.name ?? '', color: b?.color || '#E5A823', desc: b?.desc ?? '', pic: b?.pic || st.value.users[0]?.id || '', website: b?.website ?? '',
    audience: b?.audience ?? '', tone: b?.tone ?? '', kpiReach: String(b?.kpiReach || 0), kpiFollowers: String(b?.kpiFollowers || 0), freq: b?.freq ?? '',
    pillars: (b?.pillars ?? []).join(', '), hashtags: (b?.hashtags ?? []).join(', '),
  })
}, { immediate: true })

async function simpan() {
  const name = f.name.trim()
  if (!name) {
    salah.value = true
    return
  }
  const data = {
    name, color: f.color, desc: f.desc, pic: f.pic, website: f.website, audience: f.audience, tone: f.tone,
    kpiReach: Number(f.kpiReach) || 0, kpiFollowers: Number(f.kpiFollowers) || 0, freq: f.freq, pillars: pisahKoma(f.pillars), hashtags: pisahKoma(f.hashtags),
  }
  const b = props.brand
  sibuk.value = true
  const ok = b
    ? await kontenSimpan(() => ubahKonten<BrandKonten>('brands', b.id, { ...b, ...data }, b.updatedAt), 'Brand diperbarui')
    : await kontenSimpan(() => buatKonten<BrandKonten>('brands', { platforms: [], ...data }), 'Brand ditambah', { action: 'menambah brand', target: name })
  sibuk.value = false
  if (ok) open.value = false
}

async function hapus() {
  const b = props.brand
  if (!b) return
  sibuk.value = true
  const ok = await kontenSimpan(() => hapusKonten('brands', b.id, b.updatedAt), 'Brand dihapus')
  sibuk.value = false
  if (!ok) return
  hapusBuka.value = false
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="brand ? 'Edit brand' : 'Brand baru'"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Nama brand"
        required
        :error="salah ? 'Nama wajib' : false"
      >
        <UInput
          v-model="f.name"
          class="w-full"
          @update:model-value="salah = false"
        />
      </UFormField>
      <UFormField label="Warna (kalender)">
        <input
          v-model="f.color"
          type="color"
          aria-label="Warna"
          class="h-9 w-full cursor-pointer rounded-md border border-default bg-default p-1"
        >
      </UFormField>
      <UFormField
        label="Deskripsi"
        class="sm:col-span-2"
      >
        <UTextarea
          v-model="f.desc"
          class="w-full"
        />
      </UFormField>
      <UFormField label="PIC (Account Manager)">
        <USelect
          v-model="f.pic"
          :items="opsiPic"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Website">
        <UInput
          v-model="f.website"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Target audience"
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.audience"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Tone of voice"
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.tone"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Target reach">
        <UInput
          v-model="f.kpiReach"
          type="number"
          min="0"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Target followers">
        <UInput
          v-model="f.kpiFollowers"
          type="number"
          min="0"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Frekuensi posting">
        <UInput
          v-model="f.freq"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Content pillars (pisah koma)"
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.pillars"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Hashtag wajib (pisah koma)"
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.hashtags"
          class="w-full"
        />
      </UFormField>
    </div>
    <template #footer>
      <UButton
        v-if="can('brands')"
        label="Simpan"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="brand && can('brands')"
        label="Hapus"
        color="error"
        variant="outline"
        @click="hapusBuka = true"
      />
    </template>
  </ResponsiveSheet>
  <KontenKonfirmasi
    v-model:open="hapusBuka"
    title="Hapus brand?"
    description="Konten terkait tidak ikut terhapus."
    confirm-label="Hapus"
    color="error"
    :loading="sibuk"
    @konfirmasi="hapus"
  />
</template>
