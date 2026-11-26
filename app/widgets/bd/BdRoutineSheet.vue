<!--
  Routine form (old `routineModal`, deploy/bd/index.html:2226-2268). The
  Eisenhower quadrant comes from the two switches; PIC is single here.
-->
<script setup lang="ts">
import type { BdPerson, BdRoutine } from '~/composables/useBd'
import { bdSimpan, buatBd, hapusBd, ubahBd, versiBaris } from '~/composables/useBd'
import { FREQ, OWNER_DIVS, kuadran } from '~/utils/bd-rumus'
import { WARNA_KUADRAN } from '~/utils/status-bd'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'

const props = defineProps<{
  routine?: BdRoutine | null
  people: BdPerson[]
  aku?: BdPerson | null
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const f = reactive({
  name: '',
  div: 'Purchasing',
  pic: '',
  freq: 'Daily',
  time: '',
  done: 0,
  total: 0,
  missed: 0,
  important: false,
  urgent: true,
  active: true,
})
const hapusMau = ref(false)

const kru = computed(() => {
  const sudah = f.pic
  return props.people.filter(p => (p.active !== false && !p.tanpaAkses) || p.id === sudah)
})
const opsiPic = computed(() => kru.value.map(p => ({ value: p.id, label: p.name + (p.tanpaAkses ? ' (akses dicabut)' : p.role ? ` — ${p.role}` : '') })))

watch(open, (o) => {
  if (!o) return
  const r = props.routine
  if (r) {
    f.name = r.name
    f.div = r.div || 'Purchasing'
    f.pic = r.pic || ''
    f.freq = r.freq || 'Daily'
    f.time = r.time || ''
    f.done = Number(r.done) || 0
    f.total = Number(r.total) || 0
    f.missed = Number(r.missed) || 0
    f.important = !!r.important
    f.urgent = !!r.urgent
    f.active = r.active !== false
  }
  else {
    const aku = props.aku
    f.name = ''
    f.div = aku && OWNER_DIVS.includes(aku.div) ? aku.div : 'Purchasing'
    f.pic = aku?.id || props.people[0]?.id || ''
    f.freq = 'Daily'
    f.time = ''
    f.done = 0
    f.total = 0
    f.missed = 0
    f.important = false
    f.urgent = true
    f.active = true
  }
})

// The schedule stays one string ("Jumat 16:00"): the day is typed, the time picked.
const jadwal = computed(() => {
  const m = f.time.match(/^(.*?) ?(\d{1,2}[:.]\d{2})$/)
  return { hari: m ? m[1]! : f.time, jam: m ? m[2]!.replace('.', ':').padStart(5, '0') : '' }
})
const susunJadwal = (hari: string, jam: string) => [hari, jam].filter(Boolean).join(' ')
const jadwalHari = computed({
  get: () => jadwal.value.hari,
  set: (v: string) => {
    f.time = susunJadwal(v, jadwal.value.jam)
  },
})
const jadwalJam = computed({
  get: () => jadwal.value.jam,
  set: (v: string) => {
    f.time = susunJadwal(jadwal.value.hari.trim(), v)
  },
})

const q = computed(() => kuadran(f))

async function simpan() {
  if (!f.name.trim()) {
    toast.add({ title: 'Nama routine wajib diisi.', color: 'error' })
    return
  }
  const body: Partial<BdRoutine> = {
    name: f.name.trim(),
    div: f.div,
    pic: f.pic,
    freq: f.freq,
    time: f.time.trim(),
    done: Number(f.done) || 0,
    total: Number(f.total) || 0,
    missed: Number(f.missed) || 0,
    important: f.important,
    urgent: f.urgent,
    active: f.active,
  }
  const lama = props.routine
  const ok = lama
    ? await bdSimpan(() => ubahBd<BdRoutine>('routines', lama.id, { ...body, id: lama.id }, versiBaris(lama)), 'Routine diperbarui')
    : await bdSimpan(() => buatBd<BdRoutine>('routines', body), 'Routine ditambahkan')
  if (ok) open.value = false
}

async function hapus() {
  const lama = props.routine
  if (!lama) return
  hapusMau.value = false
  const ok = await bdSimpan(() => hapusBd('routines', lama.id, versiBaris(lama)), 'Routine dihapus')
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="routine ? 'Edit routine' : 'Routine baru'"
    description="Task berulang & kepatuhannya."
    lebar
  >
    <div class="grid grid-cols-1 gap-4">
      <UFormField label="Nama routine">
        <UInput
          v-model="f.name"
          placeholder="Task berulang…"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Divisi">
          <USelect
            v-model="f.div"
            :items="OWNER_DIVS"
            class="w-full"
          />
        </UFormField>
        <UFormField label="PIC">
          <USelect
            v-model="f.pic"
            :items="opsiPic"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Frekuensi">
          <USelect
            v-model="f.freq"
            :items="FREQ"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Waktu / jadwal">
          <div class="flex gap-2">
            <UInput
              v-model="jadwalHari"
              placeholder="mis. Jumat"
              aria-label="Hari atau tanggal jadwal"
              class="min-w-0 flex-1"
            />
            <AppJam
              v-model="jadwalJam"
              aria-label="Jam jadwal"
              class="!w-28 shrink-0"
            />
          </div>
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Terlaksana">
          <UInput
            v-model.number="f.done"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Seharusnya">
          <UInput
            v-model.number="f.total"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Terlewat">
          <UInput
            v-model.number="f.missed"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
      </div>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Prioritas Eisenhower
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <AppPilihan
            v-model="f.important"
            name="routine-important"
            :options="[{ value: true, label: 'Penting: ya' }, { value: false, label: 'Tidak' }]"
          />
          <AppPilihan
            v-model="f.urgent"
            name="routine-urgent"
            :options="[{ value: true, label: 'Mendesak: ya' }, { value: false, label: 'Tidak' }]"
          />
        </div>
        <div class="mt-2">
          <AppStatus
            :color="WARNA_KUADRAN[q.k]"
            size="sm"
          >
            {{ q.l }} — {{ q.d }}
          </AppStatus>
        </div>
      </div>
      <UFormField label="Status">
        <UCheckbox
          v-model="f.active"
          label="Aktif"
        />
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
        v-if="routine"
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
    title="Hapus routine ini beserta catatan kepatuhannya?"
    @konfirmasi="hapus"
  />
</template>
