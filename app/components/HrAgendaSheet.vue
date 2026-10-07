<!--
  Agenda HR baru (deploy/hr/index.html addCalEvent :2548-2557). One form, one
  create — the legacy page has no edit, only add and delete.
-->
<script setup lang="ts">
import { hrCreate, hrPostAudit, useHrDasar } from '~/composables/useHr'
import { hariIni } from '~/utils/format'

const KINDS = ['Training', 'Meeting', 'Event', 'Interview', 'Libur', 'Lainnya']

const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { refresh } = useHrDasar()
const sibuk = ref(false)

const date = ref(hariIni())
const kind = ref(KINDS[0]!)
const title = ref('')
const note = ref('')

watch(open, (v) => {
  if (!v) return
  date.value = hariIni()
  kind.value = KINDS[0]!
  title.value = ''
  note.value = ''
})

async function simpan() {
  if (sibuk.value) return
  if (!title.value.trim()) return toast.add({ title: 'Judul wajib.', color: 'error' })
  sibuk.value = true
  try {
    await hrCreate('calendar', { date: date.value, kind: kind.value, title: title.value.trim(), note: note.value })
    try {
      await hrPostAudit('CAL_ADD', title.value.trim())
    }
    catch {
      // Audit is a bonus.
    }
    toast.add({ title: 'Agenda tersimpan', color: 'success' })
    open.value = false
    emit('saved')
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Agenda baru"
  >
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Tanggal">
          <UInput
            v-model="date"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jenis">
          <USelect
            v-model="kind"
            :items="KINDS.map(x => ({ value: x, label: x }))"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="Judul">
        <UInput
          v-model="title"
          placeholder="cth: Briefing bulanan semua kru"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Catatan">
        <UInput
          v-model="note"
          class="w-full"
        />
      </UFormField>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan agenda'"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
