<!--
  Project form (old `projModal`, deploy/bd/index.html:1995-2063). Progress is
  COMPUTED, never a manual number; closing a project (stage â†’ Completed) closes
  its tasks, only on the stage change.
-->
<script setup lang="ts">
import type { BdCoord, BdPerson, BdPo, BdProject, BdTask } from '~/composables/useBd'
import { bdSimpan, buatBd, hapusBd, tambalBd, ubahBd, versiBaris } from '~/composables/useBd'
import { PROJ_HEALTH, PROJ_STAGES, bacaMilestone, divisiBawaan, inDays, opsiDivisi, setPics, tasksPerluDitutup, todayISO, tulisMilestone } from '~/utils/bd-rumus'
import { PILIHAN_WARNA_KATEGORI } from '~/utils/kategori-warna'
import BdProjectGroup from '~/widgets/bd/BdProjectGroup.vue'
import { LABEL_HEALTH } from '~/utils/status-bd'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdPicPicker from '~/widgets/bd/BdPicPicker.vue'

const props = defineProps<{
  project?: BdProject | null
  projects: BdProject[]
  tasks: BdTask[]
  po: BdPo[]
  coord: BdCoord[]
  people: BdPerson[]
  aku?: BdPerson | null
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

/** Division choices: crew-used divisions first, then every Office Tim.
 * The edited row's own div is unioned in, so a stored legacy division never
 * drops out of the select even when no crew carries it any more. */
const opsiDiv = computed(() => opsiDivisi([...props.people, { div: props.project?.div }]))
const grupBisnis = computed(() => [...new Set(props.projects
  .map(p => p.businessGroup?.trim() ?? '')
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b, 'id')))])
const opsiGrupBisnis = computed(() => [
  { label: 'Tanpa grup bisnis', value: '' },
  ...grupBisnis.value.map(nama => ({ label: nama, value: nama })),
])

const f = reactive({
  name: '',
  businessGroup: '',
  businessGroupColor: 'auto',
  desc: '',
  div: '',
  type: 'Internal',
  stage: 'Idea',
  pics: [] as string[],
  start: todayISO(),
  end: inDays(30),
  budget: 0,
  spent: 0,
  health: 'on-track',
  ms: '',
})
const hapusMau = ref(false)
const opsiHealth = PROJ_HEALTH.map(k => ({ value: k, label: LABEL_HEALTH[k] || k }))

watch(open, (o) => {
  if (!o) return
  const p = props.project
  f.businessGroup = p?.businessGroup || ''
  f.businessGroupColor = p?.businessGroupColor || 'auto'
  if (p) {
    f.name = p.name
    f.desc = p.desc || ''
    f.div = p.div || opsiDiv.value[0]!
    f.type = p.type || 'Internal'
    f.stage = p.stage
    f.pics = [...(p.pics || (p.pic ? [p.pic] : []))]
    f.start = p.start || ''
    f.end = p.end || ''
    f.budget = Number(p.budget) || 0
    f.spent = Number(p.spent) || 0
    f.health = p.health || 'on-track'
    f.ms = tulisMilestone(p.milestones)
  }
  else {
    const aku = props.aku
    f.name = ''
    f.desc = ''
    f.div = divisiBawaan(aku?.div, opsiDiv.value)
    f.type = 'Internal'
    f.stage = 'Idea'
    f.pics = aku ? [aku.id] : []
    f.start = todayISO()
    f.end = inDays(30)
    f.budget = 0
    f.spent = 0
    f.health = 'on-track'
    f.ms = ''
  }
})

async function simpan() {
  if (!f.name.trim()) {
    toast.add({ title: 'Nama project wajib diisi.', color: 'error' })
    return
  }
  const lama = props.project
  const body: Partial<BdProject> = {
    name: f.name.trim(),
    businessGroup: f.businessGroup.trim(),
    businessGroupColor: f.businessGroup.trim() ? f.businessGroupColor : 'auto',
    desc: f.desc.trim(),
    div: f.div,
    type: f.type.trim() || 'Internal',
    stage: f.stage,
    start: f.start,
    end: f.end,
    budget: Number(f.budget) || 0,
    spent: Number(f.spent) || 0,
    health: f.health,
    milestones: bacaMilestone(f.ms, lama?.milestones),
  }
  setPics(body, f.pics)
  const dulu = lama ? lama.stage : ''
  const ikut = (f.stage === 'Done' && dulu !== 'Done') ? tasksPerluDitutup(props.tasks, lama?.id || '') : []
  const aksi = async () => {
    if (lama) await ubahBd<BdProject>('projects', lama.id, { ...body, id: lama.id }, versiBaris(lama))
    else await buatBd<BdProject>('projects', body)
    const pid = lama?.id
    if (pid) {
      for (const t of ikut) await tambalBd<BdTask>('tasks', t.id, { status: 'Done', progress: 100 }, versiBaris(t))
    }
  }
  const pesan = (lama ? 'Project diperbarui' : 'Project ditambahkan') + (ikut.length ? ` â€” ${ikut.length} task ikut jadi Done` : '')
  const ok = await bdSimpan(aksi, pesan)
  if (ok) open.value = false
}

async function hapus() {
  const p = props.project
  if (!p) return
  hapusMau.value = false
  const aksi = async () => {
    for (const t of props.tasks.filter(x => x.project === p.id)) await tambalBd<BdTask>('tasks', t.id, { project: null }, versiBaris(t))
    for (const o of props.po.filter(x => x.project === p.id)) await tambalBd<BdPo>('purchase-orders', o.id, { project: null }, versiBaris(o))
    for (const c of props.coord.filter(x => x.project === p.id)) await tambalBd<BdCoord>('coord-requests', c.id, { project: null }, versiBaris(c))
    await hapusBd('projects', p.id, versiBaris(p))
  }
  const ok = await bdSimpan(aksi, 'Project dihapus')
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="project ? 'Edit project' : 'Project baru'"
    description="Pekerjaan besar berjangka + milestone."
    lebar
  >
    <div class="grid grid-cols-1 gap-4">
      <UFormField label="Nama project">
        <UInput
          v-model="f.name"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Grup bisnis">
          <USelectMenu
            v-model="f.businessGroup"
            :items="opsiGrupBisnis"
            value-key="value"
            placeholder="Pilih grup bisnis"
            :search-input="{ placeholder: 'Cari grup bisnis...' }"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Warna grup bisnis">
          <USelect
            v-model="f.businessGroupColor"
            :items="[{ label: 'Otomatis', value: 'auto' }, ...PILIHAN_WARNA_KATEGORI]"
            :disabled="!f.businessGroup.trim()"
            class="w-full"
          />
          <BdProjectGroup
            class="mt-2"
            :nama="f.businessGroup.trim()"
            :warna="f.businessGroupColor"
          />
        </UFormField>
      </div>
      <UFormField label="Deskripsi">
        <UTextarea
          v-model="f.desc"
          :rows="3"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Divisi">
          <USelect
            v-model="f.div"
            :items="opsiDiv"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tipe">
          <UInput
            v-model="f.type"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Stage">
          <USelect
            v-model="f.stage"
            :items="PROJ_STAGES"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="PIC â€” boleh lebih dari satu">
        <BdPicPicker
          v-model="f.pics"
          :people="people"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Mulai">
          <AppTanggal
            v-model="f.start"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Selesai">
          <AppTanggal
            v-model="f.end"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Budget">
          <UInput
            v-model.number="f.budget"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Terpakai">
          <UInput
            v-model.number="f.spent"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Health">
          <USelect
            v-model="f.health"
            :items="opsiHealth"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="Milestone (satu per baris â€” nama | YYYY-MM-DD)">
        <UTextarea
          v-model="f.ms"
          :rows="4"
          placeholder="Approval design | 2026-08-01"
          class="w-full"
        />
        <template #hint>
          Centang selesai/belumnya dilakukan di halaman detail project.
        </template>
      </UFormField>
    </div>

    <template #footer>
      <UButton
        label="Simpan"
        icon="i-lucide-check"
        loading-auto
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="project"
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
    title="Hapus project ini?"
    description="Task-nya TIDAK ikut terhapus â€” hanya dilepas dari project. Koordinasi dan PO terkait juga dilepas."
    @konfirmasi="hapus"
  />
</template>
