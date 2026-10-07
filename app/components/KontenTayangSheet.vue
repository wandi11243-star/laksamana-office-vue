<!--
  "Tandai sudah tayang" for one content item (old markPublished +
  submitPublish, deploy/konten/index.html:2470-2477). Used by the detail page
  and by Publishing's "Tayang". Saves publishRecord {platform, platforms, url,
  at, pic} and status Posted; an empty URL is stored as '-', like the old one.
  The time box defaults to now in LOCAL time (the old default took UTC, so
  before 07:00 WIB it showed yesterday — corrected here, konten.md J).
-->
<script setup lang="ts">
import type { KontenItem } from '~/utils/konten'
import { contentPlatforms } from '~/utils/konten'

const props = defineProps<{ item: KontenItem | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ tersimpan: [] }>()

const { saya } = useAksesKonten()
const url = ref('')
const at = ref('')
const sibuk = ref(false)

watch(open, (v) => {
  if (!v) return
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  at.value = d.toISOString().slice(0, 16)
  url.value = ''
})

async function simpan() {
  const c = props.item
  if (!c) return
  const rec = {
    platform: c.platform, platforms: contentPlatforms(c), url: url.value.trim() || '-',
    at: at.value ? new Date(at.value).toISOString() : new Date().toISOString(), pic: saya.value?.user.id,
  }
  sibuk.value = true
  const ok = await kontenSimpan(
    () => tambalKonten<KontenItem>('content', c.id, { publishRecord: rec as unknown as KontenItem['publishRecord'], status: 'Posted' }, c.updatedAt),
    'Konten ditandai tayang',
    { action: 'mempublikasikan', target: c.title },
  )
  sibuk.value = false
  if (!ok) return
  notifKonten('publish', `Konten tayang: ${c.title}`)
  open.value = false
  emit('tersimpan')
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Tandai sudah tayang"
  >
    <div class="space-y-3">
      <p
        v-if="item"
        class="text-sm text-muted"
      >
        {{ item.title || '(tanpa judul)' }}
      </p>
      <UFormField label="URL konten">
        <UInput
          v-model="url"
          placeholder="https://…"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Waktu tayang aktual">
        <UInput
          v-model="at"
          type="datetime-local"
          class="w-full"
        />
      </UFormField>
    </div>
    <template #footer>
      <UButton
        label="Sudah tayang"
        icon="i-lucide-circle-check"
        :loading="sibuk"
        @click="simpan"
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
