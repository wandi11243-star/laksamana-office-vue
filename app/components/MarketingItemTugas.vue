<!--
  One to-do on the Task Divisi board (taskBoard / freeBoard rows,
  deploy/marketing/index.html:12570-12680). A template item takes its name
  and H- from Template Task (changed there, for every event); PIC, deadline
  and note are per EVENT (jobMeta). An extra item is typed here in full.
  Every change emits the top-level event fields to PATCH; nothing is kept
  locally, so the next state read is the truth.
-->
<script setup lang="ts">
import type { EventMkt } from '~/utils/marketing'
import type { ItemTugasMkt, PapanEventMkt } from '~/utils/marketing-tugas'
import {
  jobFieldMkt, jobSelesaiMkt, setJobMetaMkt, setJobTambahanMkt, toggleSelesaiMkt,
} from '~/utils/marketing-tugas'

const props = defineProps<{ ev: EventMkt, div: string, item: ItemTugasMkt, bisaUbah: boolean, staf: string[], namaBebas?: boolean }>()
const emit = defineEmits<{ simpan: [fields: Partial<PapanEventMkt>], hapus: [], wa: [] }>()

const KOSONG = '__none'
const selesai = computed(() => jobSelesaiMkt(props.ev, props.div, props.item.id))
const nilai = (f: 'pic' | 'deadline' | 'note') => jobFieldMkt(props.ev, props.div, props.item, f)
const opsiPic = computed(() => {
  const kini = nilai('pic')
  const nama = [...props.staf]
  if (kini && !nama.includes(kini)) nama.unshift(kini)
  return [{ value: KOSONG, label: '— pilih —' }, ...nama.map(n => ({ value: n, label: n }))]
})

function ubah(field: 'pic' | 'deadline' | 'note' | 'task' | 'hminus', v: string) {
  if (field !== 'task' && field !== 'hminus' && v === nilai(field)) return
  if (props.item.extra) emit('simpan', setJobTambahanMkt(props.ev, props.div, props.item.id, field, v))
  else if (field === 'pic' || field === 'deadline' || field === 'note') emit('simpan', setJobMetaMkt(props.ev, props.div, props.item.id, field, v))
}
const dariInput = (e: Event) => (e.target as HTMLInputElement).value
</script>

<template>
  <div
    class="grid grid-cols-[2rem_1fr_auto] items-center gap-x-2 gap-y-2 border-b border-default px-3 py-2.5 last:border-b-0 lg:grid-cols-[2rem_minmax(10rem,1fr)_5rem_10rem_9.5rem_minmax(8rem,1fr)_4.5rem]"
    :class="selesai ? 'bg-success/5' : ''"
  >
    <UCheckbox
      :model-value="selesai"
      :disabled="!bisaUbah"
      :aria-label="selesai ? 'Tandai belum selesai' : 'Tandai selesai'"
      @update:model-value="emit('simpan', toggleSelesaiMkt(ev, div, item.id))"
    />

    <div class="min-w-0">
      <UInput
        v-if="item.extra && bisaUbah"
        :model-value="item.task ?? ''"
        :placeholder="namaBebas ? 'Nama tugas…' : 'Nama item…'"
        :aria-label="namaBebas ? 'Nama tugas' : 'Nama item'"
        size="sm"
        class="w-full"
        @change="ubah('task', dariInput($event))"
      />
      <p
        v-else
        class="text-sm"
        :class="selesai ? 'text-muted line-through' : 'font-medium text-highlighted'"
      >
        {{ item.task || '(tanpa nama)' }}
        <UBadge
          v-if="item.extra && !namaBebas"
          label="tambahan"
          color="primary"
          variant="soft"
          size="sm"
        />
      </p>
    </div>

    <div class="flex justify-end gap-1 lg:order-last">
      <template v-if="bisaUbah">
        <UButton
          icon="i-lucide-message-circle"
          size="xs"
          color="neutral"
          variant="ghost"
          aria-label="Ingatkan PIC via WhatsApp"
          @click="emit('wa')"
        />
        <UButton
          v-if="item.extra"
          icon="i-lucide-trash-2"
          size="xs"
          color="error"
          variant="ghost"
          :aria-label="namaBebas ? 'Hapus tugas' : 'Hapus item tambahan'"
          @click="emit('hapus')"
        />
      </template>
    </div>

    <div class="col-span-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:col-span-1 lg:contents">
      <div>
        <UInput
          v-if="item.extra && bisaUbah"
          :model-value="item.hminus != null ? String(item.hminus) : ''"
          type="number"
          min="0"
          step="5"
          placeholder="H-"
          size="sm"
          aria-label="Timeline (H-)"
          class="w-full"
          @change="ubah('hminus', dariInput($event))"
        />
        <span
          v-else
          class="num text-xs text-muted"
        >{{ item.hminus != null ? `H-${item.hminus}` : '—' }}</span>
      </div>
      <USelect
        :model-value="nilai('pic') || KOSONG"
        :items="opsiPic"
        :disabled="!bisaUbah"
        size="sm"
        aria-label="PIC"
        class="w-full"
        @update:model-value="ubah('pic', $event === KOSONG ? '' : String($event))"
      />
      <AppTanggal
        :model-value="nilai('deadline')"
        :disabled="!bisaUbah"
        size="sm"
        aria-label="Deadline"
        class="w-full"
        @update:model-value="ubah('deadline', $event)"
      />
      <UInput
        :model-value="nilai('note')"
        placeholder="Catatan…"
        :disabled="!bisaUbah"
        size="sm"
        aria-label="Catatan"
        class="w-full"
        @change="ubah('note', dariInput($event))"
      />
    </div>
  </div>
</template>
