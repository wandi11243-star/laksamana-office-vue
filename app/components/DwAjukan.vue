<!--
  Ajukan DW satu tanggal (deploy/dw/index.html ajukanTgl/gambarAjukanTgl
  :5471-5738). The quick door from Kalender Tamu and Rekap Pegawai: date and
  guest context follow the click, so the person does not lose the day they
  were just looking at. The sheet STAYS OPEN after sending — a busy night
  almost never needs just one person (:5560).

  Rules kept:
  - Keterangan is mandatory for everyone but HRD (F.22, catatanWajibDW :3205)
    and the other two doors use the same field through their own screens.
  - A past date cannot be submitted: the server closes it as KEDALUWARSA on
    read, so sending would wait for an approval that never comes (:5643).
  - An overlapping time asks first and, on yes, REPLACES the old shift
    (`timpa`); a second shift the same day with disjoint hours is legitimate
    (F.13). The quota guide asks once, never blocks (:5689).
-->
<script setup lang="ts">
import type { AjuanDw, PekerjaDw } from '~/utils/dw'
import { bentrokOrangJam, catatanWajibDw, cocokJamSiap, divPekerja, divUtama, durasiJamDw, jamTambah, konteksHariDw, KONTEKS_LBL, kuotaDivDw, opsiPosisiDw, posPekerja, posisiBawaanDivisiDw, posisiDivisiDw, posUtama, STATUS_AJU_DW, terpakaiDivDw, tglLampau } from '~/utils/dw'
import { DIVISI, namaDivisiJadwal } from '~/utils/jadwal'
import type { BentrokDw } from '~/composables/useDw'
import { bentrokDari, simpanAjuanDw, useDwDasar, useDwPax } from '~/composables/useDw'
import { fTgl, hariIni } from '~/utils/format'

const props = withDefaults(defineProps<{
  /** The day the sheet opens on. */
  tglAwal?: string
  /** Pre-selected worker (Rekap Pegawai knows its person, :5464). */
  dwId?: string
  /** Context division from the sheet that was clicked. */
  divAwal?: string
}>(), { tglAwal: '', dwId: '', divAwal: '' })

const emit = defineEmits<{ sent: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { set, ajuan, pekerja, peran } = useDwDasar()
const pax = useDwPax()

/** Reka UI forbids SelectItem value ''; "belum dipilih" is a sentinel. */
const KOSONG = '__kosong__'

const tgl = ref('')
const dw = ref(KOSONG)
const div = ref<string>(DIVISI[0]!.k)
const pos = ref('')
const m = ref('')
const s = ref('')
const cat = ref('')
const sibuk = ref(false)
const lanjutTimpa = ref(false)
const lanjutLebih = ref(false)

const aktif = computed<PekerjaDw[]>(() => pekerja.value.filter(p => p.status === 'AKTIF'))
const opsiDw = computed(() => [{ value: KOSONG, label: '— pilih daily worker —' }, ...aktif.value.map((p) => {
  const ada = ajuan.value.filter(a => a.dwId === p.id && a.tgl === tgl.value && (a.status === 'MENUNGGU' || a.status === 'DISETUJUI'))
  const divTe = divPekerja(p).map(namaDivisiJadwal).join('/') || '—'
  return { value: p.id, label: `${p.nama} · ${divTe}${ada.length ? ` — sudah ${ada.map(a => `${a.m}–${a.s}`).join(', ')}` : ''}` }
})])
const opsiDiv = DIVISI.map(d => ({ value: d.k as string, label: d.n }))
const opsiPosisi = computed(() => opsiPosisiDw(set.value, div.value, pos.value))
const pilihPekerja = computed<PekerjaDw | null>(() => aktif.value.find(p => p.id === dw.value) ?? null)

watch(open, (v) => {
  if (!v) return
  lanjutTimpa.value = false
  lanjutLebih.value = false
  const org = props.dwId ? aktif.value.find(p => p.id === props.dwId) : null
  const jam = set.value.jam[0] ?? { n: 'Event', m: '16:00', s: '23:00' }
  tgl.value = props.tglAwal || hariIni()
  dw.value = org?.id ?? KOSONG
  div.value = (org ? divUtama(org) : '') || props.divAwal || DIVISI[0]!.k
  pos.value = (org ? posPekerja(org).find(x => posisiDivisiDw(set.value, div.value).includes(x)) : '') || posisiBawaanDivisiDw(set.value, div.value)
  m.value = jam.m
  s.value = jam.s
  cat.value = ''
}, { immediate: true })

/** Choosing a name also chooses their division/position (:5510). */
watch(pilihPekerja, (p) => {
  if (!p) return
  const dv = divPekerja(p).includes(div.value) ? div.value : divUtama(p)
  if (dv) div.value = dv
  const px = posPekerja(p).find(x => posisiDivisiDw(set.value, dv).includes(x)) || posUtama(p)
  if (px) pos.value = px
})
watch(div, () => {
  const sah = posisiDivisiDw(set.value, div.value)
  if (!sah.includes(pos.value)) pos.value = sah[0] ?? ''
})
/** A start outside a preset fills the end with the base shift length (:3294). */
watch(m, (v, lama) => {
  if (v === lama) return
  if (!cocokJamSiap(set.value, v, s.value)) s.value = jamTambah(v, 60 * set.value.jamDasar)
})

const lampau = computed(() => tglLampau(tgl.value))
const durasi = computed(() => (m.value && s.value ? durasiJamDw(m.value, s.value) : 0))
const siapPakai = computed(() => cocokJamSiap(set.value, m.value, s.value))
const bayarPenuh = computed(() => peran.value.hrd)

const bentrok = computed<AjuanDw | null>(() =>
  dw.value !== KOSONG && tgl.value && m.value && s.value ? bentrokOrangJam(ajuan.value, dw.value, tgl.value, m.value, s.value) : null)

function setJam(i: number) {
  const j = set.value.jam[i]
  if (!j) return
  m.value = j.m
  s.value = j.s
}

const konfirm = ref<null | { jenis: 'bentrok', b: BentrokDw } | { jenis: 'kuota', teks: string }>(null)
const namaB = computed(() => {
  const b = konfirm.value?.jenis === 'bentrok' ? konfirm.value.b : null
  return b?.nama || b?.dwId || 'DW'
})

function cekKuota(): string | null {
  const l = kuotaDivDw(set.value, div.value, tgl.value, pax.value[tgl.value] ?? 0)
  if (!l) return null
  const kini = terpakaiDivDw(ajuan.value, tgl.value, div.value, ['DISETUJUI', 'MENUNGGU'], bentrok.value?.id)
  if (kini + 1 <= l) return null
  return `${KONTEKS_LBL[konteksHariDw(tgl.value, pax.value[tgl.value] ?? 0)]} ${fTgl(tgl.value)}: panduan ${namaDivisiJadwal(div.value)} ${l} orang, sudah ada ${kini} (termasuk yang menunggu). Dengan ini jadi ${kini + 1}.`
}

async function kirim() {
  if (sibuk.value) return
  if (dw.value === KOSONG) return toast.add({ title: 'Pilih daily worker dulu', color: 'error' })
  if (!tgl.value) return toast.add({ title: 'Tanggal kerja wajib diisi', color: 'error' })
  if (!m.value || !s.value) return toast.add({ title: 'Jam mulai dan jam selesai wajib diisi', color: 'error' })
  if (lampau.value) return toast.add({ title: 'Tanggal ini sudah lewat — tidak bisa diajukan lagi', color: 'error' })
  if (catatanWajibDw(peran.value) && !cat.value.trim()) {
    return toast.add({ title: 'Isi dulu keterangannya', color: 'error' })
  }
  if (bentrok.value && !lanjutTimpa.value) {
    konfirm.value = { jenis: 'bentrok', b: { ...bentrok.value } }
    return
  }
  const teksKuota = cekKuota()
  if (teksKuota && !lanjutLebih.value) {
    konfirm.value = { jenis: 'kuota', teks: teksKuota }
    return
  }
  sibuk.value = true
  try {
    await simpanAjuanDw({
      dwId: dw.value,
      tgl: tgl.value,
      m: m.value,
      s: s.value,
      divisi: div.value,
      posisi: pos.value,
      catatan: cat.value.trim(),
      timpa: lanjutTimpa.value || undefined,
    })
    lanjutTimpa.value = false
    lanjutLebih.value = false
    toast.add({ title: `${pilihPekerja.value?.nama ?? 'DW'} diajukan untuk ${fTgl(tgl.value)}`, color: 'success' })
    dw.value = KOSONG
    cat.value = ''
    emit('sent')
  }
  catch (e) {
    const b = bentrokDari(e)
    if (b) {
      konfirm.value = { jenis: 'bentrok', b }
      return
    }
    toast.add({ title: `Gagal mengirim: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function jawabBentrok() {
  konfirm.value = null
  lanjutTimpa.value = true
  lanjutLebih.value = false
  await kirim()
}
async function jawabKuota() {
  konfirm.value = null
  lanjutLebih.value = true
  await kirim()
}
function tutupKonfirm() {
  if (konfirm.value?.jenis === 'bentrok') lanjutTimpa.value = false
  else lanjutLebih.value = false
  konfirm.value = null
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`Ajukan DW — ${tgl ? fTgl(tgl) : ''}`"
    description="Masuk antrean HRD seperti biasa; modal tetap terbuka supaya bisa menambah orang berikutnya."
    lebar="sedang"
  >
    <div class="space-y-4">
      <p
        v-if="lampau"
        class="rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        Tanggal ini <b>sudah lewat</b>. Ajuannya tersimpan, tapi langsung ditutup sebagai <b>Lewat tanggal</b>
        dan tidak masuk Antrean HRD.
      </p>

      <UFormField label="Daily worker">
        <USelect
          v-model="dw"
          :items="opsiDw"
          class="w-full"
        />
      </UFormField>

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
        <template v-if="!siapPakai">
          — di luar shift siap pakai
        </template>
        <template v-if="durasi > set.jamDasar">
          — lebih panjang dari shift dasar ({{ set.jamDasar }} jam)<template v-if="bayarPenuh">
            , tarifnya naik <b>{{ rupiah(set.tambahanPanjang) }}</b> per orang
          </template>.
        </template>
      </p>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Divisi">
          <USelect
            v-model="div"
            :items="opsiDiv"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Posisi">
          <USelect
            v-model="pos"
            :items="opsiPosisi"
            class="w-full"
          />
        </UFormField>
      </div>

      <UFormField
        :label="`Catatan untuk HR${catatanWajibDw(peran) ? ' *' : ''}`"
        :help="catatanWajibDw(peran) ? 'Wajib diisi — HRD memutuskan dari keterangan ini.' : 'Boleh dikosongkan.'"
      >
        <UTextarea
          v-model="cat"
          :rows="3"
          placeholder="Mis. dipanggil karena acara 300 pax"
          class="w-full"
        />
      </UFormField>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Mengirim…' : 'Kirim ajuan'"
        :loading="sibuk"
        :disabled="lampau"
        @click="kirim"
      />
      <UButton
        label="Tutup"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>

  <ResponsiveSheet
    :open="konfirm?.jenis === 'bentrok'"
    :title="`Jamnya bertindih dengan shift ${namaB} yang sudah ada`"
    @update:open="(v: boolean) => { if (!v) tutupKonfirm() }"
  >
    <div
      v-if="konfirm?.jenis === 'bentrok'"
      class="space-y-2 text-sm"
    >
      <p>
        <b>{{ namaB }}</b> sudah punya shift
        <template v-if="konfirm.b.divisi">
          di <b>{{ namaDivisiJadwal(konfirm.b.divisi) }}</b>
        </template>
        <template v-if="konfirm.b.m && konfirm.b.s">
          <span class="num">{{ konfirm.b.m }}–{{ konfirm.b.s }}</span>
        </template>
        <template v-if="konfirm.b.status">
          ({{ STATUS_AJU_DW[konfirm.b.status] ?? konfirm.b.status }})
        </template>
        yang jamnya bertabrakan dengan <b class="num">{{ m }}–{{ s }}</b>. Satu orang tidak bisa berada di dua tempat sekaligus.
      </p>
      <p>
        Mengirim ini <b>mengganti</b> shift itu, bukan menambah shift kedua. Kalau maksudnya memang shift kedua,
        ubah jamnya supaya tidak bertindih — dua shift dalam sehari diperbolehkan.
      </p>
    </div>
    <template #footer>
      <UButton
        label="Ya, ganti ajuannya"
        color="error"
        loading-auto
        @click="jawabBentrok"
      />
      <UButton
        label="Kembali ke form"
        color="neutral"
        variant="ghost"
        @click="tutupKonfirm"
      />
    </template>
  </ResponsiveSheet>

  <ResponsiveSheet
    :open="konfirm?.jenis === 'kuota'"
    title="Lebih dari panduan?"
    @update:open="(v: boolean) => { if (!v) tutupKonfirm() }"
  >
    <p class="text-sm">
      {{ konfirm?.jenis === 'kuota' ? konfirm.teks : '' }}
    </p>
    <p class="mt-2 text-sm text-muted">
      Bukan larangan — lanjutkan saja kalau memang perlu. Angkanya diatur di Pengaturan → Panduan jumlah DW.
    </p>
    <template #footer>
      <UButton
        label="Ya, tetap ajukan"
        loading-auto
        @click="jawabKuota"
      />
      <UButton
        label="Kembali ke form"
        color="neutral"
        variant="ghost"
        @click="tutupKonfirm"
      />
    </template>
  </ResponsiveSheet>
</template>
