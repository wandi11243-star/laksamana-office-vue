<!--
  Template task form (newTemplateTask / saveTemplateTask,
  deploy/marketing/index.html:13140-13175). The sub category picker is
  always shown — also when the category has none yet — so the level is
  visible. "Task wajib" when the name is empty.
-->
<script setup lang="ts">
import type { SubKatMkt, TemplateTugasMkt } from '~/utils/marketing-tugas'
import { barisTemplateMkt, subsDariMkt } from '~/utils/marketing-tugas'

const props = defineProps<{ div: string, awal?: TemplateTugasMkt | null, subAwal?: string, subs: SubKatMkt[], staf: string[], sibuk?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ simpan: [baris: Omit<TemplateTugasMkt, 'id'>] }>()

const TANPA = '__none'
const toast = useToast()
const f = reactive({ task: '', sub: TANPA, pic: '', hminus: '', deadline: '', note: '' })
watch(open, (o) => {
  if (!o) return
  const t = props.awal
  Object.assign(f, {
    task: t?.task ?? '', sub: (t ? t.sub : props.subAwal) || TANPA, pic: t?.pic ?? '',
    hminus: t?.hminus != null ? String(t.hminus) : '', deadline: t?.deadline ?? '', note: t?.note ?? '',
  })
}, { immediate: true })

const daftarSub = computed(() => subsDariMkt(props.subs, props.div))
const opsiSub = computed(() => {
  const nama = daftarSub.value.map(x => x.nama)
  if (f.sub !== TANPA && !nama.includes(f.sub)) nama.push(f.sub)
  return [{ value: TANPA, label: '— tanpa sub kategori —' }, ...nama.map(n => ({ value: n, label: n }))]
})
const opsiHm = Array.from({ length: 25 }, (_, i) => String(i * 5))

function kirim() {
  if (!f.task.trim()) return toast.add({ title: 'Task wajib', description: 'Isi nama task dulu.', color: 'error' })
  emit('simpan', barisTemplateMkt({ ...f, div: props.div, sub: f.sub === TANPA ? '' : f.sub }))
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`${awal ? 'Edit' : 'Tambah'} Template Task`"
    :description="`${div}${f.sub !== TANPA ? ` · ${f.sub}` : ''}`"
  >
    <div class="grid grid-cols-1 gap-4">
      <UFormField
        label="Task"
        required
      >
        <UInput
          v-model="f.task"
          class="w-full"
          autofocus
        />
      </UFormField>
      <UFormField
        label="Sub Kategori"
        :help="daftarSub.length ? `Kelompok di dalam ${div}.` : `Belum ada sub kategori di ${div} — buat lewat tombol Sub Kategori.`"
      >
        <USelect
          v-model="f.sub"
          :items="opsiSub"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="PIC">
          <UInput
            v-model="f.pic"
            list="tt-staf"
            placeholder="pilih / ketik nama"
            class="w-full"
          />
          <datalist id="tt-staf">
            <option
              v-for="n in staf"
              :key="n"
              :value="n"
            />
          </datalist>
        </UFormField>
        <UFormField label="H- (hari sebelum event)">
          <UInput
            v-model="f.hminus"
            type="number"
            min="0"
            step="5"
            list="tt-hm"
            placeholder="pilih / ketik, mis. 30"
            class="w-full"
          />
          <datalist id="tt-hm">
            <option
              v-for="n in opsiHm"
              :key="n"
              :value="n"
            />
          </datalist>
        </UFormField>
      </div>
      <UFormField label="Deadline (opsional)">
        <AppTanggal
          v-model="f.deadline"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Catatan">
        <UTextarea
          v-model="f.note"
          autoresize
          class="w-full"
        />
      </UFormField>
    </div>
    <template #footer>
      <UButton
        label="Simpan"
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
