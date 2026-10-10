<!--
  Photo viewer for waste / handover / break & loss records (old overlay `bukaFoto`).

  A data URI cannot be opened in a new tab (Chrome blocks top-level `data:`
  navigation), so the photo is shown in place with a download link
  (`usage/index.html:2809-2879`).
-->
<script setup lang="ts">
const props = defineProps<{
  kind: 'waste' | 'handovers' | 'bl-item' | 'bl-movement'
  id: string
  judul?: string
}>()
const open = defineModel<boolean>('open', { default: false })

const foto = ref('')
const nama = ref('')
const memuat = ref(false)
const pesan = ref('')

watch(open, async (v) => {
  if (!v || !props.id) return
  foto.value = ''
  nama.value = ''
  pesan.value = ''
  memuat.value = true
  try {
    const r = props.kind === 'waste'
      ? await getWastePhoto(props.id)
      : props.kind === 'handovers'
        ? await getHandoverPhoto(props.id)
        : props.kind === 'bl-item'
          ? await getBlItemPhoto(props.id)
          : await getBlMovementPhoto(props.id)
    foto.value = r.foto
    nama.value = r.fotoNama || 'foto.jpg'
  }
  catch (e) {
    pesan.value = apiErrorMessage(e, 'Foto tidak ditemukan untuk catatan ini.')
  }
  finally {
    memuat.value = false
  }
})
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="judul || 'Foto'"
  >
    <p
      v-if="memuat"
      class="text-sm text-muted"
    >
      Memuat foto…
    </p>
    <p
      v-else-if="pesan"
      class="text-sm text-muted"
    >
      {{ pesan }}
    </p>
    <img
      v-else-if="foto"
      :src="foto"
      :alt="judul || 'Foto'"
      class="w-full rounded-field border border-default"
    >
    <template #footer>
      <UButton
        v-if="foto"
        label="Unduh"
        icon="i-lucide-download"
        color="neutral"
        variant="soft"
        size="xl"
        :href="foto"
        :download="nama"
      />
      <UButton
        label="Tutup"
        color="neutral"
        variant="soft"
        size="xl"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
