<!--
  Piutang / Bon — THE SAME panel in Cashier and Finance › Omset (old Office had
  two copies writing one `piutang` object; doc F.19). Extracted 2026-10-07;
  each page passes its own `useAsyncData` key via the `kunci` prop.

  A bill closed on the POS while the money has not arrived. Three things are
  recorded: amount, WHO owes it, and the temporary POS method that closed the
  bill — without the method, the Daily Report difference can only be explained
  as a total. Payment is booked on the day the money ARRIVES, never moved back
  to the bill day (cashier.md F.8). Owners are picked from a list: retyping a
  name splits one person into several debts.

  Writes: PUT /kompas/sections/piutang (and /owners for a new owner name), each
  with its own version (T-03).
-->
<script setup lang="ts">
import type { Bon, GrupBon } from '~/utils/cashier'
import {
  BON_TIPE, PAYS, bonBelum, bonGrupBelum, bonRingkasHari, bonTipeNama, fmtRp, idBaru, num, payName, rosterComp,
} from '~/utils/cashier'
import { getOwners, getPiutang, putOwners, putPiutang } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'
import { hariIni, tglPanjang } from '~/utils/format'
import RupiahInput from '~/widgets/cashier/RupiahInput.vue'
import CashierKonfirmasi from '~/widgets/cashier/CashierKonfirmasi.vue'

const props = defineProps<{ kunci?: string }>()

const me = useMe()
const toast = useToast()
const tanggal = ref(hariIni())
const tab = ref<'open' | 'lunas'>('open')

const { data, error, refresh } = useAsyncData(props.kunci ?? 'cashier-piutang', async () => {
  const [bon, owners] = await Promise.all([getPiutang(), getOwners()])
  return { bon, owners }
})
const { data: roster, status: statusRoster, error: errRoster } = useRoster()

const semua = computed<Bon[]>(() => data.value?.bon.value ?? [])
const owners = computed<string[]>(() => data.value?.owners.value ?? [])
const grup = computed(() => bonGrupBelum(semua.value))
const totBelum = computed(() => grup.value.reduce((s, g) => s + g.total, 0))
const bh = computed(() => bonRingkasHari(semua.value, tanggal.value))
const riwayat = computed(() => semua.value.filter(b => b.status === 'lunas')
  .sort((a, b) => String(b.lunasDate || '').localeCompare(String(a.lunasDate || ''))).slice(0, 80))

// PIC for a guest bon: the same Office roster as compliment PICs (one source).
const orang = computed(() => rosterComp(roster.value))
const opsiPay = PAYS.map(p => ({ label: p.n, value: p.k }))
const opsiTipe = BON_TIPE.map(t => ({ label: t.n, value: t.k }))
const OWNER_BARU = '__baru__'

// ---- form (add / edit share ONE form) ----
const editId = ref('')
const edit = computed(() => (editId.value ? semua.value.find(b => b.id === editId.value) ?? null : null))
const f = reactive({ tipe: 'tamu', owner: '', ownerBaru: '', nama: '', pic: '', bill: '', nominal: 0, payKey: 'cash' })
const salah = ref('')

// The owner of a bon being edited stays selectable even if removed from the list,
// otherwise opening an old bon silently renames it to whoever is first.
const opsiOwner = computed(() => {
  const n = owners.value.slice()
  const e = edit.value
  if (e && e.tipe === 'owner' && e.nama && !n.some(x => x.toLowerCase() === String(e.nama).toLowerCase())) n.push(e.nama)
  return [...n.map(x => ({ label: x, value: x })), { label: '+ nama lain…', value: OWNER_BARU }]
})
const opsiPic = computed(() => orang.value.map(u => ({ label: `${u.name} — ${u.div}`, value: u.id })))

function kosongkan() {
  editId.value = ''
  Object.assign(f, { tipe: 'tamu', owner: owners.value[0] ?? OWNER_BARU, ownerBaru: '', nama: '', pic: '', bill: '', nominal: 0, payKey: 'cash' })
  salah.value = ''
}
watch(owners, () => {
  if (!editId.value && !f.owner) f.owner = owners.value[0] ?? OWNER_BARU
}, { immediate: true })

function ubah(b: Bon) {
  editId.value = b.id
  tanggal.value = b.date // the bill date is the date field: keep it with the bon
  Object.assign(f, {
    tipe: b.tipe, owner: b.tipe === 'owner' ? b.nama : (owners.value[0] ?? OWNER_BARU), ownerBaru: '',
    nama: b.tipe !== 'owner' ? b.nama : '', pic: b.picOfficeId || '', bill: b.bill || '', nominal: num(b.nominal), payKey: b.payKey || 'cash',
  })
  salah.value = ''
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}
watch(semua, () => {
  if (editId.value && !edit.value) kosongkan()
})

const menyimpan = ref(false)
async function tulisBon(baru: Bon[], pesan: string): Promise<boolean> {
  if (!data.value) return false
  menyimpan.value = true
  try {
    data.value.bon = await putPiutang(baru, data.value.bon.version)
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
async function tulisOwners(baru: string[], pesan?: string): Promise<boolean> {
  if (!data.value) return false
  try {
    data.value.owners = await putOwners(baru, data.value.owners.version)
    if (pesan) toast.add({ title: pesan, color: 'success' })
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Daftar owner belum tersimpan: ${apiErrorMessage(e)}`, color: 'error' })
    return false
  }
}

async function simpan() {
  const errs: string[] = []
  let nama = ''
  let ownerBaru = ''
  if (f.tipe === 'owner') {
    if (f.owner === OWNER_BARU) {
      ownerBaru = f.ownerBaru.trim()
      nama = ownerBaru
    }
    else nama = f.owner
    if (!nama) errs.push('Nama owner wajib dipilih atau diketik.')
  }
  else {
    nama = f.nama.trim()
    if (!nama) errs.push('Nama yang berhutang wajib diisi.')
  }
  const pic = f.tipe === 'tamu' ? orang.value.find(u => u.id === f.pic) ?? null : null
  if (f.tipe === 'tamu' && !pic) errs.push('Bon tamu wajib punya PIC yang menghandle — tanpa itu tidak ada yang bisa ditanya saat menagih.')
  if (f.nominal <= 0) errs.push('Nominal harus lebih dari nol.')
  if (errs.length) {
    salah.value = errs.join(' ')
    return
  }
  salah.value = ''
  const isi = {
    date: tanggal.value, nama, tipe: f.tipe, bill: f.bill.trim(), nominal: f.nominal, payKey: f.payKey,
    picName: pic ? pic.name : '', picOfficeId: pic ? pic.id : '', picDiv: pic ? pic.div : '',
  }
  const namaSaya = me.value?.name ?? ''
  const e = edit.value
  // Editing does NOT touch the payment snapshot: when & how the money came in
  // stays the business of "Batal Lunas", never a second path (:1790-1797).
  const baru = e
    ? semua.value.map(b => (b.id === e.id ? { ...b, ...isi, ubahBy: namaSaya, ubahAt: Date.now() } : b))
    : [...semua.value, {
        id: idBaru('pt'), ...isi,
        status: 'open', lunasDate: '', lunasPayKey: '', lunasBy: '', lunasAt: 0, by: namaSaya, at: Date.now(),
      }]
  if (!(await tulisBon(baru, e ? 'Perubahan bon tersimpan' : 'Bon tersimpan'))) return
  // Compared lower-case so "Pak Rudi" is not added twice as "pak rudi".
  if (ownerBaru && !owners.value.some(n => n.toLowerCase() === ownerBaru.toLowerCase())) {
    await tulisOwners([...owners.value, ownerBaru])
  }
  kosongkan()
}

// ---- pay off: per group, with ticks (default all ticked) ----
const pilih = reactive<Record<string, Set<string>>>({})
const lunasTgl = reactive<Record<string, string>>({})
const lunasPay = reactive<Record<string, string>>({})
const kunciGrup = (g: GrupBon) => `${String(g.nama || '').trim().toLowerCase()}|${g.tipe}`
watch(grup, (gs) => {
  for (const g of gs) {
    const k = kunciGrup(g)
    const ids = new Set(g.items.map(b => b.id))
    const lama = pilih[k]
    pilih[k] = lama ? new Set([...lama].filter(id => ids.has(id))) : ids
    lunasTgl[k] ??= hariIni()
    lunasPay[k] ??= 'cash'
  }
}, { immediate: true })
const terpilih = (g: GrupBon) => g.items.filter(b => pilih[kunciGrup(g)]?.has(b.id))
const sumTerpilih = (g: GrupBon) => terpilih(g).reduce((s, b) => s + num(b.nominal), 0)
function centang(g: GrupBon, id: string, v: boolean) {
  const s = pilih[kunciGrup(g)]!
  if (v) s.add(id)
  else s.delete(id)
}
function centangSemua(g: GrupBon, v: boolean) {
  pilih[kunciGrup(g)] = new Set(v ? g.items.map(b => b.id) : [])
}

// ---- one confirmation sheet for every destructive / money-moving action ----
const konfirmasi = ref<{ judul: string, isi: string, label: string, warna: 'error' | 'primary', jalan: () => Promise<void> } | null>(null)
const konfirmasiBuka = computed({
  get: () => !!konfirmasi.value,
  set: (v) => {
    if (!v) konfirmasi.value = null
  },
})
async function jalankan() {
  const k = konfirmasi.value
  if (!k) return
  await k.jalan()
  konfirmasi.value = null
}

function lunasi(g: GrupBon) {
  const pil = terpilih(g)
  if (!pil.length) return
  const k = kunciGrup(g)
  const tgl = lunasTgl[k] || hariIni()
  const pay = lunasPay[k] || 'cash'
  const ids = new Set(pil.map(b => b.id))
  konfirmasi.value = {
    judul: `Lunasi ${ids.size} bon atas nama ${g.nama} senilai ${fmtRp(sumTerpilih(g))}?`,
    isi: `Uang dicatat masuk pada ${tglPanjang(tgl)} lewat ${payName(pay)}. Report Daily tanggal itu akan menampilkannya sebagai pelunasan.`,
    label: 'Lunasi',
    warna: 'primary',
    jalan: async () => {
      const namaSaya = me.value?.name ?? ''
      await tulisBon(semua.value.map(b => (ids.has(b.id)
        ? { ...b, status: 'lunas', lunasDate: tgl, lunasPayKey: pay, lunasBy: namaSaya, lunasAt: Date.now() }
        : b)), 'Bon dilunasi')
    },
  }
}
function batalLunas(b: Bon) {
  konfirmasi.value = {
    judul: 'Kembalikan bon ini ke status BELUM LUNAS?',
    isi: 'Pelunasannya akan hilang dari Report Daily tanggal tersebut.',
    label: 'Batal lunas',
    warna: 'error',
    jalan: async () => {
      await tulisBon(semua.value.map(x => (x.id === b.id
        ? { ...x, status: 'open', lunasDate: '', lunasPayKey: '', lunasBy: '', lunasAt: 0 }
        : x)), 'Bon dikembalikan ke belum lunas')
    },
  }
}
function hapusBon(b: Bon) {
  konfirmasi.value = {
    judul: 'Hapus catatan bon ini?',
    isi: 'Selisih Report Daily tanggal billnya akan kembali tidak terjelaskan.',
    label: 'Hapus',
    warna: 'error',
    jalan: async () => {
      if (await tulisBon(semua.value.filter(x => x.id !== b.id), 'Bon dihapus') && editId.value === b.id) kosongkan()
    },
  }
}
// Removes the name from the PICK LIST only; bon already under it stay intact.
function hapusOwner(i: number) {
  const nama = owners.value[i]
  if (!nama) return
  konfirmasi.value = {
    judul: `Hapus "${nama}" dari daftar owner?`,
    isi: 'Bon yang sudah terlanjur atas nama itu TIDAK ikut terhapus.',
    label: 'Hapus',
    warna: 'error',
    jalan: async () => {
      await tulisOwners(owners.value.filter((_, j) => j !== i), 'Owner dihapus dari daftar')
    },
  }
}

const helpPic = computed(() => {
  if (errRoster.value) return `Daftar PIC gagal dimuat dari Office: ${apiErrorMessage(errRoster.value)}.`
  if (statusRoster.value === 'pending') return 'Memuat daftar dari Office…'
  if (!orang.value.length) return 'Belum ada akun Office ber-Tim/Keterangan Kasir, Marketing, Event, atau Office.'
  return 'kasir / marketing / event / office'
})
</script>

<template>
  <AppPage
    title="Piutang / bon"
    description="Bill yang belum dibayar tamu & owner — beserta metode POS sementaranya."
  >
    <AppPanel
      :title="edit ? 'Ubah bon' : 'Catat bon baru'"
      :description="edit ? 'Sedang mengubah bon yang sudah tercatat.' : 'Bill yang sudah ditutup di POS tapi uangnya belum diterima.'"
    >
      <template #actions>
        <UFormField label="Tanggal bill">
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

    <AppPanel :class="edit ? 'ring-2 ring-primary-400' : ''">
      <UAlert
        v-if="edit"
        class="mb-3"
        color="info"
        variant="subtle"
        icon="i-lucide-pencil"
        :title="`Mengubah bon ${edit.nama} ${fmtRp(num(edit.nominal))} tanggal ${edit.date}${edit.status === 'lunas' ? ' (sudah lunas)' : ''}. Tanggal bill diubah lewat kotak tanggal di atas.`"
      />
      <div class="grid gap-3 lg:grid-cols-3">
        <UFormField label="Tipe">
          <USelect
            v-model="f.tipe"
            :items="opsiTipe"
            class="w-full"
          />
        </UFormField>
        <template v-if="f.tipe === 'owner'">
          <UFormField label="Nama owner">
            <USelect
              v-model="f.owner"
              :items="opsiOwner"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="f.owner === OWNER_BARU"
            label="Nama owner baru"
            help="akan ikut tersimpan ke daftar owner"
          >
            <UInput
              v-model="f.ownerBaru"
              placeholder="cth. Pak Rudi"
              class="w-full"
            />
          </UFormField>
        </template>
        <UFormField
          v-else
          label="Nama yang berhutang"
        >
          <UInput
            v-model="f.nama"
            placeholder="cth. Pak Budi (nama tamunya)"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="f.tipe === 'tamu'"
          label="PIC yang menghandle"
          :help="helpPic"
        >
          <USelect
            v-model="f.pic"
            :items="opsiPic"
            placeholder="— pilih PIC —"
            class="w-full"
          />
        </UFormField>
        <UFormField label="No. bill / keterangan">
          <UInput
            v-model="f.bill"
            placeholder="cth. #1042 meja 7"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Nominal">
          <RupiahInput v-model="f.nominal" />
        </UFormField>
        <UFormField label="Metode POS sementara">
          <USelect
            v-model="f.payKey"
            :items="opsiPay"
            class="w-full"
          />
        </UFormField>
      </div>
      <div
        v-if="f.tipe === 'owner'"
        class="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted"
      >
        <span>Daftar owner:</span>
        <span v-if="!owners.length">Belum ada nama owner — pilih "+ nama lain…" untuk menambah yang pertama.</span>
        <AppStatus
          v-for="(n, i) in owners"
          :key="n"
          size="sm"
        >
          {{ n }}
          <button
            type="button"
            class="ml-1 font-bold text-error"
            :aria-label="`Hapus ${n} dari daftar owner`"
            @click="hapusOwner(i)"
          >
            <UIcon
              name="i-lucide-x"
              class="size-3"
            />
          </button>
        </AppStatus>
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
          :label="edit ? 'Simpan perubahan' : 'Tambah bon'"
          :icon="edit ? 'i-lucide-save' : 'i-lucide-plus'"
          :loading="menyimpan"
          :disabled="!data"
          @click="simpan"
        />
        <UButton
          v-if="edit"
          label="Batal"
          color="neutral"
          variant="outline"
          @click="kosongkan"
        />
      </div>
    </AppPanel>

    <AppStatGrid>
      <AppStat
        label="Total belum lunas"
        icon="i-lucide-hand-coins"
        :value="fmtRp(totBelum)"
        sub="seluruh tanggal"
      />
      <AppStat
        label="Orang berhutang"
        icon="i-lucide-users"
        tone="info"
        :value="grup.length"
        :sub="`${bonBelum(semua).length} bon`"
      />
      <AppStat
        :label="`Bon baru ${tglPanjang(tanggal)}`"
        icon="i-lucide-arrow-down-left"
        tone="error"
        :value="fmtRp(bh.totBaru)"
        :sub="`${bh.listBaru.length} bon · mengurangi uang hari itu`"
      />
      <AppStat
        :label="`Pelunasan ${tglPanjang(tanggal)}`"
        icon="i-lucide-arrow-up-right"
        tone="success"
        :value="fmtRp(bh.totLunas)"
        :sub="`${bh.listLunas.length} bon · menambah uang hari itu`"
      />
    </AppStatGrid>

    <AppSeg
      v-model="tab"
      :options="[{ value: 'open', label: 'Belum lunas', badge: bonBelum(semua).length }, { value: 'lunas', label: 'Riwayat pelunasan' }]"
    />

    <template v-if="tab === 'open'">
      <AppPanel v-if="!grup.length">
        <p class="py-6 text-center text-sm text-muted">
          <UIcon
            name="i-lucide-circle-check"
            class="mb-1 block size-6 w-full text-success"
          />
          Tidak ada bon yang belum lunas.
        </p>
      </AppPanel>
      <AppPanel
        v-for="g in grup"
        :key="kunciGrup(g)"
        :title="g.nama"
        :description="`${bonTipeNama(g.tipe)} · ${g.items.length} bon belum lunas`"
      >
        <template #actions>
          <div class="text-right">
            <span class="block text-[11px] font-bold uppercase tracking-wider text-muted">Total hutang</span>
            <span class="text-xl font-extrabold text-error num">{{ fmtRp(g.total) }}</span>
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-table-head text-table-head-text">
              <tr class="text-left text-[11px] uppercase tracking-wider">
                <th class="w-9 px-3 py-2">
                  <UCheckbox
                    :model-value="terpilih(g).length === g.items.length"
                    aria-label="Pilih semua"
                    @update:model-value="v => centangSemua(g, !!v)"
                  />
                </th>
                <th class="px-3 py-2">
                  Tanggal bill
                </th>
                <th class="hidden px-3 py-2 lg:table-cell">
                  No. bill / keterangan
                </th>
                <th class="hidden px-3 py-2 lg:table-cell">
                  PIC penghandle
                </th>
                <th class="px-3 py-2">
                  Metode POS sementara
                </th>
                <th class="px-3 py-2 text-right">
                  Nominal
                </th>
                <th class="hidden px-3 py-2 lg:table-cell">
                  Dicatat oleh
                </th>
                <th class="px-3 py-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="b in g.items"
                :key="b.id"
              >
                <td class="px-3 py-2">
                  <UCheckbox
                    :model-value="pilih[kunciGrup(g)]?.has(b.id)"
                    :aria-label="`Pilih bon ${b.date}`"
                    @update:model-value="v => centang(g, b.id, !!v)"
                  />
                </td>
                <td class="px-3 py-2 num">
                  {{ b.date }}
                </td>
                <td class="hidden px-3 py-2 lg:table-cell">
                  {{ b.bill || '—' }}
                </td>
                <td class="hidden px-3 py-2 lg:table-cell">
                  <template v-if="b.picName">
                    {{ b.picName }} <span class="text-xs text-muted">· {{ b.picDiv }}</span>
                  </template>
                  <span
                    v-else
                    class="text-dimmed"
                  >—</span>
                </td>
                <td class="px-3 py-2">
                  <AppStatus
                    color="warning"
                    size="sm"
                  >
                    {{ payName(b.payKey) }}
                  </AppStatus>
                </td>
                <td class="px-3 py-2 text-right font-bold num">
                  {{ fmtRp(num(b.nominal)) }}
                </td>
                <td class="hidden px-3 py-2 text-xs text-muted lg:table-cell">
                  {{ b.by || '—' }}
                </td>
                <td class="whitespace-nowrap px-3 py-2">
                  <UButton
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    aria-label="Ubah"
                    @click="ubah(b)"
                  />
                  <UButton
                    class="ml-1"
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="soft"
                    size="xs"
                    aria-label="Hapus"
                    @click="hapusBon(b)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-3 grid items-end gap-3 lg:grid-cols-3">
          <UFormField label="Tanggal uang diterima">
            <UInput
              v-model="lunasTgl[kunciGrup(g)]"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Metode pembayaran pelunasan">
            <USelect
              v-model="lunasPay[kunciGrup(g)]"
              :items="opsiPay"
              class="w-full"
            />
          </UFormField>
          <UButton
            block
            :label="`Lunasi terpilih · ${fmtRp(sumTerpilih(g))}`"
            icon="i-lucide-check"
            :disabled="!terpilih(g).length"
            @click="lunasi(g)"
          />
        </div>
        <p class="mt-2 text-xs text-muted">
          Uang dicatat masuk pada tanggal di atas, bukan tanggal billnya.
        </p>
      </AppPanel>
    </template>

    <AppPanel
      v-else
      title="Riwayat pelunasan"
      description="80 pelunasan terakhir."
      flush
    >
      <p
        v-if="!riwayat.length"
        class="p-6 text-center text-sm text-muted"
      >
        Belum ada pelunasan tercatat.
      </p>
      <div
        v-else
        class="overflow-x-auto"
      >
        <table class="w-full text-sm">
          <thead class="bg-table-head text-table-head-text">
            <tr class="text-left text-[11px] uppercase tracking-wider">
              <th class="px-3 py-2">
                Nama
              </th>
              <th class="hidden px-3 py-2 lg:table-cell">
                Tanggal bill
              </th>
              <th class="hidden px-3 py-2 lg:table-cell">
                No. bill
              </th>
              <th class="px-3 py-2 text-right">
                Nominal
              </th>
              <th class="px-3 py-2">
                Tanggal uang masuk
              </th>
              <th class="hidden px-3 py-2 lg:table-cell">
                Metode pelunasan
              </th>
              <th class="hidden px-3 py-2 lg:table-cell">
                Dilunasi oleh
              </th>
              <th class="px-3 py-2" />
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="b in riwayat"
              :key="b.id"
            >
              <td class="px-3 py-2">
                <b>{{ b.nama }}</b> <AppStatus size="sm">
                  {{ bonTipeNama(b.tipe) }}
                </AppStatus>
              </td>
              <td class="hidden px-3 py-2 num lg:table-cell">
                {{ b.date }}
              </td>
              <td class="hidden px-3 py-2 lg:table-cell">
                {{ b.bill || '—' }}
              </td>
              <td class="px-3 py-2 text-right font-bold num">
                {{ fmtRp(num(b.nominal)) }}
              </td>
              <td class="px-3 py-2">
                <AppStatus
                  color="success"
                  size="sm"
                >
                  {{ b.lunasDate || '—' }}
                </AppStatus>
              </td>
              <td class="hidden px-3 py-2 lg:table-cell">
                {{ payName(b.lunasPayKey) }}
              </td>
              <td class="hidden px-3 py-2 text-xs text-muted lg:table-cell">
                {{ b.lunasBy || '—' }}
              </td>
              <td class="whitespace-nowrap px-3 py-2">
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  aria-label="Ubah"
                  @click="ubah(b)"
                />
                <UButton
                  class="ml-1"
                  label="Batal lunas"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="batalLunas(b)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppPanel>

    <CashierKonfirmasi
      v-model:open="konfirmasiBuka"
      :title="konfirmasi?.judul ?? ''"
      :description="konfirmasi?.isi"
      :confirm-label="konfirmasi?.label"
      :color="konfirmasi?.warna"
      :loading="menyimpan"
      @konfirmasi="jalankan"
    />
  </AppPage>
</template>
