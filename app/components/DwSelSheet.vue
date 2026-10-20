<!--
  Kalender DW — isi satu sel (deploy/dw/index.html isiSelDW/simpanSelDW
  :4990-5185).

  One modal for both roles, with different outcomes, and the sheet says which:
    HRD   → the picked people are scheduled at once (not through Antrian)
    head  → they are sent as pengajuan; HRD decides
  The old client always wrote MENUNGGU (the server refuses anything else) and
  then called the decision endpoint for HRD — a failure there only leaves a
  waiting row in the HRD's own queue, never a ghost shift (:4973).

  A past date cannot be filled at all: the server closes it as KEDALUWARSA on
  read (:4981). Candidates whose HOURS overlap are disabled before saving
  (F.13); two shifts with disjoint hours are fine and are only labelled.
  Keterangan is mandatory for everyone but HRD (F.22).
-->
<script setup lang="ts">
import type { AjuanDw, PekerjaDw, PeranDw, PermintaanDw, SettingDw } from '~/utils/dw'
import { ajuanOrangTgl, bentrokOrangJam, biayaPermintaanDw, catatanWajibDw, durasiJamDw, jamTambah, kandidatDw, opsiPosisiDw, posPekerja, posisiDivisiDw, punyaDiv, tglLampau, usulanOrangTgl } from '~/utils/dw'
import { namaDivisiJadwal } from '~/utils/jadwal'
import { bentrokDari, putusAjuanDw, simpanAjuanDw } from '~/composables/useDw'
import { BATAS_TULIS_PARALEL, petaParalel } from '~/utils/paralel'
import { fTgl } from '~/utils/format'

const props = defineProps<{
  set: SettingDw
  pekerja: PekerjaDw[]
  ajuan: AjuanDw[]
  permintaan: PermintaanDw[]
  peran: PeranDw
  tgl: string
  div: string
}>()
const emit = defineEmits<{ sent: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const sibuk = ref(false)
const m = ref('')
const s = ref('')
const pos = ref('')
const cat = ref('')
const cari = ref('')
const pilih = ref<string[]>([])

const aktif = computed(() => props.pekerja.filter(p => p.status === 'AKTIF'))
const opsiPosisi = computed(() => opsiPosisiDw(props.set, props.div, pos.value))
const hrd = computed(() => props.peran.hrd)

watch(open, (v) => {
  if (!v) return
  const jam = props.set.jam[0] ?? { n: 'Event', m: '16:00', s: '23:00' }
  m.value = jam.m
  s.value = jam.s
  const sah = posisiDivisiDw(props.set, props.div)
  pos.value = sah[0] ?? ''
  cat.value = ''
  cari.value = ''
  pilih.value = []
})

/** Candidates for THIS division and position; no relaxing when empty (`kandidatDW`, :3125). */
const kandidat = computed(() => kandidatDw(props.pekerja, props.div, pos.value, hrd.value ? 'lama' : 'sering'))
const tersaring = computed(() => {
  const q = cari.value.trim().toLowerCase()
  if (!q) return kandidat.value
  return kandidat.value.filter(p => String(p.nama).toLowerCase().includes(q) || String(p.posisi).toLowerCase().includes(q))
})
const adaDiDiv = computed(() => aktif.value.some(p => punyaDiv(p, props.div)))

function bentrok(p: PekerjaDw) {
  return bentrokOrangJam(props.ajuan, p.id, props.tgl, m.value, s.value)
}
function lainHariItu(p: PekerjaDw) {
  const b = bentrok(p)
  return ajuanOrangTgl(props.ajuan, p.id, props.tgl).filter(a => !b || a.id !== b.id)
}
function dipesan(p: PekerjaDw) {
  if (bentrok(p) || pilih.value.includes(p.id)) return null
  return usulanOrangTgl(props.permintaan, p.id, props.tgl, props.div, '', m.value, s.value)
}
function bolehPilih(p: PekerjaDw): boolean {
  if (bentrok(p)) return false
  const d = dipesan(p)
  if (d && !hrd.value) return false
  return true
}
function toggle(p: PekerjaDw) {
  if (!bolehPilih(p)) return
  const i = pilih.value.indexOf(p.id)
  if (i > -1) pilih.value.splice(i, 1)
  else pilih.value.push(p.id)
}
function setJam(i: number) {
  const j = props.set.jam[i]
  if (!j) return
  m.value = j.m
  s.value = j.s
}
watch(m, (v, lama) => {
  if (v === lama) return
  if (!props.set.jam.some(j => j.m === v && j.s === s.value)) s.value = jamTambah(v, 60 * props.set.jamDasar)
})
watch(() => props.div, () => {
  const sah = posisiDivisiDw(props.set, props.div)
  if (!sah.includes(pos.value)) pos.value = sah[0] ?? ''
})
watch(pos, () => {
  // Drop picks that no longer fit the position (mirrors serapMinta, :3308).
  const sah = new Set(kandidat.value.map(p => p.id))
  const lepas = pilih.value.filter(id => !sah.has(id))
  if (lepas.length) {
    pilih.value = pilih.value.filter(id => sah.has(id))
    toast.add({ title: `${lepas.length} orang dilepas — posisinya bukan ${pos.value}`, color: 'warning' })
  }
})

const durasi = computed(() => (m.value && s.value ? durasiJamDw(m.value, s.value) : 0))
const perkiraan = computed(() => (hrd.value ? biayaPermintaanDw(props.set, { posisi: pos.value, m: m.value, s: s.value, jumlah: Math.max(1, pilih.value.length) }) : 0))

async function simpan() {
  if (sibuk.value) return
  if (!pilih.value.length) return toast.add({ title: 'Pilih dulu siapa orangnya', color: 'error' })
  if (tglLampau(props.tgl)) {
    open.value = false
    return toast.add({ title: 'Tanggal ini sudah lewat — tidak bisa diajukan lagi', color: 'error' })
  }
  if (catatanWajibDw(props.peran) && !cat.value.trim()) {
    return toast.add({ title: 'Isi dulu keterangannya', color: 'error' })
  }
  sibuk.value = true
  const ids = pilih.value.slice()
  // One person's create (+ its approval, which needs the new id) stays in
  // order; the people run a few at a time and each reports for itself.
  const hasil = await petaParalel(ids, BATAS_TULIS_PARALEL, async (id) => {
    try {
      const r = await simpanAjuanDw({ dwId: id, tgl: props.tgl, m: m.value, s: s.value, divisi: props.div, posisi: pos.value, catatan: cat.value.trim() })
      const row = r.data?.row
      const idBaru = row?.id ?? ''
      if (hrd.value && idBaru) {
        try {
          await putusAjuanDw(idBaru, 'DISETUJUI', '')
        }
        catch {
          // The row stays MENUNGGU in the HRD's own queue — safe, not a ghost shift.
        }
      }
      return { jenis: 'ok' } as const
    }
    catch (e) {
      const b = bentrokDari(e)
      if (b) {
        const p = props.pekerja.find(x => x.id === (b.dwId || id))
        return { jenis: 'bentrok', nama: p?.nama ?? b.nama ?? id } as const
      }
      return { jenis: 'galat', pesan: apiErrorMessage(e) } as const
    }
  })
  const gagalBentrok: string[] = []
  let masuk = 0
  for (const h of hasil) {
    const v = h.status === 'fulfilled' ? h.value : { jenis: 'galat', pesan: apiErrorMessage(h.reason) } as const
    if (v.jenis === 'ok') masuk++
    else if (v.jenis === 'bentrok') gagalBentrok.push(v.nama)
    else toast.add({ title: `Gagal menyimpan: ${v.pesan}`, color: 'error' })
  }
  sibuk.value = false
  if (!masuk) return
  if (gagalBentrok.length) {
    toast.add({ title: `${masuk} ${hrd.value ? 'terjadwal' : 'diajukan'}, ${gagalBentrok.length} dilewati karena jamnya bertindih`, color: 'warning' })
  }
  else {
    toast.add({ title: `${masuk} DW ${hrd.value ? 'terjadwal' : 'diajukan'} untuk ${fTgl(props.tgl)}`, color: 'success' })
  }
  open.value = false
  emit('sent')
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="hrd ? 'Assign daily worker' : 'Ajukan daily worker'"
    :description="`${fTgl(tgl)} · ${namaDivisiJadwal(div)}`"
  >
    <div class="space-y-4">
      <p class="rounded-field bg-info/10 px-3 py-2 text-sm">
        <template v-if="hrd">
          Yang Anda pilih <b>langsung terjadwal</b> — tidak lewat Antrean Pengajuan.
        </template>
        <template v-else>
          Yang Anda pilih dikirim sebagai <b>pengajuan</b>; HRD yang menyetujuinya.
        </template>
      </p>

      <UFormField label="Jam siap pakai">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(j, i) in set.jam"
            :key="`${j.n}-${i}`"
            type="button"
            class="rounded-field border-2 px-3 py-1.5 text-sm font-bold"
            :class="m === j.m && s === j.s ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default bg-muted text-muted'"
            @click="setJam(i)"
          >
            {{ j.n }}
            <small class="ms-1 font-medium opacity-80">{{ j.m }}–{{ j.s }}</small>
          </button>
        </div>
      </UFormField>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Jam mulai">
          <UInput
            v-model="m"
            type="time"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jam selesai">
          <UInput
            v-model="s"
            type="time"
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="text-sm text-muted">
        <b>{{ durasi }} jam</b>
        <template v-if="durasi > set.jamDasar">
          — lebih panjang dari shift dasar ({{ set.jamDasar }} jam), tarifnya naik.
        </template>
      </p>

      <UFormField label="Posisi">
        <USelect
          v-model="pos"
          :items="opsiPosisi"
          class="w-full"
        />
      </UFormField>

      <UFormField :label="`${hrd ? 'Siapa yang dipakai' : 'Siapa yang diajukan'} (${pilih.length} dipilih)`">
        <div class="space-y-2">
          <UInput
            v-if="kandidat.length >= 8"
            v-model="cari"
            icon="i-lucide-search"
            placeholder="Cari nama atau posisi…"
            class="w-full"
          />
          <div
            v-if="tersaring.length"
            class="max-h-72 space-y-1.5 overflow-y-auto pe-1"
          >
            <label
              v-for="p in tersaring"
              :key="p.id"
              class="flex items-start gap-2 rounded-field border px-3 py-2"
              :class="[
                pilih.includes(p.id) ? 'border-primary-400 bg-primary-100/60' : 'border-default',
                bolehPilih(p) ? 'cursor-pointer' : 'opacity-60',
              ]"
            >
              <input
                type="checkbox"
                class="mt-1"
                :checked="pilih.includes(p.id)"
                :disabled="!bolehPilih(p)"
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
                <template v-else>
                  <span
                    v-if="dipesan(p)"
                    class="block text-warning"
                  >diusulkan {{ namaDivisiJadwal(dipesan(p)!.divisi) }}<template v-if="dipesan(p)!.dibuatOleh"> oleh {{ dipesan(p)!.dibuatOleh }}</template></span>
                  <span
                    v-if="lainHariItu(p).length"
                    class="block text-muted"
                  >sudah {{ lainHariItu(p).map(a => `${namaDivisiJadwal(a.divisi)} ${a.m}–${a.s}`).join(', ') }} hari itu</span>
                </template>
              </span>
            </label>
          </div>
          <p
            v-else
            class="rounded-field bg-muted px-3 py-2 text-sm text-muted"
          >
            <template v-if="!adaDiDiv">
              Belum ada daily worker aktif di divisi <b>{{ namaDivisiJadwal(div) }}</b>. Daftarkan dulu di Database DW.
            </template>
            <template v-else-if="cari">
              Tidak ada yang cocok dengan "{{ cari }}".
            </template>
            <template v-else>
              Tidak ada DW {{ namaDivisiJadwal(div) }} yang posisinya <b>{{ pos || '—' }}</b>. Ganti posisi, atau setel posisi orangnya di Database DW. Sengaja tidak diganti dengan divisi lain — yang dipilih harus benar-benar bisa mengerjakannya.
            </template>
          </p>
        </div>
      </UFormField>

      <UFormField
        :label="`Catatan${hrd ? '' : ' untuk HRD'}${catatanWajibDw(peran) ? ' *' : ''}`"
        :help="catatanWajibDw(peran) ? 'Wajib diisi — HRD memutuskan dari keterangan ini.' : 'Boleh dikosongkan.'"
      >
        <UTextarea
          v-model="cat"
          :rows="3"
          placeholder="Mis. ada acara 300 pax, minta yang sudah pernah handle banquet"
          class="w-full"
        />
      </UFormField>

      <p
        v-if="hrd && pilih.length"
        class="rounded-field bg-info/10 px-3 py-2 text-sm"
      >
        Perkiraan biaya: <b>{{ rupiah(perkiraan) }}</b>
        <span class="text-muted">({{ pilih.length }} × {{ rupiah(biayaPermintaanDw(set, { posisi: pos, m, s, jumlah: 1 })) }})</span>
      </p>
    </div>

    <template #footer>
      <UButton
        :label="`${hrd ? 'Assign' : 'Kirim pengajuan'} ${pilih.length || ''}`"
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
