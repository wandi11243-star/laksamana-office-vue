<!--
  Minta Daily Worker (deploy/dw/index.html bukaMinta/kirimMinta :3256-3582).
  ONE form for both ways of asking, like the old one: "butuh berapa orang"
  and "saya sudah tahu orangnya" are two halves of the same request, and the
  second only ever produces USULAN — HRD still assigns (F.17).

  Rules kept:
  - Keterangan mandatory for everyone but HRD (F.22);
  - changing division drops the names (they cannot fill another division's
    request, :3300) and changing position drops names that no longer match,
    telling the head how many (:3308);
  - an overlapping shift (or another head's waiting suggestion) disables a
    candidate before sending — the server repeats the check (`bentrok_usulan`);
  - HRD's estimate includes the long-shift bonus, so the guess is not always
    low (:3534). The head sees no money at all (F.12).
-->
<script setup lang="ts">
import type { PekerjaDw, PermintaanDw } from '~/utils/dw'
import { bentrokOrangJam, biayaPermintaanDw, bolehLihatUangDw, catatanWajibDw, cocokJamSiap, divPekerja, durasiJamDw, jamTambah, kandidatDw, opsiPosisiDw, posPekerja, posisiBawaanDivisiDw, posisiDivisiDw } from '~/utils/dw'
import { DIVISI, namaDivisiJadwal } from '~/utils/jadwal'
import { simpanPermintaanDw, useDwDasar } from '~/composables/useDw'
import { hariIni } from '~/utils/format'

const props = withDefaults(defineProps<{
  /** Editing an existing request (Ubah), when set. */
  edit?: PermintaanDw | null
  /** Pre-filled person from Database DW ("Minta orang ini", :3161). */
  orang?: PekerjaDw | null
}>(), { edit: null, orang: null })

const emit = defineEmits<{ sent: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { set, ajuan, pekerja, permintaan, peran } = useDwDasar()

const tgl = ref('')
const div = ref<string>('')
const m = ref('')
const s = ref('')
const pos = ref('')
const jumlah = ref(1)
const catatan = ref('')
const pilihOrang = ref(false)
const usulan = ref<string[]>([])
const sibuk = ref(false)
const bentrokTerlepas = ref<{ nama?: string, dwId?: string, divisi?: string, status?: string, m?: string, s?: string, oleh?: string }[]>([])

const kuasa = computed<string[]>(() => (peran.value.hrd ? DIVISI.map(d => d.k) : DIVISI.map(d => d.k).filter(k => peran.value.divisi.includes(k))))
const opsiDiv = computed(() => kuasa.value.map(k => ({ value: k, label: namaDivisiJadwal(k) })))
const opsiPosisi = computed(() => opsiPosisiDw(set.value, div.value, pos.value))

watch(open, (v) => {
  if (!v) return
  bentrokTerlepas.value = []
  const jam = set.value.jam[0] ?? { n: 'Event', m: '16:00', s: '23:00' }
  const x = props.edit
  if (x) {
    tgl.value = x.tgl
    div.value = x.divisi
    m.value = x.m
    s.value = x.s
    pos.value = x.posisi
    jumlah.value = Math.max(1, x.jumlah || 1)
    catatan.value = x.catatan
    pilihOrang.value = !!x.usulan.length
    usulan.value = x.usulan.slice()
  }
  else if (props.orang) {
    // A known person: their division/position, their name as the suggestion.
    const o = props.orang
    const divBisa = divPekerja(o).filter(k => kuasa.value.includes(k))
    div.value = divBisa[0] ?? kuasa.value[0] ?? DIVISI[0]!.k
    tgl.value = hariIni()
    m.value = jam.m
    s.value = jam.s
    pos.value = posPekerja(o).find(x2 => posisiDivisiDw(set.value, div.value).includes(x2)) || posisiBawaanDivisiDw(set.value, div.value)
    jumlah.value = 1
    catatan.value = ''
    pilihOrang.value = true
    usulan.value = divBisa.length ? [o.id] : []
  }
  else {
    tgl.value = hariIni()
    div.value = kuasa.value[0] ?? DIVISI[0]!.k
    m.value = jam.m
    s.value = jam.s
    pos.value = posisiBawaanDivisiDw(set.value, div.value)
    jumlah.value = 1
    catatan.value = ''
    pilihOrang.value = false
    usulan.value = []
  }
}, { immediate: true })

watch(div, (v, lama) => {
  if (!v || v === lama) return
  const sah = posisiDivisiDw(set.value, v)
  if (!sah.includes(pos.value)) pos.value = sah[0] ?? ''
  usulan.value = []
})
watch(pos, (v, lama) => {
  if (!v || v === lama || !usulan.value.length) return
  const sah = new Set(kandidatDw(pekerja.value, div.value, v, 'sering').map(p => p.id))
  const sisa = usulan.value.filter(id => sah.has(id))
  const lepas = usulan.value.length - sisa.length
  usulan.value = sisa
  if (lepas) toast.add({ title: `${lepas} orang dilepas — posisinya bukan ${v}`, color: 'warning' })
})
watch(jumlah, (v) => {
  if (usulan.value.length > v) usulan.value = usulan.value.slice(0, v)
})
watch(m, (v, lama) => {
  if (v === lama) return
  if (!cocokJamSiap(set.value, v, s.value)) s.value = jamTambah(v, 60 * set.value.jamDasar)
})

const kandidat = computed(() => kandidatDw(pekerja.value, div.value, pos.value, 'sering'))
function bentrok(p: PekerjaDw) {
  return bentrokOrangJam(ajuan.value, p.id, tgl.value, m.value, s.value, props.edit?.id)
}
function dipesanOlehLain(p: PekerjaDw) {
  return permintaan.value.find(x => x.status === 'MENUNGGU' && x.tgl === tgl.value && x.divisi !== div.value && x.usulan.includes(p.id) && x.id !== props.edit?.id)
}
function toggle(p: PekerjaDw) {
  const i = usulan.value.indexOf(p.id)
  if (i > -1) usulan.value.splice(i, 1)
  else if (usulan.value.length >= jumlah.value) toast.add({ title: `Sudah ${jumlah.value} orang — naikkan dulu "Butuh berapa orang?"`, color: 'warning' })
  else usulan.value.push(p.id)
}

const durasi = computed(() => (m.value && s.value ? durasiJamDw(m.value, s.value) : 0))
const perkiraan = computed(() => biayaPermintaanDw(set.value, { posisi: pos.value, m: m.value, s: s.value, jumlah: Math.max(1, jumlah.value) }))
const tarifAda = computed(() => (peran.value.hrd ? (Number(set.value.tarif[pos.value]) || 0) > 0 : true))

async function kirim() {
  if (sibuk.value) return
  if (!tgl.value) return toast.add({ title: 'Tanggal belum diisi', color: 'error' })
  if (!m.value || !s.value) return toast.add({ title: 'Jam mulai dan selesai wajib diisi', color: 'error' })
  if (catatanWajibDw(peran.value) && !catatan.value.trim()) return toast.add({ title: 'Isi dulu keterangannya', color: 'error' })
  sibuk.value = true
  try {
    const r = await simpanPermintaanDw({
      id: props.edit?.id,
      tgl: tgl.value,
      divisi: div.value,
      m: m.value,
      s: s.value,
      posisi: pos.value,
      jumlah: jumlah.value,
      catatan: catatan.value.trim(),
      usulan: pilihOrang.value ? usulan.value : [],
    })
    const tolak = Array.isArray(r.data?.bentrok) ? r.data.bentrok as typeof bentrokTerlepas.value : []
    open.value = false
    toast.add({ title: props.edit ? 'Perubahan permintaan terkirim' : (usulan.value.length && pilihOrang.value ? `Permintaan terkirim dengan ${usulan.value.length} nama — HRD tinggal menyetujui` : 'Permintaan terkirim — menunggu HRD'), color: 'success' })
    if (tolak.length) bentrokTerlepas.value = tolak
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
    :title="edit ? 'Ubah permintaan' : 'Minta Daily Worker'"
  >
    <div class="space-y-4">
      <p
        v-if="edit && edit.dibuatOleh && edit.dibuatOleh !== peran.nama"
        class="rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        Permintaan ini diminta <b>{{ edit.dibuatOleh }}</b>. Perubahan Anda tercatat terpisah — namanya tetap
        tertulis sebagai peminta, dan statusnya kembali <b>menunggu keputusan</b>.
      </p>

      <UFormField label="Tanggal">
        <AppTanggal
          v-model="tgl"
          class="w-full"
        />
      </UFormField>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Divisi">
          <USelect
            v-model="div"
            :items="opsiDiv"
            :disabled="kuasa.length < 2"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Butuh berapa orang?"
          help="HRD yang menunjuk siapa orangnya."
        >
          <UInput
            v-model.number="jumlah"
            type="number"
            min="1"
            max="30"
            class="w-full"
          />
        </UFormField>
      </div>

      <UFormField label="Jam siap pakai">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(j, i) in set.jam"
            :key="`${j.n}-${i}`"
            type="button"
            class="rounded-field border-2 px-3 py-1.5 text-sm font-bold"
            :class="m === j.m && s === j.s ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default bg-muted text-muted'"
            @click="m = j.m; s = j.s"
          >
            {{ j.n }}
            <small class="ms-1 font-medium opacity-80">{{ j.m }}–{{ j.s }}</small>
          </button>
        </div>
      </UFormField>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Jam mulai">
          <AppJam
            v-model="m"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jam selesai">
          <AppJam
            v-model="s"
            class="w-full"
          />
        </UFormField>
      </div>

      <p
        class="rounded-field px-3 py-2 text-sm"
        :class="durasi > set.jamDasar ? 'bg-warning/12' : 'bg-info/10'"
      >
        <b>{{ durasi }} jam</b>
        <template v-if="durasi > set.jamDasar">
          — lebih panjang dari shift dasar ({{ set.jamDasar }} jam)<template v-if="bolehLihatUangDw(peran)">
            , tarifnya naik <b>{{ rupiah(set.tambahanPanjang) }}</b> per orang
          </template>.
        </template>
      </p>

      <UFormField label="Posisi">
        <USelect
          v-model="pos"
          :items="opsiPosisi"
          class="w-full"
        />
        <template #help>
          Pilihannya mengikuti divisi {{ namaDivisiJadwal(div) }}.
        </template>
      </UFormField>

      <label class="flex cursor-pointer items-start gap-2 rounded-field border border-default px-3 py-2">
        <input
          v-model="pilihOrang"
          type="checkbox"
          class="mt-1"
          @change="!pilihOrang && (usulan = [])"
        >
        <span class="text-sm">
          <b class="text-highlighted">Pilih Daily Worker langsung</b> — tunjuk sendiri orangnya, HRD tinggal menyetujui.
        </span>
      </label>

      <div
        v-if="pilihOrang"
        class="space-y-2"
      >
        <p class="text-sm text-muted">
          Tercentang <b>{{ usulan.length }}</b> dari {{ jumlah }} — <b>yang paling sering dipakai ada di atas</b>.
          Sisanya (kalau ada) tetap ditunjuk HRD.
        </p>
        <div class="max-h-72 space-y-1.5 overflow-y-auto pe-1">
          <label
            v-for="p in kandidat"
            :key="p.id"
            class="flex items-start gap-2 rounded-field border px-3 py-2"
            :class="[
              usulan.includes(p.id) ? 'border-primary-400 bg-primary-100/60' : 'border-default',
              (bentrok(p) || dipesanOlehLain(p)) && !usulan.includes(p.id) ? 'opacity-60' : 'cursor-pointer',
            ]"
          >
            <input
              type="checkbox"
              class="mt-1"
              :checked="usulan.includes(p.id)"
              :disabled="(!!bentrok(p) || !!dipesanOlehLain(p)) && !usulan.includes(p.id)"
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
                v-else-if="dipesanOlehLain(p)"
                class="block text-warning"
              >diusulkan {{ namaDivisiJadwal(dipesanOlehLain(p)!.divisi) }}<template v-if="dipesanOlehLain(p)!.dibuatOleh"> oleh {{ dipesanOlehLain(p)!.dibuatOleh }}</template></span>
            </span>
          </label>
          <p
            v-if="!kandidat.length"
            class="rounded-field bg-muted px-3 py-2 text-sm text-muted"
          >
            Tidak ada DW aktif di divisi ini yang posisinya cocok. Sengaja tidak diganti dengan divisi lain —
            yang tercentang harus benar-benar bisa mengerjakannya.
          </p>
        </div>
      </div>

      <UFormField
        :label="`Catatan untuk HRD${catatanWajibDw(peran) ? ' *' : ''}`"
        :help="catatanWajibDw(peran) ? 'Wajib diisi — HRD memutuskan dari keterangan ini.' : 'Boleh dikosongkan.'"
      >
        <UTextarea
          v-model="catatan"
          :rows="3"
          placeholder="Mis. ada acara 300 pax, butuh yang sudah pernah handle banquet"
          class="w-full"
        />
      </UFormField>

      <p
        v-if="bolehLihatUangDw(peran)"
        class="rounded-field bg-info/10 px-3 py-2 text-sm"
      >
        <template v-if="!tarifAda">
          Tarif untuk posisi <b>{{ pos || '—' }}</b> belum disetel, jadi perkiraan biayanya belum bisa dihitung. Atur di <b>Pengaturan → Posisi per Divisi</b>.
        </template>
        <template v-else>
          Perkiraan biaya: <b>{{ rupiah(perkiraan) }}</b>
          <span class="text-muted">({{ Math.max(1, jumlah) }} × {{ rupiah(biayaPermintaanDw(set, { posisi: pos, m, s, jumlah: 1 })) }})</span>
        </template>
      </p>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Mengirim…' : (edit ? 'Simpan perubahan' : 'Kirim permintaan')"
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

  <ResponsiveSheet
    :open="bentrokTerlepas.length > 0"
    title="Ada yang sudah terpakai di jam itu"
    @update:open="(v: boolean) => { if (!v) bentrokTerlepas = [] }"
  >
    <p class="text-sm">
      Permintaan Anda <b>tetap terkirim</b>, tapi {{ bentrokTerlepas.length }} nama dilepas karena jadwalnya bentrok.
      Tunjuk penggantinya lewat <b>Ubah</b>, atau biarkan HRD yang memilihkan.
    </p>
    <div class="mt-3 space-y-2">
      <p
        v-for="(b, i) in bentrokTerlepas"
        :key="i"
        class="rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        <b>{{ b.nama || b.dwId }}</b> — sudah dijadwalkan {{ namaDivisiJadwal(b.divisi ?? '') }}
        <span class="num">{{ b.m }}–{{ b.s }}</span>.
      </p>
    </div>
    <template #footer>
      <UButton
        label="Mengerti"
        @click="bentrokTerlepas = []"
      />
    </template>
  </ResponsiveSheet>
</template>
