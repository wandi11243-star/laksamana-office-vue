<!--
  Tambah / Edit Asset (old openAssetForm + saveAsset + delAsset,
  deploy/konten/index.html:4289-4305; konten.md D.8). Name required
  ("Nama wajib"); tags comma-separated; the link points to Drive / Dropbox /
  Frame.io — files are not uploaded here, as before.
-->
<script setup lang="ts">
import type { AssetKonten } from '~/utils/konten'
import { KATEGORI_ASSET, pisahKoma } from '~/utils/konten'

const props = defineProps<{ asset?: AssetKonten | null }>()
const open = defineModel<boolean>('open', { default: false })

const { data: st } = useStateKonten()
const { saya, can } = useAksesKonten()
const toast = useToast()

const f = reactive({ name: '', category: KATEGORI_ASSET[0]!, brand: '', version: 'v1', tags: '', link: '' })
const sibuk = ref(false)
const hapusBuka = ref(false)
const opsiBrand = computed(() => st.value.brands.map(b => ({ value: b.id, label: b.name })))

watch(open, (o) => {
  if (!o) return
  const a = props.asset
  Object.assign(f, {
    name: a?.name ?? '', category: a?.category || KATEGORI_ASSET[0], brand: a?.brand ?? st.value.brands[0]?.id ?? '',
    version: a?.version || 'v1', tags: (a?.tags ?? []).join(', '), link: a?.link ?? '',
  })
}, { immediate: true })

async function simpan() {
  const name = f.name.trim()
  if (!name) return toast.add({ title: 'Nama wajib', color: 'error' })
  const data = { name, category: f.category, brand: f.brand, version: f.version, tags: pisahKoma(f.tags), link: f.link }
  const a = props.asset
  sibuk.value = true
  const ok = a
    ? await kontenSimpan(() => ubahKonten<AssetKonten>('assets', a.id, { ...a, ...data }, a.updatedAt), 'Asset diperbarui')
    : await kontenSimpan(() => buatKonten<AssetKonten>('assets', { by: saya.value?.user.id, at: Date.now(), ...data }), 'Asset ditambah', { action: 'mengunggah asset', target: name })
  sibuk.value = false
  if (ok) open.value = false
}

async function hapus() {
  const a = props.asset
  if (!a) return
  sibuk.value = true
  const ok = await kontenSimpan(() => hapusKonten('assets', a.id, a.updatedAt), 'Asset dihapus')
  sibuk.value = false
  if (!ok) return
  hapusBuka.value = false
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="asset ? 'Edit Asset' : 'Tambah Asset'"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Nama Asset"
        required
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.name"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Kategori">
        <USelect
          v-model="f.category"
          :items="KATEGORI_ASSET"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Brand">
        <USelect
          v-model="f.brand"
          :items="opsiBrand"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Versi">
        <UInput
          v-model="f.version"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Tags (pisah koma)">
        <UInput
          v-model="f.tags"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Link (Drive / Dropbox / Frame.io)"
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.link"
          type="url"
          placeholder="https://drive.google.com/..."
          class="w-full"
        />
      </UFormField>
    </div>
    <template #footer>
      <UButton
        v-if="can('assets')"
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
        v-if="asset && can('assets')"
        label="Hapus"
        color="error"
        variant="outline"
        @click="hapusBuka = true"
      />
    </template>
  </ResponsiveSheet>
  <KontenKonfirmasi
    v-model:open="hapusBuka"
    title="Hapus asset?"
    :description="asset?.name"
    :loading="sibuk"
    @konfirmasi="hapus"
  />
</template>
