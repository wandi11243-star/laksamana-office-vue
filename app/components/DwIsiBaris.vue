<!--
  Kalender DW — isi satu baris seminggu (deploy/dw/index.html isiBarisDW /
  kirimBarisDW :5189-5316). The tool for entering the same shift across seven
  days; a deliberate SECOND shift on one day stays in the cell sheet. Days
  that already hold something are shown but never re-sent, and past days are
  locked — the weekly tool is not a back door into dates the cell itself
  refuses (:5196).

  Like the cell sheet: HRD writes scheduled shifts, a head writes pengajuan;
  the per-row saves run a few at a time and each one is reported, so a
  mid-way failure still leaves what already landed.
-->
<script setup lang="ts">
import type { AjuanDw, PekerjaDw, PeranDw, SettingDw } from '~/utils/dw'
import { catatanWajibDw, durasiJamDw, jamTambah, opsiPosisiDw, posPekerja, posisiBawaanDivisiDw, posisiDivisiDw, tglLampau } from '~/utils/dw'
import { namaDivisiJadwal } from '~/utils/jadwal'
import { bentrokDari, putusAjuanDw, simpanAjuanDw } from '~/composables/useDw'
import { BATAS_TULIS_PARALEL, petaParalel } from '~/utils/paralel'
import { fTgl, fTglP, tambahHari } from '~/utils/format'

const props = defineProps<{
  set: SettingDw
  peran: PeranDw
  ajuan: AjuanDw[]
  p: PekerjaDw
  senin: string
  div: string
}>()
const emit = defineEmits<{ sent: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const sibuk = ref(false)
const pos = ref('')
const cat = ref('')
const i = ref(0)
interface HariIsi { m: string, s: string, ada?: boolean, status?: string, lampau?: boolean, dobel?: boolean }
const isi = ref<(HariIsi | null)[]>([null, null, null, null, null, null, null])

watch(open, (v) => {
  if (!v) return
  pos.value = posPekerja(props.p).find(x => posisiDivisiDw(props.set, props.div).includes(x)) || posisiBawaanDivisiDw(props.set, props.div)
  cat.value = ''
  isi.value = [0, 1, 2, 3, 4, 5, 6].map((k) => {
    const tgl = tambahHari(props.senin, k)
    if (tglLampau(tgl)) return { m: '', s: '', ada: true, status: 'KEDALUWARSA', lampau: true }
    const xs = props.ajuan
      .filter(a => a.dwId === props.p.id && a.tgl === tgl && (a.status === 'MENUNGGU' || a.status === 'DISETUJUI'))
      .sort((a, b) => String(a.m || '').localeCompare(String(b.m || '')))
    const x = xs[0]
    return x ? { m: x.m, s: x.s, ada: true, status: x.status, dobel: xs.length > 1 } : null
  })
  i.value = barisKosong(0)
})

function barisKosong(dari: number): number {
  for (let n = 0; n < 7; n++) {
    const k = (dari + n) % 7
    if (!isi.value[k]) return k
  }
  return -1
}
const hariTgl = (k: number) => tambahHari(props.senin, k)
const opsiPosisi = computed(() => opsiPosisiDw(props.set, props.div, pos.value))

function pilihJam(j: number) {
  if (i.value < 0) return toast.add({ title: 'Pilih dulu hari yang mau diisi di atas', color: 'error' })
  const h = props.set.jam[j]
  if (!h) return
  isi.value[i.value] = { m: h.m, s: h.s }
  const next = barisKosong((i.value + 1) % 7)
  if (next > -1) i.value = next
}
function kosongkan() {
  if (i.value < 0) return
  const h = isi.value[i.value]
  if (h?.ada) return toast.add({ title: 'Yang sudah tersimpan dibatalkan lewat selnya, bukan dari sini', color: 'warning' })
  isi.value[i.value] = null
}
function ubahJam(f: 'm' | 's', v: string) {
  if (i.value < 0) return
  const h = isi.value[i.value]
  if (!h || h.ada) return
  h[f] = v
  if (f === 'm' && !props.set.jam.some(x => x.m === v && x.s === h.s)) h.s = jamTambah(v, 60 * props.set.jamDasar)
}

async function simpan() {
  if (sibuk.value) return
  const antre = isi.value.map((c, k) => ({ k, c })).filter((x): x is { k: number, c: HariIsi } => !!x.c && !x.c.ada && !x.c.lampau)
  if (!antre.length) return toast.add({ title: 'Belum ada hari baru yang diisi', color: 'warning' })
  if (catatanWajibDw(props.peran) && !cat.value.trim()) {
    return toast.add({ title: 'Isi dulu keterangannya', color: 'error' })
  }
  sibuk.value = true
  const hrd = props.peran.hrd
  // One day's create (+ its approval, which needs the new id) stays in order;
  // the days run a few at a time and each reports for itself.
  const hasil = await petaParalel(antre, BATAS_TULIS_PARALEL, async (it) => {
    try {
      const r = await simpanAjuanDw({ dwId: props.p.id, tgl: tambahHari(props.senin, it.k), m: it.c.m, s: it.c.s, divisi: props.div, posisi: pos.value, catatan: cat.value.trim() })
      const idBaru = r.data?.row?.id ?? ''
      if (hrd && idBaru) {
        try {
          await putusAjuanDw(idBaru, 'DISETUJUI', '')
        }
        catch {
          // Stays MENUNGGU in the HRD's own queue.
        }
      }
      return 'ok' as const
    }
    catch (e) {
      if (bentrokDari(e)) return 'bentrok' as const
      return { galat: apiErrorMessage(e) }
    }
  })
  let ok = 0
  let gagal = 0
  for (const h of hasil) {
    const v = h.status === 'fulfilled' ? h.value : { galat: apiErrorMessage(h.reason) }
    if (v === 'ok') ok++
    else if (v === 'bentrok') gagal++
    else toast.add({ title: `Gagal menyimpan: ${v.galat}`, color: 'error' })
  }
  sibuk.value = false
  open.value = false
  toast.add({ title: `${ok} ${hrd ? 'hari terjadwal' : 'pengajuan terkirim'}${gagal ? `, ${gagal} bentrok dilewati` : ''}`, color: gagal ? 'warning' : 'success' })
  emit('sent')
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`Input mingguan — ${p.nama}`"
    :description="`${fTglP(senin)} – ${fTglP(tambahHari(senin, 6))} · ${namaDivisiJadwal(div)}`"
  >
    <div class="space-y-4">
      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="k in 7"
          :key="k"
          type="button"
          class="flex min-h-14 flex-col items-center justify-center rounded-field border px-0.5 py-1 text-center focus-visible:outline-2 focus-visible:outline-primary"
          :class="[
            i === k - 1 ? 'border-primary-400 ring-1 ring-primary-400' : 'border-default',
            isi[k - 1] ? 'bg-default' : 'bg-muted',
            isi[k - 1]?.lampau && 'opacity-60',
          ]"
          @click="i = k - 1"
        >
          <span class="text-[10px] font-semibold text-muted">{{ ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][k - 1] }}</span>
          <span class="text-xs font-bold text-highlighted num">{{ Number(hariTgl(k - 1).slice(8)) }}</span>
          <span
            v-if="isi[k - 1]?.ada"
            class="text-[10px] font-semibold"
            :class="isi[k - 1]!.status === 'MENUNGGU' ? 'text-warning' : 'text-success'"
          >
            {{ isi[k - 1]!.lampau ? 'lewat' : (isi[k - 1]!.status === 'MENUNGGU' ? 'menunggu' : 'terisi') }}
          </span>
          <span
            v-else-if="isi[k - 1]"
            class="text-[10px] font-semibold text-primary-700 num"
          >{{ isi[k - 1]!.m }}–{{ isi[k - 1]!.s }}</span>
        </button>
      </div>

      <div
        v-if="i >= 0"
        class="space-y-2"
      >
        <p class="text-sm font-semibold text-highlighted">
          {{ fTgl(hariTgl(i)) }}
          <span
            v-if="isi[i]?.ada"
            class="text-muted"
          >— sudah ada, tidak ikut dikirim</span>
        </p>
        <div
          v-if="!isi[i]?.ada"
          class="flex flex-wrap gap-2"
        >
          <button
            v-for="(j, n) in set.jam"
            :key="`${j.n}-${n}`"
            type="button"
            class="rounded-field border-2 px-3 py-1.5 text-sm font-bold"
            :class="isi[i]?.m === j.m && isi[i]?.s === j.s ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default bg-muted text-muted'"
            @click="pilihJam(n)"
          >
            {{ j.n }}
            <small class="ms-1 font-medium opacity-80">{{ j.m }}–{{ j.s }}</small>
          </button>
        </div>
        <div
          v-if="!isi[i]?.ada && isi[i]"
          class="grid grid-cols-2 gap-3"
        >
          <UFormField label="Jam mulai">
            <AppJam
              :model-value="isi[i]!.m"
              class="w-full"
              @update:model-value="(v: string) => ubahJam('m', v)"
            />
          </UFormField>
          <UFormField label="Jam selesai">
            <AppJam
              :model-value="isi[i]!.s"
              class="w-full"
              @update:model-value="(v: string) => ubahJam('s', v)"
            />
          </UFormField>
        </div>
        <UButton
          v-if="!isi[i]?.ada && isi[i]"
          label="Kosongkan hari ini"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="kosongkan"
        />
        <p
          v-if="isi[i] && !isi[i]!.ada"
          class="text-sm text-muted"
        >
          {{ durasiJamDw(isi[i]!.m, isi[i]!.s) }} jam
        </p>
      </div>

      <UFormField label="Posisi">
        <USelect
          v-model="pos"
          :items="opsiPosisi"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="`Catatan${catatanWajibDw(peran) ? ' *' : ''}`"
        :help="catatanWajibDw(peran) ? 'Wajib diisi — ini yang dibaca HRD sebelum memutuskan.' : 'Boleh dikosongkan.'"
      >
        <UTextarea
          v-model="cat"
          :rows="2"
          placeholder="Mis. menggantikan yang cuti minggu ini"
          class="w-full"
        />
      </UFormField>
      <p
        v-if="!catatanWajibDw(peran)"
        class="text-sm text-muted"
      >
        Sebagai HRD, yang Anda isi <b>langsung terjadwal</b> — tidak lewat Antrean.
      </p>
      <p
        v-else
        class="text-sm text-muted"
      >
        Yang Anda isi masuk sebagai <b>pengajuan</b>; HRD yang menyetujuinya.
      </p>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : 'Simpan seminggu'"
        :loading="sibuk"
        @click="simpan"
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
