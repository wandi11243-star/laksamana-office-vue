<!--
  Ekspor jadwal for Talenta (deploy/jadwal/index.html exportExcel/
  gambarPilihEkspor :5913-6010): pick the crew (all ticked by default — only a
  file gets downloaded), search by name, Employee ID or position. A person with
  no Employee ID is flagged in red: Talenta accepts the row and silently skips
  it. CSV, not .xlsx, per K-05 (1).
-->
<script setup lang="ts">
import type { KruJadwal, PetaSel, SettingJadwal } from '~/utils/jadwal'
import { csvJadwal, namaDivisiJadwal, unduhCsvJadwal } from '~/utils/jadwal'

const props = defineProps<{
  set: SettingJadwal
  peta: PetaSel
  kru: KruJadwal[]
  hari: string[]
  judul: string
  namaBerkas: string
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const pilih = ref(new Set<string>())
const q = ref('')
watch(open, (v) => {
  if (v) {
    pilih.value = new Set(props.kru.map(u => u.id))
    q.value = ''
  }
})
const daftar = computed(() => {
  const s = q.value.trim().toLowerCase()
  return props.kru.filter(u => !s || [u.name, u.talentaId, u.jobPosition, namaDivisiJadwal(u.divisi)].some(x => String(x || '').toLowerCase().includes(s)))
})
const n = computed(() => props.kru.filter(u => pilih.value.has(u.id)).length)
function toggle(id: string) {
  const s = new Set(pilih.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  pilih.value = s
}
function semua(v: boolean) {
  const s = new Set(pilih.value)
  for (const u of daftar.value) {
    if (v) s.add(u.id)
    else s.delete(u.id)
  }
  pilih.value = s
}
function unduh() {
  const kru = props.kru.filter(u => pilih.value.has(u.id))
  unduhCsvJadwal(props.namaBerkas, csvJadwal(props.set, props.peta, kru, props.hari))
  const tanpa = kru.filter(u => !String(u.talentaId || '').trim()).length
  toast.add({ title: `${kru.length} kru diekspor${tanpa ? ` — ${tanpa} belum punya Employee ID` : ''}`, color: tanpa ? 'warning' : 'success' })
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`Ekspor ${judul} · ${n} dari ${kru.length}`"
    description="Hilangkan centang kru yang tidak perlu ikut. Bawaannya semua tercentang."
  >
    <div class="space-y-2 text-sm">
      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Cari nama, Employee ID, jabatan…"
          class="min-w-40 flex-1"
        />
        <UButton
          :label="q ? 'Centang yang tampil' : 'Centang semua'"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="semua(true)"
        />
        <UButton
          label="Kosongkan"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="semua(false)"
        />
      </div>
      <div class="max-h-80 divide-y divide-default overflow-y-auto rounded-field border border-default">
        <label
          v-for="u in daftar"
          :key="u.id"
          class="flex cursor-pointer items-center gap-3 px-3 py-2"
          :class="!pilih.has(u.id) && 'opacity-60'"
        >
          <UCheckbox
            :model-value="pilih.has(u.id)"
            @update:model-value="toggle(u.id)"
          />
          <span class="min-w-0">
            <b class="block truncate text-highlighted">{{ u.name }}</b>
            <span class="text-muted">{{ namaDivisiJadwal(u.divisi) }} ·
              <span
                v-if="u.talentaId"
                class="num"
              >{{ u.talentaId }}</span>
              <span
                v-else
                class="text-error"
              >belum punya Employee ID</span>
            </span>
          </span>
        </label>
        <p
          v-if="!daftar.length"
          class="px-3 py-6 text-center text-muted"
        >
          Tidak ada yang cocok.
        </p>
      </div>
    </div>
    <template #footer>
      <UButton
        :label="n ? `Unduh ${n} kru` : 'Belum ada yang dicentang'"
        icon="i-lucide-download"
        :disabled="!n"
        @click="unduh"
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
