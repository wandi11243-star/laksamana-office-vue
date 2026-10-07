<!--
  Tunjuk DW untuk satu permintaan (deploy/dw/index.html bukaTunjuk/kirimTunjuk
  :3707-3903). HRD only: a head's request names a need, HRD decides who fills
  it. Head suggestions arrive pre-checked but are still only suggestions
  (F.17); assignment approves at once and tags the request.

  Candidates are ordered 'lama' — HRD keeps the rotation fair (:3120) — and
  the ones whose hours clash are disabled before sending. `tertahan` from the
  server is reported, never skipped silently (:3673).
-->
<script setup lang="ts">
import type { PekerjaDw, PermintaanDw } from '~/utils/dw'
import { bentrokOrangJam, jamBertindihOffset, kandidatDw, opsiPosisiDw, posPekerja } from '~/utils/dw'
import { namaDivisiJadwal } from '~/utils/jadwal'
import { tugaskanDw, useDwDasar } from '~/composables/useDw'
import { fTgl } from '~/utils/format'

const props = defineProps<{ x: PermintaanDw | null }>()
const emit = defineEmits<{ assigned: [pesan: string] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { set, ajuan, pekerja, permintaan } = useDwDasar()

const pilih = ref<string[]>([])
const cari = ref('')
const pos = ref('')
const sibuk = ref(false)
const tertahan = ref<string[]>([])

watch(open, (v) => {
  if (!v || !props.x) return
  pos.value = props.x.posisi
  cari.value = ''
  tertahan.value = []
  // Suggested names still unassigned arrive checked.
  const sudah = ajuan.value.filter(a => a.permintaanId === props.x!.id && (a.status === 'MENUNGGU' || a.status === 'DISETUJUI')).map(a => a.dwId)
  pilih.value = (props.x.usulan || []).filter(id => !sudah.includes(id))
})

const opsiPosisi = computed(() => (props.x ? opsiPosisiDw(set.value, props.x.divisi, pos.value) : []))
const kandidat = computed(() => (props.x ? kandidatDw(pekerja.value, props.x.divisi, pos.value, 'lama') : []))
const tersaring = computed(() => {
  const q = cari.value.trim().toLowerCase()
  if (!q) return kandidat.value
  return kandidat.value.filter(p => String(p.nama).toLowerCase().includes(q) || String(p.posisi).toLowerCase().includes(q))
})
const sudahDitugaskan = computed(() => (props.x ? ajuan.value.filter(a => a.permintaanId === props.x!.id && (a.status === 'MENUNGGU' || a.status === 'DISETUJUI')) : []))
const kurang = computed(() => (props.x ? Math.max(0, Math.max(1, props.x.jumlah) - sudahDitugaskan.value.length) : 0))

function bentrok(p: PekerjaDw) {
  if (!props.x) return null
  return bentrokOrangJam(ajuan.value, p.id, props.x.tgl, props.x.m, props.x.s)
}
function dipesanLain(p: PekerjaDw) {
  if (!props.x) return null
  return permintaan.value.find(x => x.status === 'MENUNGGU' && x.id !== props.x!.id && x.divisi !== props.x!.divisi
    && x.tgl === props.x!.tgl && x.usulan.includes(p.id) && jamBertindihOffset(x.m, x.s, 0, props.x!.m, props.x!.s))
}
function toggle(p: PekerjaDw) {
  if (bentrok(p)) return
  const i = pilih.value.indexOf(p.id)
  if (i > -1) pilih.value.splice(i, 1)
  else pilih.value.push(p.id)
}

async function kirim() {
  if (!props.x || sibuk.value) return
  if (!pilih.value.length) return toast.add({ title: 'Pilih dulu siapa orangnya', color: 'error' })
  sibuk.value = true
  try {
    const r = await tugaskanDw(props.x.id, pilih.value)
    const t = r.data?.tertahan ?? []
    tertahan.value = t.map(b => (b.nama || '?') + (b.divisi ? ` (sudah di ${namaDivisiJadwal(b.divisi)})` : ''))
    const masuk = r.data?.masuk ?? 0
    open.value = false
    emit('assigned', t.length
      ? `${masuk} ditugaskan, ${t.length} tertahan bentrok: ${tertahan.value.join(', ')}`
      : `${masuk} daily worker disetujui — masuk kalender Jadwal Shift`)
  }
  catch (e) {
    toast.add({ title: `Gagal menugaskan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="x ? `Tunjuk DW — ${namaDivisiJadwal(x.divisi)} ${fTgl(x.tgl)}` : 'Tunjuk DW'"
  >
    <div
      v-if="x"
      class="space-y-4"
    >
      <div class="rounded-field bg-muted px-3 py-2 text-sm">
        <b class="text-highlighted">{{ x.jumlah }} orang</b> · <span class="num">{{ x.m }}–{{ x.s }}</span> · {{ x.posisi || 'tanpa posisi' }}
        <p
          v-if="x.catatan"
          class="mt-1 text-muted"
        >
          "{{ x.catatan }}"
        </p>
        <p
          v-if="sudahDitugaskan.length"
          class="mt-1 text-muted"
        >
          Sudah ditugaskan: {{ sudahDitugaskan.length }} orang ({{ sudahDitugaskan.map(a => a.dwId).join(', ') }})
        </p>
      </div>

      <UFormField label="Posisi">
        <USelect
          v-model="pos"
          :items="opsiPosisi"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="`Pilih DW (${pilih.length} dipilih${kurang ? `, kurang ${kurang}` : ''})`">
        <div class="space-y-2">
          <UInput
            v-if="kandidat.length >= 8"
            v-model="cari"
            icon="i-lucide-search"
            placeholder="Cari nama…"
            class="w-full"
          />
          <div class="max-h-72 space-y-1.5 overflow-y-auto pe-1">
            <label
              v-for="p in tersaring"
              :key="p.id"
              class="flex items-start gap-2 rounded-field border px-3 py-2"
              :class="[
                pilih.includes(p.id) ? 'border-primary-400 bg-primary-100/60' : 'border-default',
                bentrok(p) ? 'opacity-60' : 'cursor-pointer',
              ]"
            >
              <input
                type="checkbox"
                class="mt-1"
                :checked="pilih.includes(p.id)"
                :disabled="!!bentrok(p)"
                @change="toggle(p)"
              >
              <span class="min-w-0 text-sm">
                <b class="text-highlighted">{{ p.nama }}</b>
                <span
                  v-if="posPekerja(p).length"
                  class="text-muted"
                > · {{ posPekerja(p).join(', ') }}</span>
                <span
                  v-if="bentrok(p)"
                  class="block text-error"
                >bentrok {{ namaDivisiJadwal(bentrok(p)!.divisi) }} <span class="num">{{ bentrok(p)!.m }}–{{ bentrok(p)!.s }}</span></span>
                <span
                  v-else-if="dipesanLain(p)"
                  class="block text-warning"
                >diusulkan {{ namaDivisiJadwal(dipesanLain(p)!.divisi) }} yang jamnya bertindih</span>
              </span>
            </label>
            <p
              v-if="!tersaring.length"
              class="rounded-field bg-muted px-3 py-2 text-sm text-muted"
            >
              Tidak ada kandidat untuk divisi dan posisi ini.
            </p>
          </div>
        </div>
      </UFormField>
      <p class="text-sm text-muted">
        Yang ditugaskan <b>langsung disetujui</b> dan muncul di kalender Jadwal Shift; penggantinya bukan lewat sini,
        melainkan lewat <b>Ganti orang</b> di Konfirmasi Kehadiran.
      </p>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menugaskan…' : `Tugaskan ${pilih.length || ''}`"
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
