<!--
  Monitor Order › pickup-date box (old `kotakJadwalJemput`,
  `deploy/stock/purchasing/index.html:3366-3500`). Shown for a vendor ticked
  "Barang tidak bisa dijemput di hari yang sama"; one box covers every line of
  that vendor on the card. Picking a date saves it (parent `@simpan`).
-->
<script setup lang="ts">
import { tglPendek } from '~/utils/format'

const props = defineProps<{
  vendor: string
  /** Lines this date applies to. */
  jumlah: number
  /** Current pickup date ('' = not set yet). */
  tgl: string
  /** Earliest pickup: the arrival date. */
  min?: string
  bisaUbah: boolean
  menyimpan: boolean
}>()
const emit = defineEmits<{ simpan: [tgl: string] }>()

const nilai = ref(props.tgl)
watch(() => props.tgl, (v) => {
  nilai.value = v
})
function pilih(v: string) {
  nilai.value = v
  if (v && v !== props.tgl) emit('simpan', v)
}
</script>

<template>
  <div
    class="rounded-xl border-l-4 p-3"
    :class="tgl ? 'border-info bg-info/10' : 'border-warning bg-warning/10'"
  >
    <p
      class="text-xs font-semibold leading-relaxed"
      :class="tgl ? 'text-info' : 'text-warning'"
    >
      Vendor <b>{{ vendor }}</b> tidak bisa dijemput di hari yang sama.
      <template v-if="jumlah > 1">
        Tanggal ini berlaku untuk <b>seluruh {{ jumlah }} item</b> {{ vendor }} di kartu ini.
      </template>
      <template v-else>
        Barang ini muncul di Jemput Hari Ini pada tanggal tersebut.
      </template>
    </p>
    <div class="mt-2 flex flex-wrap items-center gap-2">
      <AppTanggal
        v-if="bisaUbah"
        :model-value="nilai"
        :min="min"
        placeholder="Isi tanggal jemput"
        class="min-w-48 flex-1"
        @update:model-value="pilih(String($event ?? ''))"
      />
      <span
        v-else
        class="text-sm font-bold text-highlighted"
      >{{ tgl ? tglPendek(tgl) : 'Belum diisi' }}</span>
      <UIcon
        v-if="menyimpan"
        name="i-lucide-loader-circle"
        class="size-4 animate-spin text-muted"
      />
      <span
        v-else-if="!tgl"
        class="text-xs font-bold text-warning"
      >Arsip terkunci sampai tanggal diisi</span>
    </div>
  </div>
</template>
