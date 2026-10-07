<!--
  Ganti orang pada satu shift (deploy/dw/index.html bukaGantiOrang/
  gantiOrangKirim :6604-6657). The old row turns ALFA ("Digantikan <nama>")
  and the stand-in is born as a NEW approved + present row, so pay moves with
  no extra step (F.21). The consequence is stated before pressing: one person
  stops being paid, another starts.

  Candidates are clamped to the shift's division and position, ordered 'lama'
  — a replacement is found in a hurry, and the rotation is the fairest offer.
-->
<script setup lang="ts">
import type { AjuanDw } from '~/utils/dw'
import { kandidatDw, posPekerja } from '~/utils/dw'
import { namaDivisiJadwal } from '~/utils/jadwal'
import { gantiOrangDw, useDwDasar } from '~/composables/useDw'
import { fTgl } from '~/utils/format'

const props = defineProps<{ a: AjuanDw | null }>()
const emit = defineEmits<{ done: [pesan: string] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { pekerja } = useDwDasar()
const dwBaru = ref('')
const nota = ref('')
const sibuk = ref(false)
/** Reka UI forbids SelectItem value ''; this is the "belum dipilih" sentinel. */
const KOSONG = '__kosong__'

watch(open, (v) => {
  if (!v) return
  dwBaru.value = KOSONG
  nota.value = ''
})

const kand = computed(() => {
  const a = props.a
  if (!a) return []
  return kandidatDw(pekerja.value, a.divisi, a.posisi, 'lama').filter(p => p.id !== a.dwId)
})

async function kirim() {
  if (!props.a || sibuk.value) return
  if (dwBaru.value === KOSONG) return toast.add({ title: 'Pilih dulu penggantinya', color: 'error' })
  sibuk.value = true
  try {
    await gantiOrangDw(props.a.id, dwBaru.value, nota.value)
    const nama = pekerja.value.find(p => p.id === dwBaru.value)?.nama ?? 'pengganti'
    open.value = false
    emit('done', `Pengganti dicatat — ${nama} yang dibayar`)
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
const awalKosong = computed(() => kand.value.length === 0)
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="a ? `Ganti orang — ${fTgl(a.tgl)}` : 'Ganti orang'"
  >
    <div
      v-if="a"
      class="space-y-4"
    >
      <div class="rounded-field bg-muted px-3 py-2 text-sm">
        <b class="text-highlighted">Yang berhalangan</b>
        <p class="text-muted">
          {{ pekerja.find(p => p.id === a?.dwId)?.nama ?? '(DW dihapus)' }} ·
          {{ namaDivisiJadwal(a?.divisi ?? '') }} · {{ a?.posisi || '—' }} · <span class="num">{{ a?.m }}–{{ a?.s }}</span>
        </p>
      </div>

      <div
        v-if="awalKosong"
        class="rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        Tidak ada daily worker lain yang berposisi <b>{{ a.posisi || '—' }}</b> di {{ namaDivisiJadwal(a.divisi) }}.
        Tambahkan orangnya di <b>Database DW</b> dulu, atau tandai shift ini <b>Tidak hadir</b> kalau memang tidak
        ada yang menggantikan.
      </div>
      <template v-else>
        <UFormField label="Penggantinya">
          <USelect
            v-model="dwBaru"
            :items="[{ value: KOSONG, label: '— pilih pengganti —' }, ...kand.map(p => ({ value: p.id, label: `${p.nama}${p.terakhirKerja ? ` — terakhir ${p.terakhirKerja}` : ' — belum pernah'}${posPekerja(p).length ? ` · ${posPekerja(p).join(', ')}` : ''}` }))]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Alasan (boleh kosong)">
          <UInput
            v-model="nota"
            placeholder="mis. sakit, ada acara keluarga"
            class="w-full"
          />
        </UFormField>
        <p class="rounded-field bg-info/10 px-3 py-2 text-sm">
          Yang berhalangan ditandai <b>tidak hadir</b> dan <b>tidak ikut dibayar</b>. Penggantinya masuk sebagai
          shift baru yang sudah disetujui dan sudah hadir, jadi dialah yang muncul di daftar transfer. Riwayat
          keduanya tetap tersimpan.
        </p>
      </template>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Ganti orangnya'"
        :loading="sibuk"
        :disabled="awalKosong"
        @click="kirim"
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
