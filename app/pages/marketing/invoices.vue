<!--
  Marketing › Invoice & Payment (docs/migrasi/marketing.md D.9, issue #60):
  payment status per closing event (Confirmed/Deal/Event Done only — F.16),
  Piutang vs Potensi, and official invoice requests to Finance
  (POST /finance/invoices/requests, idempotent per resId `mkt:<id>:dp|lunas`).
  Recording a payment happens on the event's Finance tab; rows link there.
-->
<script setup lang="ts">
import type { EventMkt, KolomMkt } from '~/utils/marketing'
import type { StatusInvMkt, TabBayarMkt } from '~/utils/marketing-keuangan'
import {
  kelompokBayarMkt, layakTagihMkt, noResmiInvMkt, praPelunasanMkt, punyaDpMkt,
  punyaPelunasanMkt, rekapInvoiceMkt, resIdInvMkt, ringkasInvMkt,
} from '~/utils/marketing-keuangan'
import { dpLabel, eventFinance, invStatus } from '~/utils/marketing-uang'
import { ikonInvoiceMkt, warnaInvoiceMkt } from '~/utils/status-marketing'
import {
  berkasKwitansi, mintaKwitansi, statusKwitansi, updateInvoiceText, type BerkasKwitansi, type UbahInvoice,
} from '~/composables/useFinance'
import { adaBuktiSheet, invoiceHtml, type InvoiceSheetData } from '~/utils/invoice-sheet'
import {
  logMkt, useAksesMkt, useStateMkt, useTabelMkt,
} from '~/composables/useMarketing'
import { hariIni, rupiah } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const router = useRouter()
const toast = useToast()
const { data: st, status } = useStateMkt()
const { can, saya } = useAksesMkt()
const hari = hariIni()

const layak = computed(() => layakTagihMkt(st.value.events))
const uang = (e: EventMkt) => eventFinance(e, st.value.settings)
const inv = (e: EventMkt) => invStatus(e, st.value.settings, hari)
/** A Draft invoice is not billable yet: hidden from the list like the old
 *  screen, with an honest note instead of silent absence. */
const tampil = computed(() => layak.value.filter(e => inv(e) !== 'Draft'))
const nDraft = computed(() => layak.value.filter(e => inv(e) === 'Draft'))
const rekap = computed(() => rekapInvoiceMkt(tampil.value.map((e) => {
  const f = uang(e)
  return { inv: inv(e), remaining: f.remaining, paid: f.paid }
}), nDraft.value.length))
const namaClient = (id: string) => st.value.clients.find(c => c.id === id)?.nama ?? '—'
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? '—'

// ---- tabs ----
const tab = useState<TabBayarMkt>('mkt-inv-tab', () => 'semua')
const jumlahTab = computed(() => {
  const jumlah = { semua: tampil.value.length, lunas: 0, dp: 0, belum: 0 }
  for (const e of tampil.value) {
    const ringkas = { inv: inv(e), remaining: uang(e).remaining, paid: uang(e).paid }
    for (const kelompok of ['lunas', 'dp', 'belum'] as const) {
      if (kelompokBayarMkt(kelompok, ringkas)) jumlah[kelompok]++
    }
  }
  return jumlah
})
const opsiTab = computed(() => [
  { value: 'semua' as const, label: `Semua (${jumlahTab.value.semua})` },
  { value: 'lunas' as const, label: `Lunas (${jumlahTab.value.lunas})` },
  { value: 'dp' as const, label: `Sudah DP (${jumlahTab.value.dp})` },
  { value: 'belum' as const, label: `Belum Payment (${jumlahTab.value.belum})` },
])
const daftar = computed(() => tampil.value.filter(e => kelompokBayarMkt(tab.value, { inv: inv(e), remaining: uang(e).remaining, paid: uang(e).paid })))
// First-load skeleton for the stat cards: while no billable invoice is in,
// the grid shows placeholders; later refetches keep the old cards on screen.
const statMemuat = computed(() => !tampil.value.length && (status.value === 'pending' || status.value === 'idle'))
const kosongTab = computed(() => tab.value === 'lunas'
  ? 'Belum ada tagihan yang tertutup penuh.'
  : tab.value === 'dp'
    ? 'Belum ada tagihan yang sudah menerima sebagian pembayaran.'
    : 'Semua tagihan sudah menerima pembayaran — tidak ada yang kosong.')

// ---- official-invoice statuses (muatInvMkt: one request for the whole list) ----
const peta = ref<Record<string, StatusInvMkt>>({})
const versiPeta = ref<Record<string, string>>({})
const memuat = ref(false)
const galat = ref('')
async function muat() {
  const ids: string[] = []
  for (const e of tampil.value) {
    for (const j of ['dp', 'lunas'] as const) {
      const rid = resIdInvMkt(e.id, j)
      if (peta.value[rid] === undefined) ids.push(rid)
    }
  }
  if (!ids.length) return
  memuat.value = true
  galat.value = ''
  try {
    const r = await statusKwitansi(ids)
    for (const [k, v] of Object.entries(r.data ?? {})) peta.value[k] = v
    Object.assign(versiPeta.value, r.meta?.versions ?? {})
    // No answer for an id = no request yet (null), not "still unknown" (undefined).
    for (const k of ids) if (peta.value[k] === undefined) peta.value[k] = null as unknown as StatusInvMkt
  }
  catch (e) {
    galat.value = apiErrorMessage(e)
  }
  finally {
    memuat.value = false
  }
}
watch(layak, () => void muat(), { immediate: true })
const bolehMinta = computed(() => ['marketing', 'finance', 'manager', 'super_admin'].includes(saya.value?.user.role ?? ''))
const slotSiap = (e: EventMkt, j: 'dp' | 'lunas') => (j === 'dp' ? punyaDpMkt(uang(e)) : punyaPelunasanMkt(e, uang(e)))
const JENIS_RESMI = [{ k: 'dp', l: 'DP', t: 'INV_DP' }, { k: 'lunas', l: 'Pelunasan', t: 'INV_LUNAS' }] as const

// ---- request ----
const minta = ref<{ e: EventMkt, jenis: 'INV_DP' | 'INV_LUNAS' } | null>(null)
const mintaBuka = computed({ get: () => !!minta.value, set: (v) => {
  if (!v) minta.value = null
} })
const mintaInfo = computed(() => {
  const m = minta.value
  if (!m) return null
  const f = uang(m.e)
  const pra = praPelunasanMkt(m.e, f)
  const tanpaBukti = (m.e.payments ?? []).filter(p => !p.receiptUrl).length
  return {
    rincian: m.jenis === 'INV_LUNAS'
      ? `Grand Total: ${rupiah(f.grand)}\nDikurangi DP & pembayaran awal: ${rupiah(pra.praBayar)}\nSisa yang ditagih di lembar ini: ${rupiah(pra.tagih)}`
      : `Grand Total: ${rupiah(f.grand)}\nDP yang ditagih: ${rupiah(f.dp)}\nSudah masuk: ${rupiah(f.paid)}`,
    tanpaBukti,
  }
})
const mintaSibuk = ref(false)
async function kirimMinta() {
  const m = minta.value
  if (!m) return
  if (!bolehMinta.value) {
    toast.add({ title: 'Akses ditolak', description: 'Kamu tidak punya izin meminta invoice resmi.', color: 'error' })
    return
  }
  mintaSibuk.value = true
  try {
    const f = uang(m.e)
    const pra = praPelunasanMkt(m.e, f)
    const c = st.value.clients.find(x => x.id === m.e.clientId)
    const r = await mintaKwitansi({
      resId: resIdInvMkt(m.e.id, m.jenis === 'INV_LUNAS' ? 'lunas' : 'dp'),
      jenis: m.jenis,
      ringkas: ringkasInvMkt(m.e, m.jenis, f, pra, c?.nama ?? '', c?.perusahaan ?? '', c?.pic ?? '', namaUser(m.e.mktPIC)),
    })
    if (r.data) peta.value[resIdInvMkt(m.e.id, m.jenis === 'INV_LUNAS' ? 'lunas' : 'dp')] = r.data
    await logDenganCobaLagi(() => logMkt('event', m.e.id, `Request invoice ${m.jenis === 'INV_LUNAS' ? 'pelunasan' : 'DP'}`, `${c?.nama ?? ''} · ${rupiah(m.jenis === 'INV_LUNAS' ? pra.tagih : f.dp)}`))
    toast.add({ title: r.data?.status === 'DIBUAT' ? 'Invoice resmi sudah terbit' : 'Permintaan invoice terkirim ke Finance', color: 'success' })
    minta.value = null
  }
  catch (e) {
    toast.add({ title: 'Gagal mengirim permintaan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mintaSibuk.value = false
  }
}

// ---- official PDF ----
const pdf = ref<{ e: EventMkt, jenis: 'INV_DP' | 'INV_LUNAS', berkas: BerkasKwitansi } | null>(null)
const pdfBuka = computed({
  get: () => !!pdf.value,
  set: (v) => {
    if (!v) {
      pdf.value = null
      ubahMode.value = false
    }
  },
})
async function bukaPdf(e: EventMkt, jenis: 'INV_DP' | 'INV_LUNAS') {
  try {
    const r = await berkasKwitansi(resIdInvMkt(e.id, jenis === 'INV_LUNAS' ? 'lunas' : 'dp'))
    if (!r.data) throw new Error('not_issued')
    pdf.value = { e, jenis, berkas: r.data }
  }
  catch (e2) {
    toast.add({ title: 'Belum terbit', description: apiErrorMessage(e2), color: 'error' })
  }
}

/** The issued sheet, drawn from the LIVE event + Finance's number, signatures, stamp and text edits. */
const lembar = computed<InvoiceSheetData | null>(() => {
  const p = pdf.value
  if (!p) return null
  const f = uang(p.e)
  const pra = praPelunasanMkt(p.e, f)
  const lunas = p.jenis === 'INV_LUNAS'
  const c = st.value.clients.find(x => x.id === p.e.clientId)
  const bawaanKepada = String(c?.perusahaan || c?.nama || '')
  const bawaanUp = String(c?.pic || c?.nama || '')
  const u = (p.berkas.ubah ?? {}) as UbahInvoice
  const totals: { label: string, nilai: number, tebal?: boolean }[] = [
    { label: 'Subtotal', nilai: f.sub },
  ]
  if (f.disc) totals.push({ label: 'Diskon', nilai: -f.disc })
  if (f.svcOn && f.service) totals.push({ label: 'Service charge', nilai: f.service })
  if (f.tax) totals.push({ label: `PB1 ${f.taxPct}%${f.taxInc ? ' (termasuk harga)' : ''}`, nilai: f.tax })
  totals.push({ label: 'Grand Total', nilai: f.grand, tebal: true })
  if (lunas) {
    for (const pay of (p.e.payments ?? []).filter(x => String(x.type ?? '') === 'DP')) {
      totals.push({ label: `Dikurangi pembayaran ${pay.type}${pay.at ? ` · ${pay.at}` : ''}`, nilai: -(+(pay.amount ?? 0) || 0) })
    }
    if (pra.dpCentang > 0) totals.push({ label: 'Dikurangi DP yang sudah diterima', nilai: -pra.dpCentang })
    if (pra.lain > 0) totals.push({ label: 'Dikurangi pembayaran lain yang sudah diterima', nilai: -pra.lain })
    totals.push({ label: 'SISA PEMBAYARAN', nilai: pra.tagih, tebal: true })
  }
  else {
    totals.push({ label: `${dpLabel(f)} yang ditagih`, nilai: f.dp, tebal: true })
    if (f.paid > 0) totals.push({ label: 'Sudah diterima', nilai: f.paid })
  }
  const d = (p.e.detail ?? {}) as Record<string, unknown>
  const items = ((Array.isArray(d.rincianItem) ? d.rincianItem : []) as Record<string, unknown>[])
    .filter(r => String(r.jenis || 'bayar') === 'bayar')
    .map(r => ({ desc: String(r.desc ?? ''), qty: (+(r.jumlah as number) || 0) || 1, harga: +(r.harga as number) || 0 }))
  return {
    no: p.berkas.no, resmi: true, lunas,
    tanggalTerbit: hari,
    kepada: String(u.kepada || '').trim() || bawaanKepada,
    up: String(u.up || '').trim() || bawaanUp,
    acara: p.e.nama, tanggalAcara: String(p.e.tanggal ?? ''), jenisAcara: String(p.e.jenis ?? ''), pax: String(p.e.pax ?? ''),
    items, ket: Array.isArray(u.ket) ? u.ket : [],
    totals,
    penanda: p.berkas.penanda,
    cap: adaBuktiSheet((p.e.payments ?? []).map(x => ({ jenis: String(x.type ?? ''), adaBukti: !!x.receiptUrl })), p.jenis) ? (p.berkas.cap || '') : '',
    kaki: `Dicetak ${hari}`,
  }
})
const lembarHtml = computed(() => (lembar.value ? invoiceHtml(lembar.value) : ''))
const bawaanKepada = computed(() => {
  const p = pdf.value
  if (!p) return ''
  const c = st.value.clients.find(x => x.id === p.e.clientId)
  return String(c?.perusahaan || c?.nama || '')
})
const bawaanUp = computed(() => {
  const p = pdf.value
  if (!p) return ''
  const c = st.value.clients.find(x => x.id === p.e.clientId)
  return String(c?.pic || c?.nama || '')
})

// ---- Ubah Kepada / U.P / Keterangan (invUbah): text only, never numbers ----
const ubahMode = ref(false)
const ubahKepada = ref('')
const ubahUp = ref('')
const ubahKet = ref<string[]>([])
const ubahSibuk = ref(false)
watch(pdf, (p) => {
  const u = (p?.berkas.ubah ?? {}) as UbahInvoice
  ubahKepada.value = String(u.kepada ?? '')
  ubahUp.value = String(u.up ?? '')
  ubahKet.value = (lembar.value?.items ?? []).map((_, i) => String(u.ket?.[i]?.teks ?? ''))
})
async function simpanUbah() {
  const p = pdf.value
  if (!p) return
  const rid = resIdInvMkt(p.e.id, p.jenis === 'INV_LUNAS' ? 'lunas' : 'dp')
  const st_ = peta.value[rid] as { id?: string } | undefined
  if (!st_?.id) {
    toast.add({ title: 'Status belum terbaca', description: 'Muat ulang daftarnya dulu.', color: 'error' })
    return
  }
  ubahSibuk.value = true
  try {
    const items = lembar.value?.items ?? []
    const r = await updateInvoiceText(st_.id, {
      ubah: {
        kepada: ubahKepada.value.trim(), up: ubahUp.value.trim(),
        ket: items.map((it, i) => ({ asal: String(it.desc ?? ''), teks: ubahKet.value[i]?.trim() ?? '' })),
      },
    }, versiPeta.value[rid] ?? '')
    const b = (await berkasKwitansi(rid)).data
    if (b) pdf.value = { ...p, berkas: b }
    if (r.data) {
      peta.value[rid] = r.data as unknown as StatusInvMkt
      const v = (r as unknown as { meta?: { version?: string } }).meta?.version
      if (v) versiPeta.value[rid] = v
    }
    ubahMode.value = false
    toast.add({ title: 'Invoice diperbarui', description: 'Lembar di Finance ikut berubah.', color: 'success' })
  }
  catch (e) {
    toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    ubahSibuk.value = false
  }
}

// ---- table ----
const KOL: KolomMkt<EventMkt>[] = [
  { k: 'nama', t: 'Client / Event', v: e => namaClient(e.clientId) },
  { k: 'grand', t: 'Grand Total', v: e => uang(e).grand, turun: true },
  { k: 'bayar', t: 'Terbayar', v: e => uang(e).paid, turun: true },
  { k: 'sisa', t: 'Sisa', v: e => uang(e).remaining, turun: true, def: true },
  { k: 'status', t: 'Status', v: e => inv(e) },
]
const tbl = useTabelMkt<EventMkt>('invoices', KOL, () => `${tab.value}${tampil.value.length}`)
const hal = computed(() => tbl.potong(tbl.susun(daftar.value)))
const keFinance = (e: EventMkt) => router.push(`/marketing/event/${e.id}?tab=finance`)
const pdfKind = (e: EventMkt): 'INV_DP' | 'INV_LUNAS' | null => {
  if (peta.value[resIdInvMkt(e.id, 'lunas')]?.status === 'DIBUAT') return 'INV_LUNAS'
  if (peta.value[resIdInvMkt(e.id, 'dp')]?.status === 'DIBUAT') return 'INV_DP'
  return null
}
const bisaCatat = (e: EventMkt) => can('verify_payment') && uang(e).remaining > 0
const cetak = () => cetakPdf(namaBerkas('Invoice', pdf.value?.berkas.no, pdf.value?.e.nama))
</script>

<template>
  <AppPage
    title="Invoice & Payment"
    description="Status pembayaran tiap event, real-time untuk Finance & Marketing."
  >
    <MarketingGerbang layar="invoices">
      <AppStatGrid
        :loading="statMemuat"
        :count="4"
      >
        <AppStat
          label="Total piutang"
          :value="rupiah(rekap.piutang)"
          :sub="`${tampil.length} invoice Deal & Event Done`"
          tone="warning"
          icon="i-lucide-wallet"
        />
        <AppStat
          label="Invoice overdue"
          :value="String(rekap.overdue)"
          sub="lewat H-7"
          tone="error"
          icon="i-lucide-alarm-clock"
        />
        <AppStat
          label="Lunas"
          :value="String(rekap.lunas)"
          :sub="`dari ${tampil.length} invoice`"
          tone="success"
          icon="i-lucide-check-check"
        />
        <AppStat
          label="Draft (tidak ditampilkan)"
          :value="String(rekap.draft)"
          sub="Deal/Event Done yang invoice-nya belum terbit"
          tone="gold"
          icon="i-lucide-file-text"
        />
      </AppStatGrid>

      <UAlert
        v-if="nDraft.length"
        color="warning"
        variant="subtle"
        class="mb-4"
        :title="`${nDraft.length} event Deal / Event Done tidak ditampilkan karena invoice-nya masih Draft`"
        :description="`Lengkapi dari tab Finance event-nya — begitu terbit, barisnya muncul di sini: ${nDraft.slice(0, 8).map(e => e.nama || namaClient(e.clientId)).join(', ')}${nDraft.length > 8 ? ' …' : ''}`"
      />

      <AppPanel
        v-if="galat"
        title="Finance tidak terjangkau"
      >
        <p class="text-sm text-muted">
          Status invoice resmi belum terbaca: {{ galat }}
        </p>
        <UButton
          label="Coba lagi"
          color="neutral"
          variant="outline"
          size="sm"
          class="mt-2"
          loading-auto
          @click="muat"
        />
      </AppPanel>

      <AppPanel flush>
        <template #head>
          <AppSeg
            v-model="tab"
            :options="opsiTab"
          />
        </template>
        <div
          v-if="status === 'pending' && !daftar.length"
          class="space-y-2 p-4"
        >
          <USkeleton
            v-for="i in 5"
            :key="i"
            class="h-12 w-full"
          />
        </div>
        <div
          v-else-if="!daftar.length"
          class="p-8 text-center text-sm text-muted"
        >
          <b class="block text-base text-highlighted">Tidak ada invoice di tab ini</b>
          <span class="text-sm text-muted">{{ kosongTab }}</span>
        </div>
        <template v-else>
          <UTable
            :data="hal"
            :columns="[
              { id: 'nama', header: tbl.kepala('nama', 'Client / Event') },
              { id: 'grand', header: tbl.kepala('grand', 'Grand Total') },
              { id: 'bayar', header: tbl.kepala('bayar', 'Terbayar') },
              { id: 'sisa', header: tbl.kepala('sisa', 'Sisa') },
              { id: 'status', header: tbl.kepala('status', 'Status') },
              { id: 'resmi', header: 'Invoice Resmi' },
              { id: 'aksi', header: 'Aksi' },
            ]"
            class="hidden lg:block"
            :ui="{ tr: 'cursor-pointer' }"
            @select="(_e: Event, r: { original: EventMkt }) => keFinance(r.original)"
          >
            <template #nama-cell="{ row }">
              <p class="font-semibold text-highlighted">
                {{ namaClient(row.original.clientId) }}
              </p>
              <p class="text-xs text-muted">
                {{ row.original.nama }}
              </p>
            </template>
            <template #grand-cell="{ row }">
              <span class="num">{{ rupiah(uang(row.original).grand) }}</span>
            </template>
            <template #bayar-cell="{ row }">
              <span class="num">{{ rupiah(uang(row.original).paid) }}</span>
              <p class="max-w-36 text-xs whitespace-normal text-muted">
                target {{ dpLabel(uang(row.original)) }}: <span class="num">{{ rupiah(uang(row.original).dp) }}</span>
              </p>
            </template>
            <template #sisa-cell="{ row }">
              <span class="num">{{ rupiah(uang(row.original).remaining) }}</span>
            </template>
            <template #status-cell="{ row }">
              <AppStatus
                :color="warnaInvoiceMkt(inv(row.original))"
                :icon="ikonInvoiceMkt(inv(row.original))"
                size="sm"
              >
                {{ inv(row.original) }}
              </AppStatus>
            </template>
            <template #resmi-cell="{ row }">
              <div
                class="grid grid-cols-1 gap-1.5"
                @click.stop
              >
                <MarketingSlotInv
                  v-for="j in JENIS_RESMI"
                  :key="j.k"
                  :ev="row.original"
                  :jenis="j.t"
                  :label="j.l"
                  :siap="slotSiap(row.original, j.k)"
                  :menunggu-ket="j.k === 'dp' ? 'menunggu DP masuk' : 'menunggu pelunasan dicatat'"
                  :peta="peta"
                  :memuat="memuat"
                  :galat="galat"
                  :bisa-minta="bolehMinta"
                  @minta="minta = { e: row.original, jenis: j.t }"
                  @pdf="bukaPdf(row.original, j.t)"
                  @ulang="muat"
                />
              </div>
            </template>
            <template #aksi-cell="{ row }">
              <div
                class="flex gap-1"
                @click.stop
              >
                <UButton
                  v-if="bisaCatat(row.original)"
                  icon="i-lucide-banknote"
                  size="xs"
                  title="Catat pembayaran"
                  aria-label="Catat pembayaran"
                  @click="keFinance(row.original)"
                />
              </div>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="e in hal"
              :key="e.id"
              class="p-4"
            >
              <NuxtLink :to="`/marketing/event/${e.id}?tab=finance`">
                <b class="block text-highlighted">{{ namaClient(e.clientId) }} — {{ e.nama }}</b>
                <span class="num block text-sm">Grand {{ rupiah(uang(e).grand) }} · Terbayar {{ rupiah(uang(e).paid) }} · Sisa {{ rupiah(uang(e).remaining) }}</span>
                <span class="mt-1 flex flex-wrap items-center gap-1">
                  <AppStatus
                    :color="warnaInvoiceMkt(inv(e))"
                    :icon="ikonInvoiceMkt(inv(e))"
                    size="sm"
                  >
                    {{ inv(e) }}
                  </AppStatus>
                  <span
                    v-if="noResmiInvMkt(peta, e.id)"
                    class="num text-xs text-muted"
                  >{{ noResmiInvMkt(peta, e.id) }}</span>
                </span>
              </NuxtLink>
              <div class="mt-2 flex gap-1">
                <UButton
                  v-if="pdfKind(e)"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  label="PDF Resmi"
                  loading-auto
                  @click="bukaPdf(e, pdfKind(e) as 'INV_DP' | 'INV_LUNAS')"
                />
                <template v-if="!pdfKind(e)">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    label="Invoice DP"
                    :disabled="!bolehMinta || !punyaDpMkt(uang(e))"
                    @click="minta = { e, jenis: 'INV_DP' }"
                  />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    label="Pelunasan"
                    :disabled="!bolehMinta || !punyaPelunasanMkt(e, uang(e))"
                    @click="minta = { e, jenis: 'INV_LUNAS' }"
                  />
                </template>
                <UButton
                  v-if="bisaCatat(e)"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  label="Catat"
                  @click="keFinance(e)"
                />
              </div>
            </li>
          </ul>
          <MarketingPager
            v-model="tbl.hal.value"
            :total="daftar.length"
          />
        </template>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="mintaBuka"
        :title="`Minta invoice ${minta?.jenis === 'INV_LUNAS' ? 'pelunasan' : 'DP'} resmi`"
        :description="minta?.e.nama ?? ''"
      >
        <p class="whitespace-pre-line text-sm">
          {{ mintaInfo?.rincian }}
        </p>
        <UAlert
          v-if="(mintaInfo?.tanpaBukti ?? 0) > 0"
          color="warning"
          variant="subtle"
          :description="`${mintaInfo?.tanpaBukti} pembayaran belum ada bukti transfernya — Finance bisa menolak permintaan ini.`"
          class="mt-3"
        />
        <p class="mt-3 text-xs text-muted">
          Finance memeriksa dana masuknya dulu, lalu menerbitkan lembar bertanda tangan. Tombol PDF muncul di sini begitu terbit.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="minta = null"
          />
          <UButton
            label="Kirim permintaan"
            :loading="mintaSibuk"
            @click="kirimMinta"
          />
        </div>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="pdfBuka"
        title="Invoice resmi"
        :description="pdf ? `${pdf.e.nama} · ${pdf.berkas.no}` : ''"
      >
        <template v-if="pdf">
          <UAlert
            v-if="pdf.berkas.materai"
            color="warning"
            variant="subtle"
            title="Bermaterai — lembar polos"
            description="Tanpa tanda tangan & cap digital; ditandatangani basah di atas materai."
            class="mb-3"
          />
          <div
            v-if="!ubahMode"
            class="overflow-x-auto rounded-lg border border-default bg-white p-2"
          >
            <!-- eslint-disable vue/no-v-html -- lembar dibangun sendiri oleh invoiceHtml(), semua field di-escape di escSheet -->
            <div v-html="lembarHtml" />
            <!-- eslint-enable vue/no-v-html -->
          </div>
          <div
            v-else
            class="grid grid-cols-1 gap-3"
          >
            <p class="text-sm text-muted">
              Yang bisa diubah cuma <b>teks</b> — Kepada, U.P, dan Keterangan tiap baris.
              Angka tetap dari rincian event. Kosongkan kotak untuk kembali ke isi bawaan.
              Ubahan disimpan di Finance, jadi lembar yang dilihat Finance ikut berubah.
            </p>
            <UFormField label="Kepada">
              <UInput
                v-model="ubahKepada"
                class="w-full"
                :placeholder="bawaanKepada"
              />
            </UFormField>
            <UFormField label="U.P">
              <UInput
                v-model="ubahUp"
                class="w-full"
                :placeholder="bawaanUp"
              />
            </UFormField>
            <div v-if="(lembar?.items ?? []).length">
              <p class="mb-1 text-sm font-semibold">
                Keterangan per baris
              </p>
              <div
                v-for="(it, i) in (lembar?.items ?? [])"
                :key="i"
                class="mb-2 grid gap-1"
              >
                <UTextarea
                  v-model="ubahKet[i]"
                  :rows="1"
                  class="w-full"
                  :placeholder="String(it.desc ?? '')"
                />
                <p class="num text-right text-xs text-muted">
                  {{ rupiah((Number(it.qty) || 1) * (Number(it.harga) || 0)) }}
                </p>
              </div>
            </div>
            <p
              v-if="pdf.berkas.ubah?.oleh"
              class="text-xs text-muted"
            >
              Terakhir diubah {{ pdf.berkas.ubah.oleh }}
            </p>
          </div>
          <div class="mt-4 flex flex-wrap justify-end gap-2">
            <UButton
              v-if="!ubahMode && bolehMinta"
              icon="i-lucide-pen-line"
              label="Ubah Kepada / U.P / Keterangan"
              color="neutral"
              variant="outline"
              @click="ubahMode = true"
            />
            <UButton
              v-if="ubahMode"
              label="Simpan perubahan"
              :loading="ubahSibuk"
              @click="simpanUbah"
            />
            <UButton
              v-if="ubahMode"
              label="Batal"
              color="neutral"
              variant="ghost"
              @click="ubahMode = false"
            />
            <UButton
              v-if="!ubahMode"
              icon="i-lucide-printer"
              label="Cetak"
              color="neutral"
              variant="outline"
              @click="cetak"
            />
          </div>
        </template>
      </ResponsiveSheet>
    </MarketingGerbang>
  </AppPage>
</template>
