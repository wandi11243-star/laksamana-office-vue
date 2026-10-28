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
  INV_KOP_MKT, kelompokBayarMkt, layakTagihMkt, noResmiInvMkt, praPelunasanMkt, punyaDpMkt,
  punyaPelunasanMkt, rekapInvoiceMkt, resIdInvMkt, ringkasInvMkt,
} from '~/utils/marketing-keuangan'
import { dpLabel, eventFinance, invStatus } from '~/utils/marketing-uang'
import { ikonInvoiceMkt, warnaInvoiceMkt } from '~/utils/status-marketing'
import {
  berkasKwitansi, mintaKwitansi, statusKwitansi, type BerkasKwitansi,
} from '~/composables/useFinance'
import {
  logMkt, useAksesMkt, useStateMkt, useTabelMkt,
} from '~/composables/useMarketing'
import { hariIni, rupiah, tglPanjang } from '~/utils/format'

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
// Old tabs carry their count (`<span class="tn">`); written "Label (n)" like the other Marketing tabs.
const jmlTab = (t: TabBayarMkt) => tampil.value.filter(e => kelompokBayarMkt(t, { inv: inv(e), remaining: uang(e).remaining, paid: uang(e).paid })).length
const opsiTab = computed(() => ([['semua', 'Semua'], ['lunas', 'Lunas'], ['dp', 'Sudah DP'], ['belum', 'Belum Payment']] as const)
  .map(([value, label]) => ({ value, label: `${label} (${jmlTab(value)})` })))
const kosongTab = computed(() => tab.value === 'lunas'
  ? 'Belum ada tagihan yang tertutup penuh.'
  : tab.value === 'dp'
    ? 'Belum ada tagihan yang sudah menerima sebagian pembayaran.'
    : 'Semua tagihan sudah menerima pembayaran — tidak ada yang kosong.')

// ---- official-invoice statuses (muatInvMkt: one request for the whole list) ----
const peta = ref<Record<string, StatusInvMkt>>({})
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
    await logMkt('event', m.e.id, `Request invoice ${m.jenis === 'INV_LUNAS' ? 'pelunasan' : 'DP'}`, `${c?.nama ?? ''} · ${rupiah(m.jenis === 'INV_LUNAS' ? pra.tagih : f.dp)}`).catch(() => {})
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
const pdf = ref<{ e: EventMkt, berkas: BerkasKwitansi } | null>(null)
const pdfBuka = computed({ get: () => !!pdf.value, set: (v) => {
  if (!v) pdf.value = null
} })
async function bukaPdf(e: EventMkt, jenis: 'INV_DP' | 'INV_LUNAS') {
  try {
    const r = await berkasKwitansi(resIdInvMkt(e.id, jenis === 'INV_LUNAS' ? 'lunas' : 'dp'))
    if (!r.data) throw new Error('not_issued')
    pdf.value = { e, berkas: r.data }
  }
  catch (e2) {
    toast.add({ title: 'Belum terbit', description: apiErrorMessage(e2), color: 'error' })
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
const cetak = () => window.print()
</script>

<template>
  <AppPage
    title="Invoice & Payment"
    description="Status pembayaran tiap event, real-time untuk Finance & Marketing."
  >
    <MarketingGerbang layar="invoices">
      <AppStatGrid>
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
          v-if="status === 'pending'"
          class="p-8 text-center text-sm text-muted"
        >
          Memuat…
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
                class="grid gap-1.5"
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
          <p class="text-sm font-bold">
            {{ INV_KOP_MKT.pt }}
          </p>
          <p class="text-xs text-muted">
            {{ INV_KOP_MKT.alamat }}
          </p>
          <p class="num mt-2 text-sm">
            No. {{ pdf.berkas.no }} · diputus {{ pdf.berkas.putusOleh }} {{ tglPanjang(String(pdf.berkas.putusAt ?? '')) }}
          </p>
          <p
            v-if="pdf.berkas.penanda?.length"
            class="mt-1 text-xs text-muted"
          >
            Penanda: {{ pdf.berkas.penanda.map(p => `${p.nama} (${p.jabatan})`).join(', ') }}
          </p>
          <div class="mt-4 flex justify-end">
            <UButton
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
