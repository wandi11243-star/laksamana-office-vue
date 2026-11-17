<!--
  BD OS › Purchasing (old `vPurchasing`, deploy/bd/index.html:3141-3952), one
  screen with three sub-tabs: PR & weekly recap, All items, Signers. A request
  and a PO are the SAME row; a PR sheet points at its items through `prId`.

  PR completion is COMPUTED (an empty sheet is never complete); the PR number is
  the highest + 1 and is never reused.
-->
<script setup lang="ts">
import type { BdApproverSet, BdPo, BdPr } from '~/composables/useBd'
import {
  bdSimpan, bdTulisDiam, buatBd, hapusBd, putSetelan, tambalBd, useBdSettings, useBdState,
  versiBaris, versiSetelan,
} from '~/composables/useBd'
import {
  PENYETUJU_BIBIT, PILIHAN_SEMUA, PO_FLOW, awalMinggu, cariAku, fieldsProses, fRp, fRpPenuh, fWaktu, geserMinggu,
  jabatanOrang, labelMinggu, poBeres, poRequester, prBeres, prItems, prNoBerikut, prTotal,
  penyetujuPr, todayISO, uidBd,
} from '~/utils/bd-rumus'
import { WARNA_PO } from '~/utils/status-bd'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdPoSheet from '~/widgets/bd/BdPoSheet.vue'
import BdPoTabel from '~/widgets/bd/BdPoTabel.vue'
import BdRequestSheet from '~/widgets/bd/BdRequestSheet.vue'
import { fTglP } from '~/utils/format'

definePageMeta({ access: ['bd'] })

const me = useMe()
const toast = useToast()
const { data: state, status } = useBdState()
const { data: setelan } = useBdSettings()

const poMode = useState('bd-po-mode', () => 'pr')
const poFilter = useState('bd-po-filter', () => PILIHAN_SEMUA)
const poMinggu = ref(0)
const prArsip = ref(false)

const people = computed(() => state.value.people)
const projects = computed(() => state.value.projects)
const aku = computed(() => cariAku(people.value, me.value))
const admin = computed(() => isAdminOf(me.value, 'bd'))
const semuaPo = computed(() => state.value.po)

// ---- summary ----
const berjalan = computed(() => semuaPo.value.filter(p => !poBeres(p)))

/** First-load skeleton for both stat grids below (summary + weekly recap):
 *  skeleton cells stand in until the first state lands. Refetch keeps old
 *  numbers, so the cards never blank. */
const statMemuat = computed(() => !state.value.po.length && (status.value === 'pending' || status.value === 'idle'))
const nilai = computed(() => berjalan.value.reduce((s, p) => s + (Number(p.amount) || 0), 0))
const perluApproval = computed(() => semuaPo.value.filter(p => !poBeres(p) && p.status === 'Diajukan').length)

const tab = [
  { value: 'pr', label: 'PR & Rekap Mingguan' },
  { value: 'daftar', label: 'Semua item' },
  { value: 'setuju', label: 'Penyetuju' },
]

// ---- sheets ----
const bukaRequest = ref(false)
const bukaPo = ref(false)
const poPilih = ref<BdPo | null>(null)
const poHapus = ref<BdPo | null>(null)
const hapusMau = computed({
  get: () => !!poHapus.value,
  set: (v) => {
    if (!v) poHapus.value = null
  },
})

function bukaPoSheet(p: BdPo) {
  poPilih.value = p
  bukaPo.value = true
}
async function hapusPo() {
  const p = poHapus.value
  if (!p) return
  poHapus.value = null
  await bdSimpan(() => hapusBd('purchase-orders', p.id, versiBaris(p)), 'PO dihapus')
}
const prHapus = ref<BdPr | null>(null)
const hapusPrMau = computed({
  get: () => !!prHapus.value,
  set: (v) => {
    if (!v) prHapus.value = null
  },
})
async function hapusPrDok() {
  const x = prHapus.value
  if (!x) return
  prHapus.value = null
  const aksi = async () => {
    for (const it of prIsi(x.id)) await tambalBd<BdPo>('purchase-orders', it.id, { prId: null }, versiBaris(it))
    await hapusBd('purchase-requests', x.id, versiBaris(x))
  }
  await bdSimpan(aksi, 'Dokumen PR dihapus, itemnya dilepas')
}
function toggleProses(p: BdPo) {
  const on = !poBeres(p)
  bdTulisDiam(() => tambalBd<BdPo>('purchase-orders', p.id, fieldsProses(p, on, aku.value?.name || ''), versiBaris(p)))
}

// ---- PR & weekly recap ----
const bebas = computed(() => state.value.po.filter(p => !p.prId))
const pilih = ref<Set<string>>(new Set())
watch(bebas, (l) => {
  const ids = new Set(l.map(p => p.id))
  const s = new Set([...pilih.value].filter(id => ids.has(id)))
  l.forEach((p) => {
    if (!pilih.value.has(p.id)) s.add(p.id)
  })
  pilih.value = s
}, { immediate: true })

const konfirmasiPr = ref(false)
const totalPilih = computed(() => bebas.value.filter(p => pilih.value.has(p.id)).reduce((s, p) => s + (Number(p.amount) || 0), 0))
function togglePilih(id: string) {
  const s = new Set(pilih.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  pilih.value = s
}
function pilihSemua() {
  pilih.value = pilih.value.size === bebas.value.length ? new Set() : new Set(bebas.value.map(p => p.id))
}

const setsEfektif = computed<BdApproverSet[]>(() => {
  const s = setelan.value?.data.approverSets || []
  if (s.length) return s
  return [{
    id: 'as-default',
    nama: 'Default',
    bawaan: true,
    orang: PENYETUJU_BIBIT
      .map(n => people.value.find(p => p.name.trim().toLowerCase() === n.toLowerCase())?.id)
      .filter((x): x is string => !!x),
  }]
})

async function buatPr() {
  const dipilih = bebas.value.filter(p => pilih.value.has(p.id))
  if (!dipilih.length) {
    toast.add({ title: 'Belum ada item yang dicentang.', color: 'error' })
    return
  }
  konfirmasiPr.value = true
}
async function konfirmasiBuatPr() {
  konfirmasiPr.value = false
  const dipilih = bebas.value.filter(p => pilih.value.has(p.id))
  if (!dipilih.length) return
  const no = prNoBerikut(state.value.pr)
  const set = setsEfektif.value.find(x => x.bawaan) || setsEfektif.value[0]
  const approvals: BdPr['approvals'] = {}
  penyetujuPr({ approvals: {}, setId: set?.id } as BdPr, [set!], people.value).forEach((s) => {
    approvals[s.pid] = { nama: s.nama, at: '', oleh: '' }
  })
  const body: Partial<BdPr> = {
    no,
    nama: aku.value?.name || '',
    dept: aku.value?.div || 'Purchasing',
    tanggal: todayISO(),
    weekStart: awalMinggu(todayISO()),
    status: 'Draft',
    total: 0,
    approvals,
    catatan: '',
    setId: set?.id,
  }
  let baruId = ''
  const aksi = async () => {
    const r = await buatBd<BdPr>('purchase-requests', body)
    baruId = r.data.id
    for (const p of dipilih) await tambalBd<BdPo>('purchase-orders', p.id, { prId: baruId }, versiBaris(p))
  }
  const ok = await bdSimpan(aksi, `PR-${no} dibuat dari ${dipilih.length} request`)
  if (ok) navigateTo(`/bd/purchasing/pr-${baruId}`)
}

const daftarPr = computed(() => state.value.pr.slice().sort((a, b) => ((b.tanggal || b.weekStart || '') < (a.tanggal || a.weekStart || '') ? -1 : 1)))
const prJalan = computed(() => daftarPr.value.filter(x => !prBeres(x.id, semuaPo.value)))
const prArsipList = computed(() => daftarPr.value.filter(x => prBeres(x.id, semuaPo.value)))
const prTampil = computed(() => (prArsip.value ? prArsipList.value : prJalan.value))
const prIsi = (id: string) => prItems(id, semuaPo.value)

const senin = computed(() => geserMinggu(awalMinggu(todayISO()), poMinggu.value))
const akhir = computed(() => geserMinggu(senin.value, 1))
const minggu = computed(() => semuaPo.value.filter(p => p.needBy && p.needBy >= senin.value && p.needBy < akhir.value))
const mingguPerStatus = computed(() => {
  const out: Record<string, number> = {}
  PO_FLOW.forEach((s) => {
    out[s] = 0
  })
  minggu.value.forEach((p) => {
    out[p.status] = (out[p.status] || 0) + 1
  })
  return out
})
const mingguNilai = computed(() => minggu.value.reduce((s, p) => s + (Number(p.amount) || 0), 0))
const mingguBelum = computed(() => minggu.value.filter(p => !(Number(p.amount)) && (p.status === 'Draft' || p.status === 'Diajukan')).length)
const enamMinggu = computed(() => {
  const out: { senin: string, label: string, n: number, nilai: number, approval: number, ini: boolean }[] = []
  for (let i = -1; i < 5; i++) {
    const s0 = geserMinggu(awalMinggu(todayISO()), i)
    const s1 = geserMinggu(s0, 1)
    const g = semuaPo.value.filter(p => p.needBy && p.needBy >= s0 && p.needBy < s1)
    out.push({
      senin: s0,
      label: labelMinggu(s0),
      n: g.length,
      nilai: g.reduce((s, p) => s + (Number(p.amount) || 0), 0),
      approval: g.filter(p => p.status === 'Diajukan').length,
      ini: i === 0,
    })
  }
  return out
})

const daftarFilter = computed(() => (poFilter.value === PILIHAN_SEMUA ? semuaPo.value : semuaPo.value.filter(p => p.status === poFilter.value)))
const opsiStatus = [{ value: PILIHAN_SEMUA, label: 'Semua status' }, ...PO_FLOW.map(s => ({ value: s, label: s }))]

// ---- signers ----
async function simpanSet(daftar: BdApproverSet[], pesan: string) {
  const ok = await bdSimpan(() => putSetelan('approverSets', daftar, versiSetelan(setelan.value, 'approverSets')), pesan)
  return ok
}
const tambahSet = () => simpanSet([...setsEfektif.value, { id: uidBd('as'), nama: 'Set baru', bawaan: false, orang: [] }], 'Set penyetuju ditambahkan')
const jadikanBawaan = (id: string) => simpanSet(setsEfektif.value.map(s => ({ ...s, bawaan: s.id === id })), 'Set bawaan diperbarui')
const hapusSet = (id: string) => simpanSet(setsEfektif.value.filter(s => s.id !== id), 'Set dihapus')
function setNamaSet(id: string, nama: string) {
  simpanSet(setsEfektif.value.map(s => (s.id === id ? { ...s, nama } : s)), 'Nama set diperbarui')
}
function tambahKeSet(id: string, pid: string) {
  if (!pid) return
  simpanSet(setsEfektif.value.map(s => (s.id === id ? { ...s, orang: [...(s.orang || []), pid] } : s)), 'Penanda tangan ditambahkan')
}
function hapusDariSet(id: string, pid: string) {
  simpanSet(setsEfektif.value.map(s => (s.id === id ? { ...s, orang: (s.orang || []).filter(x => x !== pid) } : s)), 'Penanda tangan dikeluarkan')
}
const orangOpsi = computed(() => people.value.filter(p => p.active !== false).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))))
const pilihTambah = reactive<Record<string, string>>({})

function prTtd(x: BdPr): { l: string, ok: boolean }[] {
  return penyetujuPr(x, setsEfektif.value, people.value).map(s => ({ l: s.l, ok: (x.approvals?.[s.k] || {}).at ? true : false }))
}
/** Signer columns of the sheet table: every signer label of the listed sheets, first-seen order. */
const kolomTtd = computed(() => [...new Set(prTampil.value.flatMap(x => prTtd(x).map(t => t.l)))])
</script>

<template>
  <AppPage
    title="Purchasing"
    description="Purchase request mingguan, vendor & status pembelian."
  >
    <!-- Old layout: the view tabs sit next to "Request Order" in the header. -->
    <template #actions>
      <AppSeg
        v-model="poMode"
        :options="tab"
        size="sm"
      />
      <UButton
        label="Request Order"
        icon="i-lucide-plus"
        @click="bukaRequest = true"
      />
    </template>

    <AppStatGrid
      :loading="statMemuat"
      :count="3"
    >
      <AppStat
        label="Total PO"
        icon="i-lucide-shopping-cart"
        :value="semuaPo.length"
        :sub="`${semuaPo.filter(poBeres).length} sudah selesai`"
      />
      <AppStat
        label="Perlu approval"
        icon="i-lucide-hourglass"
        :tone="perluApproval ? 'warning' : 'success'"
        :value="perluApproval"
        sub="status Diajukan"
      />
      <AppStat
        label="Nilai berjalan"
        icon="i-lucide-wallet"
        :value="fRpPenuh(nilai)"
        sub="belum selesai"
      />
    </AppStatGrid>

    <!-- ── PR & Rekap Mingguan ── -->
    <template v-if="poMode === 'pr'">
      <AppPanel
        :title="bebas.length ? `${bebas.length} request menunggu dijadikan lembar PR` : 'Request order'"
        icon="i-lucide-inbox"
        flush
      >
        <template #actions>
          <UButton
            :label="`Buat PR dari ${bebas.filter(p => pilih.has(p.id)).length} item`"
            icon="i-lucide-plus"
            size="sm"
            :disabled="!bebas.filter(p => pilih.has(p.id)).length"
            @click="buatPr"
          />
        </template>

        <p
          v-if="!bebas.length"
          class="px-4 py-8 text-center text-sm text-muted"
        >
          <UIcon
            name="i-lucide-check-circle-2"
            class="mx-auto mb-1 block size-6 text-success"
          />
          Semua request sudah masuk dokumen PR.
        </p>
        <div
          v-else
          class="overflow-x-auto"
        >
          <table class="w-full text-sm">
            <thead class="bg-muted text-muted">
              <tr class="text-[11px] font-semibold uppercase tracking-wide">
                <th class="w-10 py-3 ps-4 pe-2">
                  <UCheckbox
                    :model-value="pilih.size === bebas.length ? true : pilih.size ? 'indeterminate' : false"
                    aria-label="Pilih semua"
                    @update:model-value="pilihSemua"
                  />
                </th>
                <th class="px-3 py-3 text-start">
                  Nama item
                </th>
                <th class="px-3 py-3 text-end">
                  Jumlah
                </th>
                <th class="px-3 py-3 text-start">
                  Satuan
                </th>
                <th class="px-3 py-3 text-start">
                  Alasan / kebutuhan
                </th>
                <th class="px-3 py-3 text-start">
                  Peminta
                </th>
                <th class="px-3 py-3 text-end">
                  Harga
                </th>
                <th class="px-3 py-3 text-start">
                  Butuh
                </th>
                <th class="px-3 py-3 text-start">
                  Diinput
                </th>
                <th class="py-3 pe-4" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="p in bebas"
                :key="p.id"
                class="transition-colors hover:bg-muted/70"
                :class="pilih.has(p.id) ? 'bg-gold-soft/30' : ''"
              >
                <td class="py-3.5 ps-4 pe-2">
                  <UCheckbox
                    :model-value="pilih.has(p.id)"
                    :aria-label="`Pilih ${p.item}`"
                    @update:model-value="togglePilih(p.id)"
                  />
                </td>
                <td
                  class="cursor-pointer px-3 py-3.5"
                  @click="bukaPoSheet(p)"
                >
                  <span class="font-semibold text-highlighted hover:text-gold-deep">{{ p.item }}</span>
                  <span
                    v-if="p.sumber"
                    class="ms-1 text-xs text-muted"
                  >(dari {{ p.sumber }})</span>
                </td>
                <td class="px-3 py-3.5 text-end num font-semibold">
                  {{ Number(p.qty) || 0 }}
                </td>
                <td class="px-3 py-3.5 text-muted">
                  {{ p.unit || '—' }}
                </td>
                <td class="max-w-[280px] px-3 py-3.5 text-muted">
                  {{ p.note || '—' }}
                </td>
                <td class="px-3 py-3.5 text-muted">
                  {{ poRequester(p, people) }}
                </td>
                <td class="px-3 py-3.5 text-end whitespace-nowrap">
                  <span
                    v-if="Number(p.amount)"
                    class="font-semibold text-highlighted num"
                  >{{ fRpPenuh(p.amount) }}</span>
                  <AppStatus
                    v-else
                    color="warning"
                    size="sm"
                  >
                    belum diisi
                  </AppStatus>
                </td>
                <td class="px-3 py-3.5 whitespace-nowrap text-muted">
                  {{ p.needBy ? fTglP(p.needBy) : '—' }}
                </td>
                <td class="px-3 py-3.5 whitespace-nowrap text-muted">
                  {{ fWaktu(p.at) }}
                </td>
                <td class="py-3.5 pe-4">
                  <div class="flex justify-end gap-1">
                    <UButton
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Ubah"
                      @click="bukaPoSheet(p)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Hapus"
                      @click="poHapus = p"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppPanel>

      <!-- Old layout: Berjalan / Arsip tabs above the sheet table, the archive rule on the right. -->
      <div class="mb-3 mt-6 flex flex-wrap items-center justify-between gap-3">
        <AppSeg
          :model-value="prArsip ? 'arsip' : 'berjalan'"
          :options="[{ value: 'berjalan', label: `Berjalan (${prJalan.length})` }, { value: 'arsip', label: `Arsip (${prArsipList.length})` }]"
          size="sm"
          @update:model-value="(v: 'berjalan' | 'arsip' | undefined) => { prArsip = v === 'arsip' }"
        />
        <span class="text-xs text-muted">Lembar pindah ke arsip sendiri begitu seluruh itemnya diproses.</span>
      </div>
      <AppPanel
        flush
      >
        <p
          v-if="!prTampil.length"
          class="px-4 py-8 text-center text-sm text-muted"
        >
          {{ prArsip ? 'Arsip masih kosong.' : 'Tidak ada lembar PR yang berjalan — semua sudah selesai diproses.' }}
        </p>
        <div
          v-else
          class="overflow-x-auto"
        >
          <table class="w-full text-sm">
            <thead class="bg-muted text-muted">
              <tr class="text-[11px] font-semibold uppercase tracking-wide">
                <th class="py-3 ps-4 pe-3 text-start whitespace-nowrap">
                  PR no
                </th>
                <th class="px-3 py-3 text-start">
                  Tanggal
                </th>
                <th class="px-3 py-3 text-start">
                  Periode
                </th>
                <th class="px-3 py-3 text-start">
                  Penyusun
                </th>
                <th class="px-3 py-3 text-start">
                  Dept
                </th>
                <th class="px-3 py-3 text-start">
                  Isi lembar
                </th>
                <th class="px-3 py-3 text-end">
                  Item
                </th>
                <th class="px-3 py-3 text-start">
                  Diproses
                </th>
                <th class="px-3 py-3 text-end whitespace-nowrap">
                  Grand total
                </th>
                <!-- One column per signer (old layout), in the order the sets list them. -->
                <th
                  v-for="k in kolomTtd"
                  :key="k"
                  class="px-3 py-3 text-start"
                >
                  {{ k }}
                </th>
                <th class="px-3 py-3 text-start">
                  Status
                </th>
                <th class="py-3 pe-4">
                  <span class="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="x in prTampil"
                :key="x.id"
                class="cursor-pointer transition-colors hover:bg-muted/70"
                @click="navigateTo(`/bd/purchasing/pr-${x.id}`)"
              >
                <td class="py-3.5 ps-4 pe-3 font-semibold whitespace-nowrap text-highlighted">
                  PR-{{ x.no || '?' }}
                </td>
                <td class="px-3 py-3.5 whitespace-nowrap text-muted">
                  {{ fTglP(x.tanggal) }}
                </td>
                <td class="px-3 py-3.5 whitespace-nowrap text-muted">
                  {{ labelMinggu(x.weekStart || x.tanggal) }}
                </td>
                <td class="px-3 py-3.5 text-default">
                  {{ x.nama || '—' }}
                </td>
                <td class="px-3 py-3.5">
                  <AppStatus
                    size="sm"
                    color="gold"
                  >
                    {{ String(x.dept || '—').split(' ')[0] }}
                  </AppStatus>
                </td>
                <td class="max-w-[260px] px-3 py-3.5 text-xs leading-relaxed text-muted">
                  {{ prIsi(x.id).slice(0, 5).map(p => p.item).join(', ') || 'belum ada item' }}<template v-if="prIsi(x.id).length > 5">
                    <b> +{{ prIsi(x.id).length - 5 }} lagi</b>
                  </template>
                </td>
                <td class="px-3 py-3.5 text-end num">
                  {{ prIsi(x.id).length }}
                  <div v-if="prTotal(x.id, semuaPo).belum">
                    <AppStatus
                      size="sm"
                      color="warning"
                    >
                      {{ prTotal(x.id, semuaPo).belum }} tanpa harga
                    </AppStatus>
                  </div>
                </td>
                <td class="px-3 py-3.5">
                  <AppStatus
                    size="sm"
                    :color="prIsi(x.id).length && prIsi(x.id).filter(poBeres).length === prIsi(x.id).length ? 'success' : 'neutral'"
                  >
                    {{ prIsi(x.id).filter(poBeres).length }} / {{ prIsi(x.id).length }}
                  </AppStatus>
                </td>
                <td class="px-3 py-3.5 text-end whitespace-nowrap font-semibold text-highlighted num">
                  {{ fRpPenuh(prTotal(x.id, semuaPo).grand) }}
                </td>
                <td
                  v-for="k in kolomTtd"
                  :key="k"
                  class="px-3 py-3.5"
                >
                  <template v-if="prTtd(x).find(t => t.l === k)">
                    <AppStatus
                      :color="prTtd(x).find(t => t.l === k)!.ok ? 'success' : 'neutral'"
                      :icon="prTtd(x).find(t => t.l === k)!.ok ? 'i-lucide-check' : undefined"
                      size="sm"
                    >
                      {{ prTtd(x).find(t => t.l === k)!.ok ? 'Sudah' : 'Belum' }}
                    </AppStatus>
                  </template>
                  <span
                    v-else
                    class="text-dimmed"
                  >—</span>
                </td>
                <td class="px-3 py-3.5">
                  <AppStatus
                    :color="x.status === 'Selesai' ? 'success' : x.status === 'Disetujui' ? 'info' : x.status === 'Diajukan' ? 'warning' : 'neutral'"
                    size="sm"
                  >
                    {{ x.status || 'Draft' }}
                  </AppStatus>
                </td>
                <td class="py-3.5 pe-4 text-end">
                  <UButton
                    icon="i-lucide-trash-2"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    aria-label="Hapus dokumen PR"
                    @click.stop="prHapus = x"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppPanel>

      <AppPanel
        title="Rekap kebutuhan mingguan"
        icon="i-lucide-calendar-range"
        description="Dikelompokkan menurut tanggal dibutuhkan."
      >
        <template #actions>
          <div class="inline-flex items-center overflow-hidden rounded-full border border-default">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Minggu sebelumnya"
              @click="poMinggu--"
            />
            <span class="px-2 text-sm font-semibold text-highlighted">{{ labelMinggu(senin) }}</span>
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Minggu berikutnya"
              @click="poMinggu++"
            />
          </div>
          <UButton
            v-if="poMinggu"
            label="Minggu ini"
            color="neutral"
            variant="outline"
            size="sm"
            @click="poMinggu = 0"
          />
        </template>

        <AppStatGrid
          :loading="statMemuat"
          :count="4"
        >
          <AppStat
            label="PO minggu ini"
            icon="i-lucide-shopping-cart"
            :value="minggu.length"
            :sub="minggu.length ? `butuh antara ${labelMinggu(senin)}` : 'tidak ada kebutuhan'"
          />
          <AppStat
            label="Nilai"
            icon="i-lucide-wallet"
            :tone="mingguBelum ? 'warning' : 'success'"
            :value="fRp(mingguNilai)"
            :sub="mingguBelum ? `${mingguBelum} item belum dihitung` : 'seluruhnya sudah dihitung'"
          />
          <AppStat
            label="Perlu approval"
            icon="i-lucide-hourglass"
            :tone="mingguPerStatus.Diajukan ? 'warning' : 'success'"
            :value="mingguPerStatus.Diajukan || 0"
            sub="menunggu diproses"
          />
          <AppStat
            label="Sudah diterima"
            icon="i-lucide-package-check"
            :tone="minggu.length && mingguPerStatus.Diterima === minggu.length ? 'success' : 'gold'"
            :value="mingguPerStatus.Diterima || 0"
            :sub="`dari ${minggu.length} PO`"
          />
        </AppStatGrid>

        <div class="mb-3 flex flex-wrap gap-1.5">
          <AppStatus
            v-for="s in PO_FLOW"
            :key="s"
            :color="WARNA_PO[s] || 'neutral'"
            size="sm"
          >
            {{ s }}: {{ mingguPerStatus[s] || 0 }}
          </AppStatus>
        </div>

        <BdPoTabel
          :list="[...minggu].sort((a, b) => (a.needBy < b.needBy ? -1 : 1))"
          :people="people"
          :projects="projects"
          @buka="bukaPoSheet"
          @hapus="p => poHapus = p"
          @proses="toggleProses"
        />

        <div class="mt-4 border-t border-default pt-4">
          <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            Enam minggu terdekat
          </p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted text-muted">
                <tr>
                  <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                    Minggu
                  </th>
                  <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                    PO
                  </th>
                  <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                    Nilai
                  </th>
                  <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
                    Perlu approval
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="g in enamMinggu"
                  :key="g.senin"
                  class="cursor-pointer hover:bg-elevated/50"
                  :class="g.ini ? 'bg-yellow-light' : ''"
                  @click="poMinggu = enamMinggu.indexOf(g) - 1"
                >
                  <td class="px-3 py-2 font-semibold text-highlighted">
                    {{ g.label }}
                  </td>
                  <td class="px-3 py-2 num">
                    {{ g.n }}
                  </td>
                  <td class="px-3 py-2 num">
                    {{ fRp(g.nilai) }}
                  </td>
                  <td class="px-3 py-2 num">
                    {{ g.approval || '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </AppPanel>
    </template>

    <!-- ── Semua Item ── -->
    <template v-else-if="poMode === 'daftar'">
      <AppPanel>
        <AppFilterGrid>
          <UFormField label="Status">
            <USelect
              v-model="poFilter"
              :items="opsiStatus"
              class="w-full"
            />
          </UFormField>
        </AppFilterGrid>
      </AppPanel>
      <AppPanel
        title="Semua item"
        icon="i-lucide-list"
        :count="daftarFilter.length"
      >
        <BdPoTabel
          :list="daftarFilter"
          :people="people"
          :projects="projects"
          @buka="bukaPoSheet"
          @hapus="p => poHapus = p"
          @proses="toggleProses"
        />
      </AppPanel>
    </template>

    <!-- ── Penyetuju ── -->
    <template v-else>
      <AppPanel
        title="Susunan penanda tangan PR"
        icon="i-lucide-pen-tool"
        :count="setsEfektif.length"
      >
        <template #actions>
          <UButton
            v-if="admin"
            label="Set penyetuju baru"
            icon="i-lucide-plus"
            size="sm"
            @click="tambahSet"
          />
        </template>

        <p class="mb-4 text-sm text-muted">
          Tiap lembar PR memakai salah satu set di bawah. Buat set terpisah kalau penanda tangannya berbeda —
          mis. PR Marketing dan PR Business Development. Set bertanda <b>bawaan</b> dipakai untuk PR baru.
          <b>Jabatan diambil dari Tim/Keterangan di User Database Office</b>, tidak diketik di sini.
        </p>
        <p
          v-if="!admin"
          class="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm"
        >
          Hanya admin BD yang bisa mengubah susunan ini.
        </p>

        <div
          v-for="st in setsEfektif"
          :key="st.id"
          class="mb-3 rounded-field border bg-muted border-default p-3"
        >
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <UInput
              :model-value="st.nama"
              :disabled="!admin"
              class="min-w-44"
              @change="(e: Event) => admin && setNamaSet(st.id, (e.target as HTMLInputElement).value)"
            />
            <AppStatus
              v-if="st.bawaan"
              color="gold"
              size="sm"
            >
              bawaan
            </AppStatus>
            <UButton
              v-else-if="admin"
              label="Jadikan bawaan"
              color="neutral"
              variant="outline"
              size="sm"
              @click="jadikanBawaan(st.id)"
            />
            <div class="flex-1" />
            <UButton
              v-if="admin && setsEfektif.length > 1 && !st.bawaan"
              label="Hapus set"
              icon="i-lucide-trash-2"
              color="error"
              variant="soft"
              size="sm"
              @click="hapusSet(st.id)"
            />
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted text-muted">
                <tr>
                  <th class="px-3 py-1.5 text-start text-[11px] uppercase tracking-wide">
                    #
                  </th>
                  <th class="px-3 py-1.5 text-start text-[11px] uppercase tracking-wide">
                    Nama
                  </th>
                  <th class="px-3 py-1.5 text-start text-[11px] uppercase tracking-wide">
                    Jabatan (dari Office)
                  </th>
                  <th class="px-3 py-1.5" />
                </tr>
              </thead>
              <tbody class="divide-y divide-default">
                <tr
                  v-for="(pid, i) in st.orang || []"
                  :key="pid || i"
                >
                  <td class="px-3 py-1.5 text-muted">
                    {{ i + 1 }}
                  </td>
                  <td class="px-3 py-1.5 font-semibold text-highlighted">
                    {{ pid ? people.find(p => p.id === pid)?.name || 'Orang ini sudah tidak ada di daftar kru' : '—' }}
                  </td>
                  <td class="px-3 py-1.5">
                    <span
                      v-if="pid && people.find(p => p.id === pid)"
                      class="text-muted"
                    >{{ jabatanOrang(people.find(p => p.id === pid)) }}</span>
                    <span
                      v-else
                      class="text-dimmed"
                    >belum diisi di Office</span>
                  </td>
                  <td class="px-3 py-1.5">
                    <UButton
                      v-if="admin && pid"
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      aria-label="Keluarkan"
                      @click="hapusDariSet(st.id, pid)"
                    />
                  </td>
                </tr>
                <tr v-if="!(st.orang || []).length">
                  <td
                    colspan="4"
                    class="px-3 py-4 text-center text-muted"
                  >
                    Belum ada penanda tangan
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="admin"
            class="mt-3 flex flex-wrap items-center gap-2"
          >
            <USelect
              v-model="pilihTambah[st.id]"
              :items="orangOpsi.map(p => ({ value: p.id, label: p.name + (jabatanOrang(p) !== '—' ? ` — ${jabatanOrang(p)}` : '') }))"
              placeholder="Pilih orang…"
              class="min-w-52"
            />
            <UButton
              label="Tambah penanda tangan"
              icon="i-lucide-plus"
              color="neutral"
              variant="outline"
              size="sm"
              @click="tambahKeSet(st.id, pilihTambah[st.id] || '')"
            />
          </div>
        </div>
      </AppPanel>
    </template>

    <BdRequestSheet
      v-model:open="bukaRequest"
      :projects="projects"
      :people="people"
      :aku="aku"
    />
    <BdPoSheet
      v-model:open="bukaPo"
      :po="poPilih"
      :projects="projects"
      :people="people"
      :aku="aku"
    />
    <BdKonfirmasi
      v-model:open="hapusMau"
      title="Hapus purchase order ini?"
      @konfirmasi="hapusPo"
    />
    <BdKonfirmasi
      v-model:open="hapusPrMau"
      title="Hapus dokumen PR ini?"
      :description="prHapus ? `${prIsi(prHapus.id).length} item di dalamnya TIDAK ikut terhapus — mereka kembali jadi request bebas dan bisa dimasukkan ke PR lain.` : undefined"
      @konfirmasi="hapusPrDok"
    />
    <BdKonfirmasi
      v-model:open="konfirmasiPr"
      title="Buat lembar PR?"
      :description="`Berisi ${bebas.filter(p => pilih.has(p.id)).length} item · grand total ${fRpPenuh(totalPilih)}. Lembar dibuat sebagai Draft sampai kamu menekan &quot;Kunci & ajukan&quot;.`"
      confirm-label="Buat PR"
      color="primary"
      @konfirmasi="konfirmasiBuatPr"
    />
  </AppPage>
</template>
