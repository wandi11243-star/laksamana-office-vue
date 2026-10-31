<!--
  Agenda form (old `agendaModal`, deploy/bd/index.html:4456-4486). The data field
  is `date`; the SQL column is `tanggal` — the API keeps the app's own field name.
-->
<script setup lang="ts">
import type { BdAgenda, BdPerson } from '~/composables/useBd'
import { bdSimpan, buatBd, hapusBd, ubahBd, versiBaris } from '~/composables/useBd'
import { AGENDA_TIPE, OWNER_DIVS, todayISO } from '~/utils/bd-rumus'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'

const props = defineProps<{
  agenda?: BdAgenda | null
  people: BdPerson[]
  aku?: BdPerson | null
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const f = reactive({ title: '', date: todayISO(), type: 'Meeting', div: OWNER_DIVS[0]! })
const hapusMau = ref(false)

watch(open, (o) => {
  if (!o) return
  const e = props.agenda
  if (e) {
    f.title = e.title
    f.date = e.date || todayISO()
    f.type = e.type || 'Meeting'
    f.div = e.div || OWNER_DIVS[0]!
  }
  else {
    const aku = props.aku
    f.title = ''
    f.date = todayISO()
    f.type = 'Meeting'
    f.div = aku && OWNER_DIVS.includes(aku.div) ? aku.div : OWNER_DIVS[0]!
  }
})

async function simpan() {
  if (!f.title.trim()) {
    toast.add({ title: 'Judul agenda wajib diisi.', color: 'error' })
    return
  }
  const body: Partial<BdAgenda> = { title: f.title.trim(), date: f.date, type: f.type, div: f.div }
  const lama = props.agenda
  const ok = lama
    ? await bdSimpan(() => ubahBd<BdAgenda>('agenda', lama.id, { ...body, id: lama.id }, versiBaris(lama)), 'Agenda diperbarui')
    : await bdSimpan(() => buatBd<BdAgenda>('agenda', body), 'Agenda ditambahkan')
  if (ok) open.value = false
}

async function hapus() {
  const lama = props.agenda
  if (!lama) return
  hapusMau.value = false
  const ok = await bdSimpan(() => hapusBd('agenda', lama.id, versiBaris(lama)), 'Agenda dihapus')
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="agenda ? 'Edit agenda' : 'Agenda baru'"
    description="Agenda internal tim BD."
  >
    <div class="grid gap-4">
      <UFormField label="Judul agenda">
        <UInput
          v-model="f.title"
          placeholder="mis. Meeting mingguan tim BD"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Tanggal">
          <UInput
            v-model="f.date"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jenis">
          <USelect
            v-model="f.type"
            :items="AGENDA_TIPE"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Divisi">
          <USelect
            v-model="f.div"
            :items="OWNER_DIVS"
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="rounded-xl border border-default bg-muted p-3 text-xs text-muted">
        Agenda di sini adalah agenda <b>internal tim BD</b>. Acara perusahaan (event klien, jadwal talent)
        tetap dikelola di modul Marketing dan Event — jadwal gabungannya dibaca di modul Radar.
      </p>
    </div>

    <template #footer>
      <UButton
        label="Simpan"
        icon="i-lucide-check"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="agenda"
        label="Hapus"
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        @click="hapusMau = true"
      />
    </template>
  </ResponsiveSheet>

  <BdKonfirmasi
    v-model:open="hapusMau"
    title="Hapus agenda ini?"
    @konfirmasi="hapus"
  />
</template>
