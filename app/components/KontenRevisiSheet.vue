<!--
  "Minta revisi" for one content item (old reqRevision + submitRevision,
  deploy/konten/index.html:2462-2468). Used by the detail page and by
  Approval's "Tolak / Revisi". A note is required; the newest revision goes
  first, the status becomes Revision, the crew is notified.
-->
<script setup lang="ts">
import type { KontenItem } from '~/utils/konten'

const props = defineProps<{ item: KontenItem | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ terkirim: [] }>()

const { saya } = useAksesKonten()
const catatan = ref('')
const salah = ref(false)
const sibuk = ref(false)

watch(open, (v) => {
  if (v) {
    catatan.value = ''
    salah.value = false
  }
})

async function kirim() {
  const c = props.item
  const note = catatan.value.trim()
  if (!c) return
  if (!note) {
    salah.value = true
    return
  }
  sibuk.value = true
  const revisions = [{ by: saya.value?.user.id, at: Date.now(), note }, ...(c.revisions ?? [])]
  const ok = await kontenSimpan(
    () => tambalKonten<KontenItem>('content', c.id, { revisions, status: 'Revision' }, c.updatedAt),
    'Revisi dikirim',
    { action: 'meminta revisi', target: c.title },
  )
  sibuk.value = false
  if (!ok) return
  notifKonten('revision', `Revisi diminta: ${c.title}`)
  open.value = false
  emit('terkirim')
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Minta revisi"
  >
    <UFormField
      :label="`Catatan revisi untuk &quot;${item?.title ?? ''}&quot;`"
      :error="salah ? 'Tulis catatan revisi' : false"
    >
      <UTextarea
        v-model="catatan"
        placeholder="Apa yang perlu diperbaiki?"
        class="w-full"
        @update:model-value="salah = false"
      />
    </UFormField>
    <template #footer>
      <UButton
        label="Kirim revisi"
        :loading="sibuk"
        @click="kirim"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
