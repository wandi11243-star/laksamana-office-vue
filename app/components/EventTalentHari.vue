<!--
  Talent Schedule › "Jadwal hari itu": one day's roster in a sheet, with the
  same default-hours logic as the weekly sheet. Talent chips per category: one
  tap puts the talent on that day with the default hours (a second tap adds a
  second show); every row has editable hours. It edits the page's DRAFTS —
  "Simpan jadwal" at the bottom is the page's own save, so it also writes drafts
  of other days; the figure above it says how many.
-->
<script setup lang="ts">
import type { BarisEf, GrupKategori } from '~/utils/event-jadwal'
import { pesanJam } from '~/utils/event-jadwal'
import { tglPanjang } from '~/utils/format'

const props = defineProps<{
  tgl: string | null
  /** Rows of this day: saved + drafts (a deleted draft is drawn struck through). */
  rows: BarisEf[]
  /** Active talents by category, for the chips. */
  grup: GrupKategori[]
  bentrok: Set<string>
  bolehUbah: boolean
  /** "2 baru · 1 diubah · 0 dihapus" or '' when there are no drafts. */
  ringkas: string
  menyimpan: boolean
  nama: (talentId: string) => string
}>()
const emit = defineEmits<{
  tambah: [talentId: string, tgl: string]
  jam: [kunci: string, mulai: string, selesai: string]
  detail: [kunci: string]
  hapus: [kunci: string]
  pulih: [kunci: string]
  simpan: []
}>()
const open = defineModel<boolean>('open', { default: false })

const jumlah = (talentId: string) => props.rows.filter(r => r.talent_id === talentId && r.draf !== 'hapus' && r.status !== 'Cancelled').length
const urut = computed(() => [...props.rows].sort((a, b) => a.start_time.localeCompare(b.start_time) || props.nama(a.talent_id).localeCompare(props.nama(b.talent_id))))
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Jadwal hari itu"
    :description="tgl ? tglPanjang(tgl) : ''"
    lebar="sedang"
  >
    <div
      v-if="tgl"
      class="space-y-4 text-sm"
    >
      <div v-if="bolehUbah">
        <p class="mb-1.5 text-xs font-semibold text-muted">
          Tekan talent untuk menambahkannya dengan jam bawaan
        </p>
        <div
          v-for="g in grup"
          :key="g.kategori"
          class="mb-2"
        >
          <p class="mb-1 text-[11px] font-bold text-muted uppercase">
            {{ g.kategori }}
          </p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="t in g.talents"
              :key="t.id"
              type="button"
              class="rounded-full border px-2.5 py-1 text-xs font-semibold"
              :class="jumlah(t.id) ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted hover:border-accented'"
              :title="jumlah(t.id) ? 'Sudah dijadwalkan: tekan lagi untuk show kedua' : 'Tambahkan dengan jam bawaan'"
              @click="emit('tambah', t.id, tgl)"
            >
              {{ t.nama }}<span
                v-if="jumlah(t.id)"
                class="num"
              > · {{ jumlah(t.id) }}×</span>
            </button>
          </div>
        </div>
        <p
          v-if="!grup.length"
          class="text-xs text-muted"
        >
          Belum ada talent aktif.
        </p>
      </div>

      <div>
        <p class="mb-1.5 text-xs font-semibold text-muted">
          Jadwal di tanggal ini ({{ rows.filter(r => r.draf !== 'hapus').length }})
        </p>
        <p
          v-if="!rows.length"
          class="rounded-field bg-muted px-3 py-4 text-center text-muted"
        >
          Belum ada jadwal.
        </p>
        <ul class="space-y-1.5">
          <li
            v-for="r in urut"
            :key="r.kunci"
            class="rounded-field border px-2.5 py-2"
            :class="bentrok.has(r.kunci) ? 'border-error bg-error/12' : 'border-default'"
          >
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <div
                class="min-w-0 flex-1"
                :class="r.draf === 'hapus' || r.status === 'Cancelled' ? 'line-through opacity-60' : ''"
              >
                <b class="block truncate text-highlighted">{{ nama(r.talent_id) }}</b>
                <span class="text-[11px] text-muted">{{ r.performance_type }}<template v-if="r.status !== 'Scheduled'"> · {{ r.status }}</template><template v-if="r.draf === 'baru'"> · draf baru</template><template v-else-if="r.draf === 'ubah'"> · draf diubah</template></span>
              </div>
              <template v-if="r.draf !== 'hapus'">
                <AppJam
                  :model-value="r.start_time"
                  :disabled="!bolehUbah"
                  :clearable="false"
                  class="w-24"
                  size="sm"
                  @update:model-value="(v: string) => emit('jam', r.kunci, v, r.end_time)"
                />
                <span>–</span>
                <AppJam
                  :model-value="r.end_time"
                  :disabled="!bolehUbah"
                  :clearable="false"
                  class="w-24"
                  size="sm"
                  @update:model-value="(v: string) => emit('jam', r.kunci, r.start_time, v)"
                />
              </template>
              <span
                v-else
                class="text-xs text-muted"
              >dihapus (draf)</span>
              <div class="flex gap-1">
                <UButton
                  v-if="r.draf === 'hapus' && bolehUbah"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  @click="emit('pulih', r.kunci)"
                >
                  Batalkan hapus
                </UButton>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :icon="bolehUbah ? 'i-lucide-pencil' : 'i-lucide-eye'"
                  :aria-label="`Rincian ${nama(r.talent_id)}`"
                  @click="emit('detail', r.kunci)"
                />
                <UButton
                  v-if="bolehUbah && r.draf !== 'hapus'"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :aria-label="`Hapus ${nama(r.talent_id)}`"
                  @click="emit('hapus', r.kunci)"
                />
              </div>
            </div>
            <p
              v-if="r.draf && r.draf !== 'hapus' && pesanJam(r.start_time, r.end_time)"
              class="mt-1 text-xs font-semibold text-error"
            >
              {{ pesanJam(r.start_time, r.end_time) }}
            </p>
            <p
              v-else-if="bentrok.has(r.kunci)"
              class="mt-1 text-xs font-semibold text-error"
            >
              Bentrok dengan jadwal lain talent ini.
            </p>
          </li>
        </ul>
      </div>
    </div>
    <template #footer>
      <UButton
        v-if="bolehUbah && ringkas"
        color="primary"
        :loading="menyimpan"
        @click="emit('simpan')"
      >
        Simpan jadwal
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        @click="open = false"
      >
        {{ bolehUbah && ringkas ? 'Tutup, simpan nanti' : 'Tutup' }}
      </UButton>
      <span
        v-if="bolehUbah && ringkas"
        class="me-auto text-xs text-muted num"
      >Draf: {{ ringkas }}</span>
    </template>
  </ResponsiveSheet>
</template>
