<!--
  Jadwal Shift › Jadwal Bulanan — the board sheet: one row per person, the
  whole month across (deploy/jadwal/index.html viewBulanan :2773-2980).

  The monthly sheet is open to EVERY crew member, whatever their Divisi; what
  is guarded is who may CHANGE a cell (`bolehUbah`), not who may look (:1340).
  "Semua" draws every Divisi in one sheet; a head still edits only their own
  rows there. The name search appears from 8 crew and FILTERS rows rather than
  highlighting one (:2760).

  Sheet tools: Salin bulan lalu and Impor only for one Divisi this person may
  write; Excel (CSV, K-05) for the whole sheet; Teks WA per Divisi. PNG is not
  built (it needs a drawing library).
-->
<script setup lang="ts">
import type { GrupLembar } from '~/components/JadwalLembar.vue'
import type { SelJadwal } from '~/utils/jadwal'
import { kunciSel, labelBulanJadwal, sumberBulanLalu, teksWA,
  DIVISI, adaHead, akhirBulan, awalBulan, bebanKru, bolehUbah, bulanDari, daftarShift, geserBulan,
  hariSebulan, kruDivisi, namaDivisiJadwal, petaSel, rekapBulan, shiftDef } from '~/utils/jadwal'
import { useJadwalCells, useJadwalDasar, useJadwalDw, useJadwalMassal, useJadwalRequests } from '~/composables/useJadwal'
import { BULAN, hariIni } from '~/utils/format'

definePageMeta({ access: ['jadwal'] })

const { set, kru, peran, kruById, pending, error, refresh: refreshDasar } = useJadwalDasar()

const mk = useState('jadwal-bulan', () => bulanDari(hariIni()))
const div = useState<string>('jadwal-bulan-div', () => 'ALL')
const cari = ref('')

const dari = computed(() => awalBulan(mk.value))
const sampai = computed(() => akhirBulan(mk.value))
const { data: cells, status: statusSel, refresh: refreshSel } = useJadwalCells('jadwal-cells-bulan', dari, sampai)
const { data: dwRows, error: dwError } = useJadwalDw('jadwal-dw-bulan', dari, sampai)

const peta = computed(() => petaSel(cells.value ?? []))
const hari = computed(() => hariSebulan(mk.value))
const labelBulan = computed(() => {
  const [y, m] = mk.value.split('-')
  return `${BULAN[Number(m) - 1]} ${y}`
})

const modeAll = computed(() => div.value === 'ALL')
const divList = computed(() => (modeAll.value ? DIVISI.map(d => d.k) : [div.value]))
const q = computed(() => cari.value.trim().toLowerCase())

const semuaKru = computed(() => divList.value.flatMap(dv => kruDivisi(peran.value, kru.value, dv)))
const grup = computed<GrupLembar[]>(() => divList.value.map(dv => ({
  div: dv,
  kru: kruDivisi(peran.value, kru.value, dv).filter(u => !q.value || String(u.name).toLowerCase().includes(q.value)),
  bisa: bolehUbah(peran.value, dv),
  heads: set.value.heads[dv] ?? [],
})))
const emps = computed(() => grup.value.flatMap(g => g.kru))
const adaDw = computed(() => (dwRows.value ?? []).some(x => divList.value.includes(x.divisi)))
const r = computed(() => rekapBulan(set.value, peta.value, emps.value.map(u => u.id), mk.value))
const bisa = computed(() => !modeAll.value && bolehUbah(peran.value, div.value))
const judulLembar = computed(() => (modeAll.value ? 'Semua divisi' : namaDivisiJadwal(div.value)))

// Skeleton only for the first load: the month picker refetches cells in place, so later loads keep the old cards.
const statMemuat = computed(() => !kru.value.length && !(cells.value ?? []).length
  && (pending.value || statusSel.value === 'pending' || statusSel.value === 'idle'))

const legenda = computed(() => daftarShift(set.value).map(k => ({ k, def: shiftDef(set.value, k) })))
// segDivisi (:2385): each tab counts the crew its sheet will draw.
const nDiv = (k: string) => kruDivisi(peran.value, kru.value, k).length
const opsiDiv = computed(() => [
  { value: 'ALL', label: 'Semua divisi', icon: 'i-lucide-layers', title: 'Susun seluruh divisi yang Anda pegang dalam satu layar', jumlah: DIVISI.reduce((a, d) => a + nDiv(d.k), 0) },
  ...DIVISI.map(d => ({ value: d.k as string, label: d.n, icon: d.icon, jumlah: nDiv(d.k) })),
])

const beban = (uid: string) => bebanKru(set.value, peta.value, uid, mk.value)
const ketJabatan = (uid: string, dv: string) => {
  const j = set.value.jabatan[uid] || ''
  return j && j.toLowerCase() !== namaDivisiJadwal(dv).toLowerCase() ? j : ''
}

// Cell editor
const editor = ref(false)
const target = ref<{ uid: string, nama: string, tgl: string, sel: SelJadwal | null } | null>(null)
function buka(u: { id: string, name: string }, tgl: string) {
  target.value = { uid: u.id, nama: u.name, tgl, sel: peta.value.get(`${u.id}|${tgl}`) ?? null }
  editor.value = true
}
const muatUlang = () => Promise.all([refreshDasar(), refreshSel()])
const cetak = () => window.print()

// ---- sheet tools (one Divisi; deploy/jadwal/index.html :2905-2935)
const toast = useToast()
const { data: aju } = useJadwalRequests()
const kruDiv = computed(() => (modeAll.value ? [] : kruDivisi(peran.value, kru.value, div.value)))
// "Salin bulan lalu" reads the previous month too (35 days back at most).
const dariLalu = computed(() => awalBulan(geserBulan(mk.value, -1)))
const { data: cellsLalu } = useJadwalCells('jadwal-cells-bulan-lalu', dariLalu, sampai)
const petaLalu = computed(() => petaSel(cellsLalu.value ?? []))
const massal = useJadwalMassal({ peta, nama: uid => kruById(uid)?.name ?? '—', aju: computed(() => aju.value ?? []), sesudah: muatUlang })

const salinOpen = ref(false)
function salinBulan(mode: 'hari' | 'tanggal') {
  salinOpen.value = false
  const rows: SelJadwal[] = []
  for (const u of kruDiv.value) {
    for (const d of hari.value) {
      const src = sumberBulanLalu(d, mk.value, mode)
      const c = src ? petaLalu.value.get(kunciSel(u.id, src)) : null
      if (c) rows.push({ ...c, d })
    }
  }
  if (!rows.length) {
    toast.add({ title: `Bulan sebelumnya masih kosong untuk divisi ${namaDivisiJadwal(div.value)}`, color: 'warning' })
    return
  }
  massal.minta({
    rows,
    judul: 'Salin bulan lalu?',
    judulBentrok: n => `Salin bulan lalu — ${n} sel akan tertimpa`,
    pesan: `${rows.length} sel akan diisi di ${labelBulanJadwal(mk.value)}.`,
    ya: 'Ya, salin',
    yaBentrok: n => `Ya, timpa ${n} sel`,
    bolehLewati: true,
    selaluTanya: true,
    selesai: 'Sel disalin dari bulan sebelumnya',
  })
}
const imporOpen = ref(false)
function sesudahImpor(rows: SelJadwal[]) {
  massal.minta({
    rows,
    judul: '',
    judulBentrok: n => `Timpa ${n} sel yang sudah terisi?`,
    pesan: `${rows.length} sel dari berkas akan ditulis.`,
    ya: '',
    yaBentrok: n => `Ya, timpa ${n} sel`,
    selesai: `${rows.length} sel diimpor dari Excel`,
  })
}
const eksporOpen = ref(false)
const waOpen = ref(false)
const waTeks = computed(() => teksWA(set.value, peta.value, kruDiv.value, div.value, hari.value, labelBulanJadwal(mk.value), false, dwRows.value ?? []))
</script>

<template>
  <AppPage
    title="Jadwal bulanan"
    description="Lembar sebulan penuh per divisi."
  >
    <template #actions>
      <template v-if="bisa">
        <UButton
          label="Salin bulan lalu"
          icon="i-lucide-copy"
          color="neutral"
          variant="outline"
          size="sm"
          @click="salinOpen = true"
        />
        <UButton
          label="Impor dari Excel"
          icon="i-lucide-file-up"
          color="neutral"
          variant="outline"
          size="sm"
          @click="imporOpen = true"
        />
      </template>
      <UButton
        label="Excel sebulan"
        icon="i-lucide-file-spreadsheet"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="!emps.length"
        @click="eksporOpen = true"
      />
      <UButton
        v-if="!modeAll"
        label="Teks WA"
        icon="i-lucide-message-circle"
        color="neutral"
        variant="outline"
        size="sm"
        @click="waOpen = true"
      />
      <UButton
        label="Print / PDF"
        icon="i-lucide-printer"
        color="neutral"
        variant="outline"
        size="sm"
        @click="cetak"
      />
    </template>

    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel flush>
      <template #head>
        <AppSeg
          v-model="div"
          :options="opsiDiv"
          size="sm"
        />
        <div class="flex items-center gap-1.5">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Bulan sebelumnya"
            @click="mk = geserBulan(mk, -1)"
          />
          <b class="min-w-36 text-center text-highlighted">{{ labelBulan }}</b>
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Bulan berikutnya"
            @click="mk = geserBulan(mk, 1)"
          />
          <UButton
            v-if="mk !== bulanDari(hariIni())"
            label="Bulan ini"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="mk = bulanDari(hariIni())"
          />
        </div>
      </template>

      <div class="space-y-3 p-4 lg:p-5">
        <p
          v-if="dwError"
          class="rounded-field bg-warning/12 px-3 py-2 text-sm text-warning"
        >
          Daftar daily worker belum bisa diambil ({{ apiErrorMessage(dwError) }}). Lembar kru di bawah tetap benar.
        </p>

        <div
          v-if="semuaKru.length >= 8"
          class="flex flex-wrap items-center gap-2"
        >
          <UInput
            v-model="cari"
            icon="i-lucide-search"
            placeholder="Cari nama kru…"
            class="w-full max-w-64"
          />
          <template v-if="q">
            <AppStatus size="sm">
              {{ emps.length }} dari {{ semuaKru.length }} kru
            </AppStatus>
            <UButton
              label="Tampilkan semua"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="cari = ''"
            />
          </template>
        </div>
        <p
          v-if="q && !emps.length"
          class="rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          Tidak ada kru {{ judulLembar }} bernama "<b>{{ cari }}</b>".
          <template v-if="!modeAll">
            Mungkin ia ada di divisi lain — pilih <b>Semua</b> di atas.
          </template>
        </p>

        <p
          v-if="!adaHead(peran)"
          class="rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          <b>Belum ada head divisi yang ditunjuk.</b> Selama daftarnya kosong, semua pemegang akses modul ini bisa
          menyusun jadwal divisi mana pun — sama seperti aturan di server. Tunjuk head-nya di
          <b>Pengaturan → Head Divisi</b>, lalu tekan <b>Simpan</b>.
        </p>

        <div class="flex flex-wrap gap-1.5">
          <JadwalShiftPil
            v-for="l in legenda"
            :key="l.k"
            :def="l.def"
            size="sm"
          />
        </div>

        <AppStatGrid
          :loading="statMemuat"
          :count="4"
        >
          <AppStat
            label="Kru"
            icon="i-lucide-users"
            :value="emps.length"
          />
          <AppStat
            label="Hari masuk"
            icon="i-lucide-user-check"
            :value="r.masuk"
            tone="success"
          />
          <AppStat
            label="Off / cuti"
            icon="i-lucide-palmtree"
            :value="r.libur"
            tone="info"
          />
          <AppStat
            label="Sel kosong"
            icon="i-lucide-circle-help"
            :value="r.kosong"
            :tone="r.kosong ? 'warning' : 'gold'"
          />
        </AppStatGrid>
      </div>

      <div
        v-if="!emps.length && !adaDw"
        class="px-4 py-10 text-center text-muted"
      >
        Belum ada kru di {{ judulLembar }}.
        <p class="mt-1 text-sm">
          Kru muncul otomatis begitu kolom <b>Tim</b>-nya diisi di Laksamana Office<template v-if="peran.admin">
            , atau tempatkan manual lewat Pengaturan
          </template>.
        </p>
      </div>
      <JadwalLembar
        v-else
        :set="set"
        :peta="peta"
        :hari="hari"
        :grup="grup"
        :judul-divisi="modeAll"
        :dw="dwRows ?? []"
        info-label="Beban"
        info-sub="Bulan ini"
        @pilih="buka"
      >
        <template #info="{ u, div: dv }">
          <span class="whitespace-nowrap"><b class="text-highlighted num">{{ beban(u.id).masuk }}</b> masuk</span>
          <i class="block whitespace-nowrap text-[11px] text-muted">
            {{ beban(u.id).libur }} off<template v-if="beban(u.id).jam"> · {{ beban(u.id).jam }} jam</template><template v-if="ketJabatan(u.id, dv)"> · {{ ketJabatan(u.id, dv) }}</template>
          </i>
        </template>
      </JadwalLembar>

      <p class="px-4 py-3 text-sm text-muted lg:px-5">
        <template v-if="modeAll">
          Semua divisi dalam satu lembar. Sel yang boleh Anda ubah tetap sel divisi Anda sendiri.
        </template>
        <template v-else-if="bisa">
          Klik sel mana pun untuk mengubahnya. Untuk mengisi satu minggu sekaligus, pakai <b>Input Mingguan</b>.
        </template>
        <template v-else>
          Mode lihat saja — yang menyusun jadwal {{ judulLembar }} adalah head divisi itu. Kalau Anda memang head-nya,
          minta admin modul mencentang nama Anda di <b>Pengaturan → Head Divisi</b> lalu menekan <b>Simpan</b>.
        </template>
      </p>
    </AppPanel>

    <JadwalSelEditor
      v-model:open="editor"
      :set="set"
      :target="target"
      @saved="muatUlang"
    />
    <ResponsiveSheet
      v-model:open="salinOpen"
      :title="`Salin bulan lalu ke ${labelBulanJadwal(mk)}`"
    >
      <div class="space-y-2 text-sm">
        <p>Pilih cara mengambilnya:</p>
        <p><b>Ikut hari</b> — Senin mengambil dari Senin, Sabtu dari Sabtu. Ini yang menjaga pola shift & hari libur tetap di tempatnya.</p>
        <p><b>Ikut tanggal</b> — tanggal 1 mengambil dari tanggal 1 bulan lalu. Harinya bergeser dua-tiga hari.</p>
      </div>
      <template #footer>
        <UButton
          label="Ikut hari (Senin↔Senin)"
          @click="salinBulan('hari')"
        />
        <UButton
          label="Ikut tanggal (1↔1)"
          color="neutral"
          variant="outline"
          @click="salinBulan('tanggal')"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="salinOpen = false"
        />
      </template>
    </ResponsiveSheet>
    <JadwalImpor
      v-model:open="imporOpen"
      :set="set"
      :peta="peta"
      :kru="kruDiv"
      :div="div"
      :acuan="`${mk}-15`"
      @simpan="sesudahImpor"
    />
    <JadwalTimpa
      v-model:open="massal.open.value"
      :set="set"
      :title="massal.judul.value"
      :bentrok="massal.bentrok.value"
      :dari-aju="massal.dariAju.value"
      :ya="massal.ya.value"
      :alt="massal.alt.value"
      :sibuk="massal.sibuk.value"
      @ya="massal.jalan"
      @alt="massal.jalanAman"
    >
      <p>{{ massal.pesan.value }}</p>
    </JadwalTimpa>
    <JadwalEkspor
      v-model:open="eksporOpen"
      :set="set"
      :peta="peta"
      :kru="emps"
      :hari="hari"
      judul="jadwal sebulan"
      :nama-berkas="`jadwal-${modeAll ? 'semua' : div}-${mk}.csv`"
    />
    <JadwalTeksWA
      v-model:open="waOpen"
      :teks="waTeks"
    />
  </AppPage>
</template>
