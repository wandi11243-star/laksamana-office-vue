<!--
  Coordination request form (old `coordModal`, deploy/bd/index.html:2145-2187).
  "PIC di divisi tujuan" is FREE TEXT on purpose: the destination crew is not in
  the BD people table, and copying another roster here would only go stale.
-->
<script setup lang="ts">
import type { BdCoord, BdPerson, BdProject } from '~/composables/useBd'
import { bdSimpan, buatBd, hapusBd, ubahBd, versiBaris } from '~/composables/useBd'
import { COORD_DIVS, COORD_FLOW, OWNER_DIVS, PILIHAN_TANPA, PRIORITAS, inDays, opsiProject as opsiProjectBd } from '~/utils/bd-rumus'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'

const props = defineProps<{
  coord?: BdCoord | null
  projects: BdProject[]
  people: BdPerson[]
  aku?: BdPerson | null
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const f = reactive({
  title: '',
  desc: '',
  fromDiv: OWNER_DIVS[0]!,
  toDiv: COORD_DIVS[0]!,
  to: '',
  status: 'Diminta',
  priority: 'Medium',
  due: inDays(3),
  project: null as string | null,
})
const hapusMau = ref(false)

watch(open, (o) => {
  if (!o) return
  const c = props.coord
  if (c) {
    f.title = c.title
    f.desc = c.desc || ''
    f.fromDiv = c.fromDiv || OWNER_DIVS[0]!
    f.toDiv = c.toDiv || COORD_DIVS[0]!
    f.to = c.to || ''
    f.status = c.status
    f.priority = c.priority
    f.due = c.due || ''
    f.project = c.project || null
  }
  else {
    const aku = props.aku
    f.title = ''
    f.desc = ''
    f.fromDiv = aku && OWNER_DIVS.includes(aku.div) ? aku.div : OWNER_DIVS[0]!
    f.toDiv = COORD_DIVS[0]!
    f.to = ''
    f.status = 'Diminta'
    f.priority = 'Medium'
    f.due = inDays(3)
    f.project = null
  }
})

const opsiProject = computed(() => opsiProjectBd(props.projects, f.project))

async function simpan() {
  if (!f.title.trim()) {
    toast.add({ title: 'Judul request wajib diisi.', color: 'error' })
    return
  }
  const body: Partial<BdCoord> = {
    title: f.title.trim(),
    desc: f.desc.trim(),
    fromDiv: f.fromDiv,
    toDiv: f.toDiv,
    to: f.to.trim(),
    status: f.status,
    priority: f.priority,
    due: f.due,
    project: f.project || null,
  }
  const lama = props.coord
  const ok = lama
    ? await bdSimpan(() => ubahBd<BdCoord>('coord-requests', lama.id, { ...body, id: lama.id }, versiBaris(lama)), 'Request diperbarui')
    : await bdSimpan(() => buatBd<BdCoord>('coord-requests', { ...body, by: props.aku?.id || '' }), 'Request koordinasi dibuat')
  if (ok) open.value = false
}

async function hapus() {
  const lama = props.coord
  if (!lama) return
  hapusMau.value = false
  const ok = await bdSimpan(() => hapusBd('coord-requests', lama.id, versiBaris(lama)), 'Request dihapus')
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="coord ? 'Edit request koordinasi' : 'Request ke divisi lain'"
    description="Catatan permintaan kita, bukan task divisi tujuan."
  >
    <div class="grid grid-cols-1 gap-4">
      <UFormField label="Judul request">
        <UInput
          v-model="f.title"
          placeholder="Apa yang diminta ke divisi lain?"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Detail">
        <UTextarea
          v-model="f.desc"
          :rows="3"
          placeholder="Spesifikasi / konteks…"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Divisi peminta">
          <USelect
            v-model="f.fromDiv"
            :items="OWNER_DIVS"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Divisi tujuan">
          <USelect
            v-model="f.toDiv"
            :items="COORD_DIVS"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="PIC di divisi tujuan">
          <UInput
            v-model="f.to"
            placeholder="mis. Chef Roy"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="f.status"
            :items="COORD_FLOW"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Prioritas">
          <USelect
            v-model="f.priority"
            :items="PRIORITAS"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Due">
          <UInput
            v-model="f.due"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Project">
          <USelect
            :model-value="f.project ?? PILIHAN_TANPA"
            :items="opsiProject"
            class="w-full"
            @update:model-value="(v: string | undefined) => { f.project = !v || v === PILIHAN_TANPA ? null : v }"
          />
        </UFormField>
      </div>
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
        v-if="coord"
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
    title="Hapus request koordinasi ini?"
    @konfirmasi="hapus"
  />
</template>
