<!--
  Finance › Kas Kecil › Input Transaksi (old `viewKkInput` + `kkSimpanSemua`, deploy/finance/kas/index.html:5456-5910).

  Layout as the old screen: the "Purchase Order belum diinput" panel (BD OS), then
  one table where one row = one transaction — Tanggal, Keterangan, Kategori, Jenis,
  one column per active pos, Total, Input, Bon. Rows are saved one by one (the old
  screen sent `simpanTrx` sequentially too — there is no bulk endpoint).

  Jenis: "Kredit — keluar" (spending, the default) and "Debet — masuk" (top-up,
  opening balance). Debet ADDS to the pos saldo, kredit subtracts.
  A new row inherits the date, jenis and kategori of the last one (a stack of
  same-day receipts). Rows left completely empty are ignored on save.

  PO panel: POs that are submitted (their PR sheet is no longer Draft), not done
  and without a realisation, nearest need-by first. "+ Input" copies the item into
  a draft row WITHOUT the amount — the book records money actually spent, and a
  prefilled request amount gets saved as-is by someone in a hurry. After the trx
  is saved, its total is written back as the PO realisation; a failure there is
  reported, never swallowed (the kas row is already right, but the PR sheet is not).
-->
<script setup lang="ts">
import type { BdPo, BdPr } from '~/composables/useBd'
import { daftarBd, setRealisasi } from '~/composables/useBd'
import { createKkTrx, getKk, getKkTrxSatu, updateKkTrx } from '~/composables/useFinance'
import { fmtRp } from '~/utils/cashier'
import { hariIni, tglLabel } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'
import RupiahInput from '~/widgets/cashier/RupiahInput.vue'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const toast = useToast()
const route = useRoute()

const { data, status, error, refresh } = useAsyncData('kas-kk-input', () => getKk())

const pos = computed(() => (data.value?.data.pos ?? []).filter(p => p.aktif !== false))
const kategori = computed(() => (data.value?.data.kategori ?? []).filter(k => k.aktif !== false))
const opsiKategori = computed(() => [{ label: '— tanpa kategori —', value: '__kosong' }, ...kategori.value.map(k => ({ label: k.nama, value: String(k.id) }))])
const OPSI_JENIS = [{ label: 'Kredit — keluar', value: 'kredit' }, { label: 'Debet — masuk', value: 'debet' }]

interface Draft {
  key: number
  id?: string
  tgl: string
  keterangan: string
  kategori_id: string
  jenis: 'debet' | 'kredit'
  nilai: Record<string, number>
  input: boolean
  bon: boolean
  poId: string
  poAmount: number
}
let seq = 0
const draft = ref<Draft[]>([])
const salah = ref<Record<number, string[]>>({})
const sibuk = ref(false)
const sedangUbah = computed(() => !!route.query.ubah)

function barisKosong(): Draft {
  return { key: ++seq, tgl: hariIni(), keterangan: '', kategori_id: '__kosong', jenis: 'kredit', nilai: {}, input: false, bon: false, poId: '', poAmount: 0 }
}
function tambahBaris() {
  const akhir = draft.value[draft.value.length - 1]
  const b = barisKosong()
  if (akhir) {
    b.tgl = akhir.tgl || b.tgl
    b.jenis = akhir.jenis
    b.kategori_id = akhir.kategori_id
  }
  draft.value.push(b)
}
function buangBaris(i: number) {
  draft.value.splice(i, 1)
  if (!draft.value.length) draft.value.push(barisKosong())
}
const totalDraft = (d: Draft) => pos.value.reduce((s, p) => s + (d.nilai[String(p.id)] || 0), 0)
const kosong = (d: Draft) => !d.poId && !d.keterangan.trim() && totalDraft(d) === 0
function teksTotal(d: Draft) {
  const t = totalDraft(d)
  return t ? `${d.jenis === 'debet' ? '+' : '−'} ${fmtRp(t)}` : '—'
}

const ringkas = computed(() => {
  const isi = draft.value.filter(d => !kosong(d))
  let masuk = 0
  let keluar = 0
  for (const d of isi) {
    if (d.jenis === 'debet') masuk += totalDraft(d)
    else keluar += totalDraft(d)
  }
  return { n: isi.length, masuk, keluar }
})

/** Prefill the edit row from `?ubah=` once the state has landed. */
const sudahPre = ref(false)
watch([data, () => route.query.ubah], () => {
  if (sudahPre.value || !data.value) return
  const id = String(route.query.ubah ?? '')
  if (!id) {
    if (!draft.value.length) tambahBaris()
    sudahPre.value = true
    return
  }
  const t = data.value.data.trx.find(x => String(x.id) === id)
  if (!t) return
  const d = barisKosong()
  d.id = String(t.id)
  d.tgl = t.tgl
  d.keterangan = t.keterangan
  d.kategori_id = t.kategori_id ? String(t.kategori_id) : '__kosong'
  d.input = !!t.input
  d.bon = !!t.bon
  const debet = t.baris.some(b => Number(b.debet) > 0)
  d.jenis = debet ? 'debet' : 'kredit'
  for (const b of t.baris) d.nilai[String(b.pos_id)] = Number(debet ? b.debet : b.kredit) || 0
  draft.value = [d]
  sudahPre.value = true
}, { immediate: true })

// ---------------------------------------------------------------- PO panel (BD OS)

const { data: bd, status: bdStatus, error: bdError, refresh: bdRefresh } = useAsyncData('kas-kk-po', async () => {
  const [po, pr] = await Promise.all([daftarBd<BdPo>('purchase-orders'), daftarBd<BdPr>('purchase-requests')])
  return { po: po.data, pr: pr.data }
}, { immediate: !route.query.ubah })

const belumAdaRealisasi = (p: BdPo) => p.realisasi === '' || p.realisasi === null || p.realisasi === undefined
/** Why a PO is not listed yet: no PR sheet ('lembar'), or the sheet is still Draft ('draft'). */
function sebabBelum(p: BdPo): '' | 'lembar' | 'draft' {
  if (!p.prId) return 'lembar'
  const pr = bd.value?.pr.find(x => x.id === p.prId)
  if (!pr) return 'lembar'
  return String(pr.status || 'Draft') === 'Draft' ? 'draft' : ''
}
const terbuka = computed(() => (bd.value?.po ?? []).filter(p => p?.item && !p.proses && p.status !== 'Diterima' && belumAdaRealisasi(p)))
const daftarPo = computed(() => terbuka.value.filter(p => sebabBelum(p) === '').sort((a, b) => {
  const x = a.needBy || '9999'
  const y = b.needBy || '9999'
  return x !== y ? (x < y ? -1 : 1) : a.item.localeCompare(b.item)
}))
const tertahan = computed(() => {
  const t = { lembar: 0, draft: 0 }
  for (const p of terbuka.value) {
    const s = sebabBelum(p)
    if (s) t[s]++
  }
  return t
})
const dipakai = computed(() => new Set(draft.value.map(d => d.poId).filter(Boolean)))
const sisaPo = computed(() => daftarPo.value.filter(p => !dipakai.value.has(p.id)).length)

function pakaiPo(p: BdPo) {
  let d = draft.value.find(x => kosong(x))
  if (!d) {
    tambahBaris()
    d = draft.value[draft.value.length - 1]!
  }
  d.keterangan = [p.item, p.vendor].filter(Boolean).join(' — ')
  d.poId = p.id
  d.poAmount = Number(p.amount) || 0
}
function lepasPo(d: Draft) {
  d.poId = ''
  d.poAmount = 0
}

// ---------------------------------------------------------------- save

function validasi(d: Draft): string[] {
  const s: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.tgl)) s.push('Tanggal tidak sah.')
  if (!d.keterangan.trim()) s.push('Keterangan wajib diisi.')
  if (totalDraft(d) <= 0) s.push('Belum ada nominal di satu pos pun.')
  return s
}

async function simpanSemua() {
  if (!izin.ubah('kk_input') || sibuk.value) return
  const isi = draft.value.filter(d => !kosong(d))
  if (!isi.length) {
    toast.add({ title: 'Belum ada baris yang bisa disimpan — semuanya masih kosong.', color: 'error' })
    return
  }
  sibuk.value = true
  salah.value = {}
  const gagal: Draft[] = []
  const poGagal: string[] = []
  let sukses = 0
  let pertamaPesan = ''
  for (const d of isi) {
    const errs = validasi(d)
    if (errs.length) {
      salah.value = { ...salah.value, [d.key]: errs }
      gagal.push(d)
      if (!pertamaPesan) pertamaPesan = errs.join(' ')
      continue
    }
    const baris = pos.value
      .map(p => ({ pos_id: String(p.id), n: d.nilai[String(p.id)] || 0 }))
      .filter(x => x.n > 0)
      .map(x => ({ pos_id: x.pos_id, debet: d.jenis === 'debet' ? x.n : 0, kredit: d.jenis === 'kredit' ? x.n : 0 }))
    const body = { tgl: d.tgl, keterangan: d.keterangan.trim(), kategori_id: d.kategori_id === '__kosong' ? null : d.kategori_id, input: d.input, bon: d.bon, baris }
    try {
      if (d.id) {
        const { version } = await getKkTrxSatu(d.id)
        await updateKkTrx(d.id, body, version ?? '')
      }
      else {
        await createKkTrx(body)
      }
      sukses++
    }
    catch (e) {
      if (!(await tanganiKonflik(e, refresh))) {
        salah.value = { ...salah.value, [d.key]: [apiErrorMessage(e)] }
        if (!pertamaPesan) pertamaPesan = apiErrorMessage(e)
      }
      gagal.push(d)
      continue
    }
    // the trx is saved: only now mark the PO as bought (old poTulisRealisasi order)
    if (d.poId) {
      try {
        await setRealisasi(d.poId, totalDraft(d))
      }
      catch (e) {
        poGagal.push(`${d.keterangan.trim()}: ${apiErrorMessage(e)}`)
      }
    }
  }
  draft.value = gagal.length ? gagal : (sedangUbah.value ? [] : [barisKosong()])
  await Promise.all([refresh(), sedangUbah.value ? null : bdRefresh()])
  sibuk.value = false
  if (sukses && !gagal.length) toast.add({ title: `${sukses} baris tersimpan.`, color: 'success' })
  else if (sukses) toast.add({ title: `${sukses} baris tersimpan, ${gagal.length} gagal: ${pertamaPesan}`, color: 'warning' })
  else toast.add({ title: `Tidak ada yang tersimpan: ${pertamaPesan || 'periksa barisnya'}`, color: 'error' })
  if (poGagal.length) {
    toast.add({
      title: 'Transaksi tersimpan, tapi Realisasi di BD OS belum terisi.',
      description: `${poGagal.join(' · ')} — isi kolom Realisasi-nya langsung di BD OS → Purchasing.`,
      color: 'warning',
      duration: 0,
    })
  }
}
</script>

<template>
  <AppPage
    title="Input transaksi kas kecil"
    description="Satu baris = satu transaksi; tambah baris sebanyak yang perlu lalu simpan sekaligus."
  >
    <UAlert
      v-if="!izin.ubah('kk_input')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini hanya bisa dilihat."
      description="Peranmu tidak boleh mengubah transaksi Kas Kecil. Hubungi admin modul Finance kalau memang perlu."
      class="mb-4"
    />
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
      class="mb-4"
    />
    <template v-if="!pos.length && status !== 'pending'">
      <UAlert
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Belum ada pos pembayaran."
        description="Transaksi tidak punya tempat untuk dicatat. Tambahkan dulu di Pos & Kategori."
        class="mb-4"
      />
      <UButton
        label="Buka Pos & Kategori"
        size="sm"
        to="/finance/pengaturan"
      />
    </template>

    <template v-else-if="izin.ubah('kk_input')">
      <!-- Purchase Order belum diinput (BD OS) -->
      <template v-if="!sedangUbah">
        <UAlert
          v-if="bdStatus === 'pending' && !bd"
          color="info"
          variant="subtle"
          icon="i-lucide-loader"
          title="Memuat daftar Purchase Order dari BD OS…"
          class="mb-4"
        />
        <UAlert
          v-else-if="bdError"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Daftar Purchase Order tidak bisa dibaca — ${apiErrorMessage(bdError)}.`"
          description="Kas kecil tetap bisa diisi seperti biasa; yang tidak ada cuma daftar bantunya."
          :actions="[{ label: 'Coba lagi', color: 'neutral', variant: 'outline', onClick: () => bdRefresh() }]"
          class="mb-4"
        />
        <template v-else-if="bd">
          <UAlert
            v-if="!daftarPo.length && !tertahan.lembar && !tertahan.draft"
            color="success"
            variant="subtle"
            icon="i-lucide-circle-check"
            title="Semua Purchase Order dari BD OS sudah dicatat realisasinya. Tidak ada yang menunggu."
            class="mb-4"
          />
          <AppPanel
            v-else-if="daftarPo.length"
            title="Purchase Order belum diinput"
            :count="sisaPo"
            class="mb-4"
          >
            <template #description>
              Dari papan Purchasing BD OS. Tekan salah satu untuk menyalinnya jadi baris transaksi; begitu disimpan dengan nominal,
              kolom <b>Realisasi</b> di BD OS ikut terisi, kolom <b>Proses</b>-nya jadi <b>Done</b>, dan barisnya hilang dari sini.
            </template>
            <template #actions>
              <UButton
                label="Refresh"
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="outline"
                size="sm"
                :loading="bdStatus === 'pending'"
                @click="bdRefresh()"
              />
            </template>
            <div class="max-h-72 overflow-auto">
              <UTable
                :data="daftarPo"
                :columns="[
                  { accessorKey: 'item', header: 'Item' },
                  { accessorKey: 'vendor', header: 'Vendor' },
                  { accessorKey: 'div', header: 'Divisi' },
                  { accessorKey: 'needBy', header: 'Butuh' },
                  { accessorKey: 'amount', header: 'Pengajuan', meta: { class: { th: 'text-right', td: 'text-right' } } },
                  { id: 'aksi', header: '' },
                ]"
                class="hidden lg:block"
              >
                <template #item-cell="{ row }">
                  <b class="text-highlighted">{{ row.original.item }}</b>
                  <span
                    v-if="Number(row.original.qty) > 0"
                    class="text-xs text-muted"
                  > · {{ row.original.qty }} {{ row.original.unit }}</span>
                </template>
                <template #vendor-cell="{ row }">
                  <span class="text-muted">{{ row.original.vendor || '—' }}</span>
                </template>
                <template #div-cell="{ row }">
                  <span class="text-muted">{{ row.original.div || '—' }}</span>
                </template>
                <template #needBy-cell="{ row }">
                  <span class="text-muted">{{ row.original.needBy ? tglLabel(row.original.needBy) : '—' }}</span>
                </template>
                <template #amount-cell="{ row }">
                  <span class="num">{{ Number(row.original.amount) > 0 ? fmtRp(Number(row.original.amount)) : '—' }}</span>
                </template>
                <template #aksi-cell="{ row }">
                  <AppStatus
                    v-if="dipakai.has(row.original.id)"
                    color="success"
                    icon="i-lucide-check"
                    size="sm"
                  >
                    sudah di baris
                  </AppStatus>
                  <UButton
                    v-else
                    label="Input"
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    @click="pakaiPo(row.original)"
                  />
                </template>
              </UTable>
              <AppList class="lg:hidden">
                <AppListRow
                  v-for="p in daftarPo"
                  :key="p.id"
                  :title="p.item"
                  :description="[p.vendor, p.div, p.needBy ? tglLabel(p.needBy) : ''].filter(Boolean).join(' · ')"
                >
                  <template #trailing>
                    <span class="num text-sm">{{ Number(p.amount) > 0 ? fmtRp(Number(p.amount)) : '—' }}</span>
                    <UButton
                      v-if="!dipakai.has(p.id)"
                      label="Input"
                      icon="i-lucide-plus"
                      color="neutral"
                      variant="outline"
                      size="xs"
                      @click="pakaiPo(p)"
                    />
                  </template>
                </AppListRow>
              </AppList>
            </div>
          </AppPanel>
          <UAlert
            v-if="tertahan.lembar || tertahan.draft"
            color="warning"
            variant="subtle"
            icon="i-lucide-notebook-pen"
            :title="`${tertahan.lembar + tertahan.draft} item lain belum muncul di sini.`"
            class="mb-4"
          >
            <template #description>
              <span v-if="tertahan.lembar"><b>{{ tertahan.lembar }}</b> masih di kotak <b>request menunggu dijadikan lembar PR</b> — tekan <b>Buat PR</b> dulu</span><span v-if="tertahan.lembar && tertahan.draft">; </span>
              <span v-if="tertahan.draft"><b>{{ tertahan.draft }}</b> sudah punya lembar PR tapi lembarnya masih <b>Draft</b> — tekan <b>Kunci &amp; ajukan</b> di halaman dokumennya</span>.
              Semuanya di <b>BD OS → Purchasing</b>. Selama belum diajukan isinya masih bisa berubah, dan uang yang dicatat untuk baris
              yang belum disepakati akan mendahului keputusan yang belum diambil.
            </template>
          </UAlert>
        </template>
      </template>

      <!-- Transaksi baru / ubah -->
      <AppPanel
        :title="sedangUbah ? 'Ubah transaksi' : 'Transaksi baru'"
        :description="sedangUbah ? 'Menyunting satu transaksi yang sudah tersimpan' : 'Satu baris = satu transaksi. Tambah baris sebanyak yang perlu, lalu simpan sekaligus.'"
      >
        <template
          v-if="sedangUbah"
          #actions
        >
          <UButton
            label="Batal ubah"
            color="neutral"
            variant="outline"
            size="sm"
            to="/finance/kas/input"
          />
        </template>

        <!-- desktop: the old table -->
        <div class="hidden overflow-x-auto lg:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
                <th class="min-w-36 px-2 py-2.5">
                  Tanggal
                </th>
                <th class="min-w-52 px-2 py-2.5">
                  Keterangan
                </th>
                <th class="min-w-36 px-2 py-2.5">
                  Kategori
                </th>
                <th class="min-w-36 px-2 py-2.5">
                  Jenis
                </th>
                <th
                  v-for="p in pos"
                  :key="p.id"
                  class="min-w-32 px-2 py-2.5 text-right"
                >
                  {{ p.nama }}
                </th>
                <th class="min-w-28 px-2 py-2.5 text-right">
                  Total
                </th>
                <th
                  class="px-2 py-2.5 text-center"
                  title="Sudah masuk pembukuan"
                >
                  Input
                </th>
                <th
                  class="px-2 py-2.5 text-center"
                  title="Nota fisik sudah ada"
                >
                  Bon
                </th>
                <th
                  v-if="!sedangUbah"
                  class="px-2 py-2.5"
                />
              </tr>
            </thead>
            <tbody>
              <template
                v-for="(d, i) in draft"
                :key="d.key"
              >
                <tr class="border-b border-default align-top">
                  <td class="px-2 py-2">
                    <AppTanggal
                      v-model="d.tgl"
                      class="w-full"
                    />
                  </td>
                  <td class="px-2 py-2">
                    <UInput
                      v-model="d.keterangan"
                      placeholder="mis. Pembelian Mie Kwetiau 2kg"
                      class="w-full"
                    />
                    <div
                      v-if="d.poId"
                      class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted"
                    >
                      <UBadge
                        label="PO"
                        color="info"
                        variant="subtle"
                        size="sm"
                      />
                      <span>{{ d.poAmount > 0 ? `diajukan ${fmtRp(d.poAmount)}` : 'tanpa nominal pengajuan' }}</span>
                      <UButton
                        icon="i-lucide-x"
                        color="error"
                        variant="link"
                        size="xs"
                        aria-label="Lepas kaitan ke PO ini"
                        @click="lepasPo(d)"
                      />
                    </div>
                  </td>
                  <td class="px-2 py-2">
                    <USelect
                      v-model="d.kategori_id"
                      :items="opsiKategori"
                      class="w-full"
                    />
                  </td>
                  <td class="px-2 py-2">
                    <USelect
                      v-model="d.jenis"
                      :items="OPSI_JENIS"
                      class="w-full"
                    />
                  </td>
                  <td
                    v-for="p in pos"
                    :key="p.id"
                    class="px-2 py-2"
                  >
                    <RupiahInput
                      v-model="d.nilai[String(p.id)]"
                      :aria-label="p.nama"
                    />
                  </td>
                  <td
                    class="px-2 py-3 text-right font-bold num whitespace-nowrap"
                    :class="totalDraft(d) ? (d.jenis === 'debet' ? 'text-highlighted' : 'text-error') : 'text-dimmed'"
                  >
                    {{ teksTotal(d) }}
                  </td>
                  <td class="px-2 py-3 text-center">
                    <UCheckbox
                      v-model="d.input"
                      aria-label="Sudah masuk pembukuan"
                      class="justify-center"
                    />
                  </td>
                  <td class="px-2 py-3 text-center">
                    <UCheckbox
                      v-model="d.bon"
                      aria-label="Nota fisik sudah ada"
                      class="justify-center"
                    />
                  </td>
                  <td
                    v-if="!sedangUbah"
                    class="px-2 py-2 text-right"
                  >
                    <UButton
                      icon="i-lucide-x"
                      color="error"
                      variant="soft"
                      size="xs"
                      aria-label="Buang baris ini"
                      @click="buangBaris(i)"
                    />
                  </td>
                </tr>
                <tr v-if="salah[d.key]?.length">
                  <td
                    :colspan="pos.length + 8"
                    class="px-2 pb-2 text-sm text-error"
                  >
                    {{ salah[d.key]!.join(' ') }}
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- phone: one card per row -->
        <div class="space-y-3 lg:hidden">
          <div
            v-for="(d, i) in draft"
            :key="d.key"
            class="rounded-panel border border-default p-3"
          >
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Tanggal">
                <AppTanggal
                  v-model="d.tgl"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Jenis">
                <USelect
                  v-model="d.jenis"
                  :items="OPSI_JENIS"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Keterangan"
                class="col-span-2"
              >
                <UInput
                  v-model="d.keterangan"
                  placeholder="mis. Pembelian Mie Kwetiau 2kg"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Kategori"
                class="col-span-2"
              >
                <USelect
                  v-model="d.kategori_id"
                  :items="opsiKategori"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                v-for="p in pos"
                :key="p.id"
                :label="p.nama"
              >
                <RupiahInput v-model="d.nilai[String(p.id)]" />
              </UFormField>
            </div>
            <p
              v-if="d.poId"
              class="mt-2 text-xs text-muted"
            >
              PO · {{ d.poAmount > 0 ? `diajukan ${fmtRp(d.poAmount)}` : 'tanpa nominal pengajuan' }}
              <UButton
                label="Lepas"
                color="error"
                variant="link"
                size="xs"
                @click="lepasPo(d)"
              />
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <span class="text-muted">Total: <b
                class="num"
                :class="totalDraft(d) && d.jenis === 'kredit' ? 'text-error' : 'text-highlighted'"
              >{{ teksTotal(d) }}</b></span>
              <UCheckbox
                v-model="d.input"
                label="Input"
              />
              <UCheckbox
                v-model="d.bon"
                label="Bon"
              />
              <div class="flex-1" />
              <UButton
                v-if="!sedangUbah"
                label="Buang"
                color="error"
                variant="ghost"
                size="xs"
                @click="buangBaris(i)"
              />
            </div>
            <p
              v-for="s in salah[d.key] ?? []"
              :key="s"
              class="mt-1 text-sm text-error"
            >
              {{ s }}
            </p>
          </div>
        </div>

        <UButton
          v-if="!sedangUbah"
          label="Tambah baris"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          class="mt-3"
          @click="tambahBaris"
        />
        <div class="mt-3 flex items-center gap-2 rounded-field bg-primary-50 px-3 py-2.5 text-sm text-primary-700">
          <UIcon
            name="i-lucide-sigma"
            class="size-4 shrink-0"
          />
          <span><b>{{ ringkas.n }} baris</b> siap disimpan · uang masuk <b class="num">{{ fmtRp(ringkas.masuk) }}</b> · uang keluar <b class="num">{{ fmtRp(ringkas.keluar) }}</b></span>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <UButton
            :label="sedangUbah ? 'Simpan perubahan' : 'Simpan semua baris'"
            :loading="sibuk"
            @click="simpanSemua"
          />
          <UButton
            label="Ke buku kas kecil"
            color="neutral"
            variant="outline"
            to="/finance/kas"
          />
        </div>
        <div
          v-if="status === 'pending'"
          class="mt-2 space-y-2"
        >
          <!-- Loading rows mirror the input table above. -->
          <USkeleton
            v-for="i in 3"
            :key="i"
            class="h-10 w-full"
          />
          <p class="text-sm text-muted">
            Memuat…
          </p>
        </div>
      </AppPanel>
      <p class="mt-3 text-xs text-muted">
        Kolom pos diisi hanya yang dipakai — satu belanja boleh dibagi, mis. sebagian Kas Kecil sebagian PO; totalnya dijumlah otomatis
        di kolom Total. Baris yang seluruhnya kosong diabaikan saat menyimpan, jadi tidak perlu dibuang dulu.
      </p>
    </template>
  </AppPage>
</template>
