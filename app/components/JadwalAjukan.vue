<!--
  Ajukan Perubahan Jadwal (deploy/jadwal/index.html bukaAjukan/kirimAju
  :4831-4990).

  ONE date, never a range (F.6): a range let one request touch a dozen cells
  that the approver overwrote without seeing them. `sampai` is still sent,
  equal to `dari`, so the row keeps its shape.

  OFF/IZIN/CUTI show the shift they will write; TUKAR asks which shift is
  wanted, so approval can fill the cell instead of leaving it to prose in the
  reason. Hours are never asked: they follow the shift (`jamMulai`/`jamSelesai`
  go out empty, :4975). The current cell is shown so nobody trades a shift
  they cannot see.

  Who can be picked: admin = every active crew; a head = their divisions; crew
  = only themself (:4836). The button locks while sending so a second tap on a
  slow venue network does not create a twin request.
-->
<script setup lang="ts">
import type { KruJadwal, PeranJadwal, SettingJadwal } from '~/utils/jadwal'
import {
  AJU_KE_SHIFT, JENIS_AJU, JENIS_AJU_PILIH, daftarShift, divisiKuasa, jamSel, kelasTeksShift, kunciSel, namaDivisiJadwal,
  petaSel, shiftDef, shiftKruBawaan,
} from '~/utils/jadwal'
import { createRequest, useJadwalCells } from '~/composables/useJadwal'
import { fTgl, hariIni, tambahHari } from '~/utils/format'

const props = defineProps<{
  set: SettingJadwal
  kru: KruJadwal[]
  peran: PeranJadwal
  /** The date clicked on the calendar, if any. */
  tglAwal?: string
}>()
const emit = defineEmits<{ sent: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()

const pool = computed(() => {
  const aktif = props.kru.filter(u => u.active !== false)
  if (props.peran.admin) return aktif
  const kuasa = divisiKuasa(props.peran)
  if (kuasa.length) return aktif.filter(u => kuasa.includes(u.divisi))
  return aktif.filter(u => u.id === props.peran.id)
})

const uid = ref('')
const jenis = ref<typeof JENIS_AJU_PILIH[number]>('OFF')
const tgl = ref('')
const alasan = ref('')
const shiftMinta = ref('')
const sibuk = ref(false)
const dipilih = ref(false)

// The cells this form needs: the chosen date and the two weeks before it
// (current shift, and last week's pattern for the default TUKAR shift).
const cDari = computed(() => tambahHari(tgl.value || hariIni(), -14))
const cSampai = computed(() => tgl.value || hariIni())
const { data: cells } = useJadwalCells('jadwal-cells-ajukan', cDari, cSampai)
const sel = computed(() => petaSel(cells.value ?? []))
watch([sel, uid], () => {
  if (!dipilih.value) shiftMinta.value = shiftKruBawaan(props.set, sel.value, uid.value, tgl.value)
})

watch(open, (v) => {
  if (!v) return
  uid.value = pool.value.some(u => u.id === props.peran.id) ? props.peran.id : (pool.value[0]?.id ?? props.peran.id)
  jenis.value = 'OFF'
  tgl.value = props.tglAwal && /^\d{4}-\d{2}-\d{2}$/.test(props.tglAwal) ? props.tglAwal : hariIni()
  alasan.value = ''
  dipilih.value = false
  shiftMinta.value = shiftKruBawaan(props.set, sel.value, uid.value, tgl.value)
}, { immediate: true })

const opsiKru = computed(() => pool.value.map(u => ({ value: u.id, label: `${u.name} — ${namaDivisiJadwal(u.divisi)}` })))
const opsiJenis = JENIS_AJU_PILIH.map(k => ({ value: k, label: JENIS_AJU[k]! }))

const tetap = computed(() => AJU_KE_SHIFT[jenis.value] ?? '')
const sekarang = computed(() => (uid.value && tgl.value ? sel.value.get(kunciSel(uid.value, tgl.value)) ?? null : null))
const jamSekarang = computed(() => jamSel(props.set, sekarang.value))
const shiftKerja = computed(() => daftarShift(props.set).filter(k => !shiftDef(props.set, k).libur))

async function kirim() {
  if (sibuk.value) return
  if (!uid.value) return toast.add({ title: 'Kru belum dipilih', color: 'error' })
  if (!tgl.value) return toast.add({ title: 'Tanggal belum diisi', color: 'error' })
  const teks = alasan.value.trim()
  if (!teks) return toast.add({ title: 'Isi alasannya dulu', color: 'error' })
  const shift = tetap.value || shiftMinta.value
  if (!shift) return toast.add({ title: 'Pilih shift yang diminta dulu', color: 'error' })
  sibuk.value = true
  try {
    await createRequest({ userId: uid.value, jenis: jenis.value, dari: tgl.value, sampai: tgl.value, alasan: teks, shift, jamMulai: '', jamSelesai: '' })
    open.value = false
    toast.add({ title: 'Pengajuan terkirim ke head divisi', color: 'success' })
    emit('sent')
  }
  catch (e) {
    toast.add({ title: `Gagal mengirim: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Ajukan perubahan jadwal"
  >
    <div class="space-y-4">
      <UFormField
        v-if="pool.length > 1"
        label="Kru"
      >
        <USelect
          v-model="uid"
          :items="opsiKru"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Jenis">
        <USelect
          v-model="jenis"
          :items="opsiJenis"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Tanggal">
        <AppTanggal
          v-model="tgl"
          class="w-full"
        />
      </UFormField>

      <div
        v-if="uid && tgl"
        class="flex flex-wrap items-center gap-2 rounded-field bg-muted px-3 py-2 text-sm"
      >
        <span class="text-muted">Sekarang {{ fTgl(tgl) }}:</span>
        <template v-if="sekarang?.t">
          <JadwalShiftPil
            :def="shiftDef(set, sekarang.t)"
            size="sm"
          />
          <span
            v-if="jamSekarang"
            class="text-muted num"
          >{{ jamSekarang.m }}–{{ jamSekarang.s }}</span>
        </template>
        <i
          v-else
          class="text-muted"
        >belum diatur head</i>
      </div>

      <div
        v-if="tetap"
        class="flex items-center gap-2 rounded-field bg-info/10 px-3 py-2 text-sm"
      >
        <JadwalShiftPil
          :def="shiftDef(set, tetap)"
          size="sm"
        />
        <span>Sel jadwal pada tanggal itu akan diisi <b>{{ shiftDef(set, tetap).n }}</b> begitu disetujui.</span>
      </div>
      <UFormField
        v-else
        label="Shift yang diminta"
      >
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <button
            v-for="k in shiftKerja"
            :key="k"
            type="button"
            class="flex min-h-11 flex-col items-center justify-center rounded-field border-2 px-1 py-1.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-primary"
            :class="[kelasTeksShift(shiftDef(set, k).w), shiftMinta === k ? 'border-ink-900 ring-2 ring-primary-400' : 'border-transparent']"
            :style="{ backgroundColor: shiftDef(set, k).w }"
            :aria-pressed="shiftMinta === k"
            @click="shiftMinta = k; dipilih = true"
          >
            {{ shiftDef(set, k).n }}
            <small class="font-medium opacity-90">{{ shiftDef(set, k).m }}–{{ shiftDef(set, k).s }}</small>
          </button>
        </div>
      </UFormField>

      <UFormField label="Alasan / keterangan">
        <UTextarea
          v-model="alasan"
          :rows="3"
          placeholder="Contoh: ada urusan keluarga, sudah dibicarakan dengan head"
          class="w-full"
        />
      </UFormField>
      <p class="text-sm text-muted">
        Pengajuan masuk ke head divisi untuk diteruskan, lalu disahkan HRD. Begitu disahkan, jadwalnya
        <b>langsung terisi</b> sesuai shift di atas.
      </p>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Mengirim…' : 'Kirim pengajuan'"
        :loading="sibuk"
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
