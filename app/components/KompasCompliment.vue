<!--
  Compliment — THE SAME panel in Cashier and Finance › Omset (old Office had two
  copies writing one `compliments` object; doc F.19). Extracted 2026-10-07;
  each page passes its own `useAsyncData` key via the `kunci` prop.

  Two PICs (cashier.md F.9): the PIC Kasir is cut by the Sub Total straight
  away; the PIC Pemberi waits for the decision in Performa Marketing/Event,
  which this screen only reads. "Tamu" points at nobody. Changing the giver
  resets that decision. The day's total must equal POS Compliment + POS Member
  Deposit of the Daily Report.

  Written as ONE part: PUT /kompas/sections/compliments with its version (T-03).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ComplimentKasir } from '~/utils/cashier'
import {
  PIC_TAMU, angkaRD, compStatusPemberi, divPemberi, fmtRp, fmtSel, gantiPemberi, idBaru, num, rosterComp,
} from '~/utils/cashier'
import { getCompliments, getReport, putCompliments } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'
import { hariIni, tglPanjang } from '~/utils/format'
import RupiahInput from '~/widgets/cashier/RupiahInput.vue'
import CashierKonfirmasi from '~/widgets/cashier/CashierKonfirmasi.vue'

const props = defineProps<{ kunci?: string }>()

const me = useMe()
const toast = useToast()
const tanggal = ref(hariIni())

const { data, error, refresh } = useAsyncData(
  props.kunci ?? 'cashier-compliment',
  async () => {
    const [comps, rep] = await Promise.all([getCompliments(), getReport(tanggal.value)])
    return { comps, rep }
  },
  { watch: [tanggal] },
)
const { data: roster, status: statusRoster, error: errRoster } = useRoster()

const semua = computed<ComplimentKasir[]>(() => data.value?.comps.value ?? [])
const list = computed(() => semua.value.filter(c => c.date === tanggal.value))
const total = computed(() => list.value.reduce((s, c) => s + num(c.nominal), 0))
const rd = computed(() => angkaRD(data.value?.rep.value ?? null, total.value))
const adaRincian = computed(() => list.value.some(c => c.subTotal != null || c.tax != null || c.service != null))

// PIC Kasir only from Tim Kasir; PIC Pemberi from marketing/event/office (:2004-2011).
const orang = computed(() => rosterComp(roster.value))
const kasirRoster = computed(() => orang.value.filter(u => u.divs.includes('kasir')))
const pemberiRoster = computed(() => orang.value.filter(u => !!divPemberi(u)))
const opsiKasir = computed(() => [{ label: 'Tamu', value: PIC_TAMU }, ...kasirRoster.value.map(u => ({ label: u.name, value: u.id }))])
const opsiPemberi = computed(() => [{ label: 'Tamu', value: PIC_TAMU }, ...pemberiRoster.value.map(u => ({ label: `${u.name} — ${divPemberi(u)}`, value: u.id }))])

// ---- form (add / edit share ONE form, like the old screen) ----
const editId = ref('')
const f = reactive({ nama: '', subTotal: 0, tax: 0, service: 0, pic: PIC_TAMU, pemberi: PIC_TAMU })
const salah = ref('')
const totalForm = computed(() => f.subTotal + f.tax + f.service)

function kosongkan() {
  editId.value = ''
  Object.assign(f, { nama: '', subTotal: 0, tax: 0, service: 0, pic: PIC_TAMU, pemberi: PIC_TAMU })
  salah.value = ''
}
function ubah(c: ComplimentKasir) {
  editId.value = c.id
  tanggal.value = c.date
  Object.assign(f, {
    nama: c.nama || '',
    subTotal: c.subTotal != null ? num(c.subTotal) : 0,
    tax: c.tax != null ? num(c.tax) : 0,
    service: c.service != null ? num(c.service) : 0,
    pic: c.picOfficeId || PIC_TAMU,
    pemberi: c.pemberiOfficeId || PIC_TAMU,
  })
  salah.value = ''
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}
// A row being edited can vanish (deleted elsewhere, reloaded): leave edit mode.
watch(semua, () => {
  if (editId.value && !semua.value.some(c => c.id === editId.value)) kosongkan()
})

const menyimpan = ref(false)
async function tulis(baru: ComplimentKasir[], pesan: string) {
  if (!data.value) return false
  menyimpan.value = true
  try {
    data.value.comps = await putCompliments(baru, data.value.comps.version)
    toast.add({ title: pesan, color: 'success' })
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
  finally {
    menyimpan.value = false
  }
}

async function simpan() {
  const errs: string[] = []
  const nama = f.nama.trim()
  if (!nama) errs.push('Nama compliment wajib diisi.')
  if (totalForm.value <= 0) errs.push('Sub total, tax, dan service charge tidak boleh nol semua.')
  if (errs.length) {
    salah.value = errs.join(' ')
    return
  }
  salah.value = ''
  const u = kasirRoster.value.find(x => x.id === f.pic)
  const pv = pemberiRoster.value.find(x => x.id === f.pemberi)
  // `nominal` IS stored: monthly recaps, the WA report and the detail card read it.
  const isi = {
    date: tanggal.value, nama, subTotal: f.subTotal, tax: f.tax, service: f.service, nominal: totalForm.value,
    picName: u ? u.name : 'Tamu', picOfficeId: u ? u.id : '', picDiv: u ? 'kasir' : 'tamu',
    pemberiName: pv ? pv.name : 'Tamu', pemberiOfficeId: pv ? pv.id : '', pemberiDiv: pv ? divPemberi(pv) : 'tamu',
  }
  const nama_ = me.value?.name ?? ''
  let baru: ComplimentKasir[]
  const lama = editId.value ? semua.value.find(c => c.id === editId.value) : undefined
  if (lama) {
    // Kept: id, who recorded it, when, and `alasan`. The giver's decision is
    // kept unless the giver changed (it was taken on someone else's behalf).
    const reset = gantiPemberi(lama, isi)
    const rec: ComplimentKasir = { ...lama, ...isi, ubahOleh: nama_, ubahAt: Date.now() }
    if (reset) Object.assign(rec, { pemberiStatus: 'menunggu', putusOleh: '', putusAt: 0 })
    baru = semua.value.map(c => (c.id === lama.id ? rec : c))
  }
  else {
    baru = [...semua.value, {
      id: idBaru('c'), alasan: '', pemberiStatus: 'menunggu', putusOleh: '', putusAt: 0,
      by: nama_, at: Date.now(), ...isi,
    }]
  }
  if (await tulis(baru, lama ? 'Perubahan compliment tersimpan' : 'Compliment tersimpan')) kosongkan()
}

const hapusTarget = ref<ComplimentKasir | null>(null)
const hapusBuka = computed({
  get: () => !!hapusTarget.value,
  set: (v) => {
    if (!v) hapusTarget.value = null
  },
})
async function hapus() {
  const c = hapusTarget.value
  if (!c) return
  if (await tulis(semua.value.filter(x => x.id !== c.id), 'Compliment dihapus')) {
    if (editId.value === c.id) kosongkan()
    hapusTarget.value = null
  }
}

const statusPemberi = (c: ComplimentKasir) => {
  const s = compStatusPemberi(c)
  return s === 'potong'
    ? { color: 'error' as const, l: 'Dipotong' }
    : s === 'tidak' ? { color: 'success' as const, l: 'Tidak dipotong' } : { color: 'neutral' as const, l: 'Menunggu keputusan' }
}
const pemberiTamu = (c: ComplimentKasir) => !c.pemberiName || c.pemberiDiv === 'tamu'
const kasirTamu = (c: ComplimentKasir) => c.picDiv === 'tamu' || !c.picName

const kolom = computed<TableColumn<ComplimentKasir>[]>(() => [
  { accessorKey: 'nama', header: 'Nama' },
  ...(adaRincian.value
    ? [{ id: 'sub', header: 'Sub total' }, { id: 'tax', header: 'Tax' }, { id: 'svc', header: 'Service' }] as TableColumn<ComplimentKasir>[]
    : []),
  { id: 'total', header: 'Total' },
  { id: 'pic', header: 'PIC kasir' },
  { id: 'pemberi', header: 'Pemberi' },
  { accessorKey: 'by', header: 'Dicatat oleh' },
  { id: 'aksi', header: '' },
])
const sel = (v: unknown) => (v != null ? fmtRp(num(v)) : '—')
</script>

<template>
  <AppPage
    title="Compliment"
    description="Catatan compliment beserta alasan & PIC penanggungnya."
  >
    <AppPanel
      title="Catatan compliment"
      description="PIC Kasir selain Tamu langsung dipotong realisasinya sebesar Sub Total. PIC Pemberi tidak — potongannya baru berlaku setelah disetujui di halaman Performa Marketing/Event."
    >
      <template #actions>
        <UFormField label="Tanggal">
          <UInput
            v-model="tanggal"
            type="date"
          />
        </UFormField>
      </template>
    </AppPanel>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <AppPanel
      :title="editId ? `Ubah compliment — ${f.nama}` : 'Tambah compliment'"
      :icon="editId ? 'i-lucide-pencil' : 'i-lucide-plus'"
      :class="editId ? 'ring-2 ring-primary-400' : ''"
    >
      <div class="grid gap-3 lg:grid-cols-3">
        <UFormField label="Nama compliment">
          <UInput
            v-model="f.nama"
            placeholder="cth. Birthday Cake"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Sub total">
          <RupiahInput v-model="f.subTotal" />
        </UFormField>
        <UFormField label="Tax">
          <RupiahInput v-model="f.tax" />
        </UFormField>
        <UFormField label="Service charge">
          <RupiahInput v-model="f.service" />
        </UFormField>
        <UFormField
          label="PIC kasir"
          :help="errRoster ? `Daftar PIC gagal dimuat dari Office: ${apiErrorMessage(errRoster)}. Hanya &quot;Tamu&quot; yang tersedia.` : statusRoster === 'pending' ? 'Memuat daftar dari Office…' : !kasirRoster.length ? 'Belum ada akun Office ber-Tim/Keterangan Kasir.' : undefined"
        >
          <USelect
            v-model="f.pic"
            :items="opsiKasir"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="PIC pemberi"
          :help="!errRoster && statusRoster !== 'pending' && !pemberiRoster.length ? 'Belum ada akun Office ber-Tim/Keterangan Marketing, Event, atau Office.' : undefined"
        >
          <USelect
            v-model="f.pemberi"
            :items="opsiPemberi"
            class="w-full"
          />
        </UFormField>
      </div>
      <!-- The total is shown BEFORE saving: the Sub Total that cuts the PIC comes from it. -->
      <div class="mt-3 rounded-field bg-muted p-3 text-sm">
        Total compliment: <b class="num">{{ fmtRp(totalForm) }}</b>
        <span class="text-xs text-muted">(sub total {{ fmtRp(f.subTotal) }} + tax {{ fmtRp(f.tax) }} + service {{ fmtRp(f.service) }})</span>
        <span class="mt-1 block text-xs text-muted">Yang memotong realisasi: <b>{{ fmtRp(f.subTotal) }}</b> — tax &amp; service charge bukan omset siapa pun. Langsung berlaku untuk <b>PIC Kasir</b>; untuk <b>PIC Pemberi</b> menunggu persetujuan di Performa.</span>
      </div>
      <UAlert
        v-if="salah"
        class="mt-3"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="salah"
      />
      <div class="mt-3 flex gap-2">
        <UButton
          :label="editId ? 'Simpan perubahan' : 'Tambah'"
          :icon="editId ? 'i-lucide-save' : 'i-lucide-plus'"
          :loading="menyimpan"
          :disabled="!data"
          @click="simpan"
        />
        <UButton
          v-if="editId"
          label="Batal"
          color="neutral"
          variant="outline"
          @click="kosongkan"
        />
      </div>
    </AppPanel>

    <AppStatGrid>
      <AppStat
        :label="`Total compliment ${tglPanjang(tanggal)}`"
        icon="i-lucide-gift"
        :value="fmtRp(total)"
        :sub="`${list.length} catatan`"
      />
      <AppStat
        label="Report Daily (POS)"
        icon="i-lucide-clipboard-list"
        tone="info"
        :value="fmtRp(rd.total)"
        :sub="`Compliment ${fmtRp(rd.comp)} + Member Deposit ${fmtRp(rd.dep)}`"
      />
      <AppStat
        label="Selisih"
        icon="i-lucide-scale"
        :tone="rd.cocok ? 'success' : 'error'"
        :value="rd.ada ? fmtSel(total - rd.total) : '—'"
        :sub="rd.ada ? (rd.cocok ? 'cocok' : 'harus dicocokkan') : 'Report Daily belum diisi'"
      />
    </AppStatGrid>

    <!-- Matching to the Daily Report (old kartuCocokRD, :1984-1991). -->
    <UAlert
      v-if="!rd.ada"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Report Daily tanggal ini belum diisi."
      description="Total compliment di bawah belum bisa dicocokkan. Isi Compliment & Member Deposit di menu Report Daily, lalu angkanya harus sama persis dengan total di sini."
    />
    <UAlert
      v-else-if="rd.cocok"
      color="success"
      variant="subtle"
      icon="i-lucide-circle-check"
      :title="`Cocok dengan Report Daily — Compliment ${fmtRp(rd.comp)} + Member Deposit ${fmtRp(rd.dep)} = ${fmtRp(rd.total)}.`"
    />
    <UAlert
      v-else
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Tidak cocok dengan Report Daily."
      :description="`Catatan di halaman ini ${fmtRp(rd.catat)}, sedangkan POS Compliment ${fmtRp(rd.comp)} + Member Deposit ${fmtRp(rd.dep)} = ${fmtRp(rd.total)} — ${rd.selisih < 0
        ? `masih ada ${fmtRp(-rd.selisih)} yang belum ditulis catatannya di sini, jadi barang segitu keluar tanpa PIC yang menanggungnya`
        : `catatan di sini kelebihan ${fmtRp(rd.selisih)} dibanding angka mesin kasir`}. Perbaiki salah satunya sebelum tutup hari.`"
    />

    <AppPanel
      title="Daftar compliment hari ini"
      icon="i-lucide-list"
      :count="list.length"
      flush
    >
      <p
        v-if="!list.length"
        class="p-6 text-center text-sm text-muted"
      >
        Belum ada compliment pada tanggal ini.
      </p>
      <template v-else>
        <UTable
          class="hidden lg:block"
          :data="list"
          :columns="kolom"
        >
          <template #nama-cell="{ row }">
            <b class="text-highlighted">{{ row.original.nama }}</b>
            <span
              v-if="row.original.alasan"
              class="block text-xs text-muted"
            >{{ row.original.alasan }}</span>
          </template>
          <template #sub-cell="{ row }">
            <span class="num">{{ sel(row.original.subTotal) }}</span>
          </template>
          <template #tax-cell="{ row }">
            <span class="num">{{ sel(row.original.tax) }}</span>
          </template>
          <template #svc-cell="{ row }">
            <span class="num">{{ sel(row.original.service) }}</span>
          </template>
          <template #total-cell="{ row }">
            <b class="num">{{ fmtRp(num(row.original.nominal)) }}</b>
          </template>
          <template #pic-cell="{ row }">
            <AppStatus
              v-if="kasirTamu(row.original)"
              size="sm"
            >
              Tamu
            </AppStatus>
            <span v-else>{{ row.original.picName }}</span>
          </template>
          <template #pemberi-cell="{ row }">
            <AppStatus
              v-if="pemberiTamu(row.original)"
              size="sm"
            >
              Tamu
            </AppStatus>
            <div v-else>
              {{ row.original.pemberiName }} <span class="text-xs text-muted">· {{ row.original.pemberiDiv }}</span>
              <div class="mt-1">
                <AppStatus
                  :color="statusPemberi(row.original).color"
                  size="sm"
                >
                  {{ statusPemberi(row.original).l }}
                </AppStatus>
              </div>
            </div>
          </template>
          <template #by-cell="{ row }">
            <span class="text-xs text-muted">{{ row.original.by || '—' }}</span>
          </template>
          <template #aksi-cell="{ row }">
            <div class="flex gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="outline"
                size="xs"
                aria-label="Ubah catatan ini"
                @click="ubah(row.original)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="soft"
                size="xs"
                aria-label="Hapus"
                @click="hapusTarget = row.original"
              />
            </div>
          </template>
        </UTable>

        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="c in list"
            :key="c.id"
            class="p-4"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <b class="text-highlighted">{{ c.nama }}</b>
                <span class="block text-xs text-muted">
                  Kasir: {{ kasirTamu(c) ? 'Tamu' : c.picName }} · Pemberi: {{ pemberiTamu(c) ? 'Tamu' : `${c.pemberiName} (${c.pemberiDiv})` }}
                </span>
              </div>
              <b class="num">{{ fmtRp(num(c.nominal)) }}</b>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <AppStatus
                v-if="!pemberiTamu(c)"
                :color="statusPemberi(c).color"
                size="sm"
              >
                {{ statusPemberi(c).l }}
              </AppStatus>
              <span class="text-xs text-muted">oleh {{ c.by || '—' }}</span>
              <span class="flex-1" />
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="outline"
                size="xs"
                aria-label="Ubah"
                @click="ubah(c)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="soft"
                size="xs"
                aria-label="Hapus"
                @click="hapusTarget = c"
              />
            </div>
          </div>
        </div>
      </template>
    </AppPanel>

    <CashierKonfirmasi
      v-model:open="hapusBuka"
      title="Hapus catatan compliment ini?"
      :loading="menyimpan"
      @konfirmasi="hapus"
    />
  </AppPage>
</template>
