<!--
  Marketing › Event Brief & Quotation (docs/migrasi/marketing.md D.5, issue
  #59): hidden from the sidebar, reached from the detail page and list buttons.
  Without ?id= it is the brief table (Event, Client, Tanggal, Status,
  Generate); with ?id=&mode= it previews the paper (same article pattern as the
  event Overview tab) with print + WhatsApp. The 'quote' mode is the system template — a negotiation
  draft, never the official letter (that is the uploaded PDF on the offer
  card); a self-uploaded PDF opens instead when one exists (draftNegotiation).
-->
<script setup lang="ts">
import type { ModeBriefMkt } from '~/utils/marketing-event'
import {
  KUNCI_INTERNAL_MKT,
  SEKSI_EVENT_MKT,
  adaIsiOverviewMkt,
  progresSeksiMkt,
  ringkasNilaiMkt,
} from '~/utils/marketing-event'
import type { EventMkt, KolomMkt } from '~/utils/marketing'
import { rentangTglMkt, tglMkt } from '~/utils/marketing'
import { eventFinance, rincianPenawaran } from '~/utils/marketing-uang'
import { rupiah } from '~/utils/format'
import { ikonStatusMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { bukaBerkasMkt, useStateMkt, useTabelMkt } from '~/composables/useMarketing'

definePageMeta({ access: ['marketing'] })

const route = useRoute()
const router = useRouter()
const { data: st, status } = useStateMkt()

const id = computed(() => String(route.query.id ?? ''))
const mode = computed<ModeBriefMkt>(() => {
  const m = String(route.query.mode ?? 'internal')
  return m === 'client' || m === 'quote' ? m : 'internal'
})
const ev = computed(() => st.value.events.find(e => e.id === id.value) ?? null)
const client = computed(() => st.value.clients.find(c => c.id === ev.value?.clientId))

const namaUser = (uid?: string) => st.value.users.find(u => u.id === uid)?.name ?? uid ?? '—'

/** The same money + offer lines the finance tab and the overview use. */
const uang = computed(() => (ev.value ? eventFinance(ev.value, st.value.settings) : null))
const tagihan = computed(() => (ev.value ? rincianPenawaran(ev.value, st.value.settings) : []))

/** Paper heading keeps the legacy paper titles verbatim. */
const judulDok = computed(() => (mode.value === 'client' ? 'Konfirmasi Detail Acara' : mode.value === 'quote' ? 'Penawaran / Quotation' : 'Event Brief — Internal'))

/** Detail bag: top-level row keys first (nama, jenis, tanggal, …), then detail. */
type TasBrief = Record<string, unknown>
const tas = computed(() => (ev.value?.detail ?? {}) as TasBrief)
const penawaran = computed(() => (ev.value?.penawaran ?? {}) as TasBrief)
const noSurat = computed(() => String(penawaran.value.noSurat ?? ''))
const validSampai = computed(() => String(tas.value.validUntil ?? penawaran.value.validUntil ?? ''))
const picAcara = computed(() => String(tas.value.picAcara ?? ''))
const pics = computed(() => ['picAcara', 'kPIC', 'fPIC', 'refundPIC', 'picKoordinator', 'picMOD'].map(k => tas.value[k]).filter(Boolean).map(String))

/** Field types that never print (same skip list as the old paper). */
const LEWAT_TIPE = ['head', 'mirror', 'salinlayout', 'mejalock']

interface BarisDok { k: string, l: string, t: string, raw: unknown, ringkas: string | null }
interface SeksiDok { id: string, n: string, title: string, isi: number, total: number, baris: BarisDok[] }

/**
 * Paper sections for internal/client: the same section walk as the old paper
 * (every section except finance, minus "Tampil di PDF"-off sections, minus the
 * internal-only keys on the client version), but each row is shaped like the
 * overview tab so MarketingOverviewIsi can draw it (plain rows + rich tables).
 */
const seksiDok = computed<SeksiDok[]>(() => {
  const e = ev.value
  if (!e || mode.value === 'quote') return []
  const pdfSec = (tas.value._pdfSec ?? {}) as Record<string, unknown>
  const out: SeksiDok[] = []
  for (const s of SEKSI_EVENT_MKT) {
    if (s.id === 'finance') continue
    if (pdfSec[s.id] === false) continue
    const p = progresSeksiMkt(e, s)
    const baris: BarisDok[] = []
    for (const f of s.fields) {
      if (LEWAT_TIPE.includes(f.t)) continue
      if (mode.value === 'client' && KUNCI_INTERNAL_MKT.includes(f.k)) continue
      const raw = tas.value[f.k] ?? (e as unknown as TasBrief)[f.k]
      const t = f.k === 'rincianItem' ? 'rincitbl' : f.t
      const isi = t === 'rincitbl' ? tagihan.value : raw
      const ringkas = ringkasNilaiMkt(f.t, raw)
      if (adaIsiOverviewMkt(t, isi, ringkas)) baris.push({ k: f.k, l: f.l, t, raw: isi, ringkas })
    }
    if (baris.length) out.push({ id: s.id, n: s.n, title: s.title, isi: p.isi, total: p.total, baris })
  }
  return out
})

/** Global fill strip, same shape as the overview tab. */
const ringkasDok = computed(() => {
  const isi = seksiDok.value.reduce((a, s) => a + s.isi, 0)
  const total = seksiDok.value.reduce((a, s) => a + s.total, 0)
  return { isi, total, pct: total ? Math.round(isi / total * 100) : 0 }
})
const pdfSendiri = computed(() => {
  const f = (ev.value?.penawaran as { file?: { key?: string } } | undefined)?.file
  return f?.key ? f : null
})

const q = ref('')
const clientNama = (cid: string) => st.value.clients.find(c => c.id === cid)?.nama ?? '—'
const daftar = computed(() => {
  const k = q.value.trim().toLowerCase()
  if (!k) return st.value.events
  return st.value.events.filter((e) => {
    const c = st.value.clients.find(x => x.id === e.clientId)
    return [e.nama, e.jenis, e.status, e.tanggal, tglMkt(e.tanggal), c?.nama, c?.perusahaan].filter(Boolean).join(' ').toLowerCase().includes(k)
  })
})
// KOL_BRIEF (:11235): Tanggal newest first by default.
const KOL: KolomMkt<EventMkt>[] = [
  { k: 'nama', t: 'Event', v: e => e.nama },
  { k: 'client', t: 'Client', v: e => clientNama(e.clientId) },
  { k: 'tanggal', t: 'Tanggal', v: e => e.tanggal ?? '', turun: true, def: true },
  { k: 'status', t: 'Status', v: e => e.status },
]
const tbl = useTabelMkt<EventMkt>('brief', KOL, () => `${q.value}${st.value.events.length}`)
const fmtBulan = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
/** Month separators only while sorted by date (pisahBulan); the count covers the whole sorted list, not the page. */
const baris = computed(() => {
  const urut = tbl.susun([...daftar.value])
  const pisah = !tbl.urut.value || tbl.urut.value.k === 'tanggal'
  const n = new Map<string, number>()
  for (const e of urut) {
    const bl = String(e.tanggal ?? '').slice(0, 7)
    n.set(bl, (n.get(bl) ?? 0) + 1)
  }
  let kini: string | null = null
  return tbl.potong(urut).map((e) => {
    const bl = String(e.tanggal ?? '').slice(0, 7)
    let bulan: { label: string, n: number } | null = null
    if (pisah && bl !== kini) {
      kini = bl
      bulan = { label: bl ? fmtBulan(bl) : 'Tanpa tanggal', n: n.get(bl) ?? 0 }
    }
    return { e, bulan }
  })
})
const TOMBOL = [
  { m: 'internal', l: 'Internal', t: 'Briefing internal untuk tim' },
  { m: 'client', l: 'Client', t: 'Versi yang dikirim ke client' },
  { m: 'quote', l: 'Draft', t: 'Draft Negotiation — PDF yang diunggah sendiri, atau template otomatis dari sistem' },
] as const
const keDok = (eid: string, m: ModeBriefMkt) => router.push({ path: '/marketing/brief', query: { id: eid, mode: m } })

const judulMode = computed(() => (mode.value === 'client' ? 'Konfirmasi Detail Acara' : mode.value === 'quote' ? 'Draft Negosiasi (bukan surat resmi)' : 'Briefing Internal'))

function cetak() {
  cetakPdf(namaBerkas(judulDok.value, ev.value?.nama))
}
</script>

<template>
  <AppPage
    title="Event Brief & Quotation"
    description="Briefing internal & versi client, satu klik dari data event."
    :back="id ? { label: 'Kembali', to: `/marketing/event/${id}` } : { label: 'Pipeline', to: '/marketing/pipeline?tab=events' }"
  >
    <MarketingGerbang layar="brief">
      <!-- Table ↔ paper replaces the working surface, so the swap crossfades. -->
      <Transition
        name="mkt-swap"
        mode="out-in"
      >
        <div
          v-if="id && ev"
          key="dok"
        >
          <div class="mb-4 flex flex-wrap items-center gap-2">
            <AppSeg
              :model-value="mode"
              :options="[{ value: 'internal', label: 'Internal' }, { value: 'client', label: 'Client' }, { value: 'quote', label: 'Draft' }]"
              @update:model-value="keDok(id, $event as ModeBriefMkt)"
            />
            <span class="text-xs text-muted">{{ judulMode }}</span>
            <span class="flex-1" />
            <UButton
              v-if="mode === 'quote' && pdfSendiri"
              icon="i-lucide-file-text"
              color="neutral"
              variant="outline"
              size="sm"
              label="Buka PDF unggahan sendiri"
              @click="bukaBerkasMkt(String(pdfSendiri.key))"
            />
            <UButton
              icon="i-lucide-printer"
              color="neutral"
              variant="outline"
              size="sm"
              label="Cetak"
              @click="cetak"
            />
          </div>
          <!-- Paper: same article pattern as the event Overview tab (04) — kop,
            2-column meta grid, numbered section heads, definition rows. -->
          <article
            class="mx-auto w-full max-w-[860px] rounded-xl border border-default bg-default p-4 text-sm sm:p-6 print:max-w-none print:rounded-none print:border-0 print:shadow-none"
          >
            <header class="mb-4 flex flex-wrap items-center gap-3 border-b-4 border-brand-yellow pb-4">
              <img
                src="/mark.png"
                alt=""
                class="size-11 shrink-0 object-contain"
              >
              <div class="min-w-[160px] flex-1">
                <p class="font-display text-xl font-bold text-highlighted">
                  Laksamana Muda
                </p>
                <p class="text-[10px] tracking-[0.2em] text-yellow-dark">
                  COFFEE &amp; LIVE SPACE
                </p>
              </div>
              <div class="min-w-[180px] text-right">
                <p class="text-[10px] font-bold tracking-[0.15em] text-yellow-dark">
                  {{ judulDok.toUpperCase() }}
                </p>
                <p class="mt-1 font-display text-lg font-bold text-highlighted">
                  {{ ev.nama || '—' }}
                </p>
                <p class="text-xs text-muted">
                  {{ rentangTglMkt(ev) }}
                </p>
              </div>
            </header>

            <div class="mb-3 grid gap-x-6 gap-y-1 rounded-lg bg-muted px-4 py-3 text-sm sm:grid-cols-2">
              <p><b>Client</b> · {{ client?.nama ?? '—' }}{{ client?.perusahaan ? ` — ${client.perusahaan}` : '' }}</p>
              <p><b>Marketing PIC</b> · {{ namaUser(ev.mktPIC) }}</p>
              <p><b>Jenis</b> · {{ ev.jenis || '—' }}</p>
              <p><b>Estimasi</b> · {{ ev.pax || '—' }} pax</p>
            </div>

            <!-- Internal/client: fill strip + numbered sections, like the overview. -->
            <template v-if="mode !== 'quote'">
              <div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
                <div class="h-1.5 w-64 max-w-full overflow-hidden rounded-full bg-ink-200">
                  <div
                    class="h-full bg-brand-yellow"
                    :style="{ width: `${ringkasDok.pct}%` }"
                  />
                </div>
                <span class="num"><b class="text-highlighted">{{ ringkasDok.isi }}</b> dari {{ ringkasDok.total }} isian terisi ({{ ringkasDok.pct }}%)</span>
              </div>
              <p
                v-if="!seksiDok.length"
                class="text-sm text-muted"
              >
                Belum ada isian sama sekali.
              </p>
              <section
                v-for="s in seksiDok"
                :key="s.id"
                class="mb-5 break-inside-avoid last:mb-0"
              >
                <h3 class="mb-2 flex items-center gap-2 border-b border-default pb-2 text-sm font-semibold text-highlighted">
                  <span class="flex h-6 min-w-10 items-center justify-center rounded-md bg-yellow-light px-2 text-xs font-bold text-yellow-dark num">
                    {{ s.n }}
                  </span>
                  {{ s.title }}
                  <span class="ml-auto text-xs font-normal text-muted num">{{ s.isi }}/{{ s.total }} isian</span>
                </h3>
                <MarketingOverviewIsi
                  :baris="s.baris"
                  :ev="ev"
                  :settings="st.settings"
                />
              </section>

              <!-- Closing money box: the old paper's finance paragraph as definition rows. -->
              <section
                v-if="uang"
                class="mb-5 break-inside-avoid last:mb-0"
              >
                <h3
                  v-if="mode === 'internal'"
                  class="mb-2 border-b border-default pb-2 text-sm font-semibold text-highlighted"
                >
                  Keuangan (internal)
                </h3>
                <h3
                  v-else
                  class="mb-2 border-b border-default pb-2 text-sm font-semibold text-highlighted"
                >
                  Ketentuan Pembayaran
                </h3>
                <dl class="grid text-sm">
                  <div
                    v-if="mode === 'client'"
                    class="grid grid-cols-1 gap-1 border-b border-default py-2 sm:grid-cols-[38%_1fr] sm:gap-3"
                  >
                    <dt class="text-muted">
                      Sistem
                    </dt>
                    <dd class="font-semibold text-highlighted">
                      {{ String(tas.sistemBayar ?? '') }}
                    </dd>
                  </div>
                  <div class="grid grid-cols-1 gap-1 border-b border-default py-2 sm:grid-cols-[38%_1fr] sm:gap-3">
                    <dt class="text-muted">
                      {{ mode === 'internal' ? 'Grand total' : 'DP' }}
                    </dt>
                    <dd class="font-semibold text-highlighted">
                      {{ rupiah(mode === 'internal' ? uang.grand : uang.dp) }}
                    </dd>
                  </div>
                  <div
                    v-if="mode === 'internal'"
                    class="grid grid-cols-1 gap-1 border-b border-default py-2 sm:grid-cols-[38%_1fr] sm:gap-3"
                  >
                    <dt class="text-muted">
                      DP
                    </dt>
                    <dd class="font-semibold text-highlighted">
                      {{ rupiah(uang.dp) }}
                    </dd>
                  </div>
                  <div
                    v-if="mode === 'internal'"
                    class="grid grid-cols-1 gap-1 border-b border-default py-2 sm:grid-cols-[38%_1fr] sm:gap-3"
                  >
                    <dt class="text-muted">
                      Terbayar
                    </dt>
                    <dd class="font-semibold text-highlighted">
                      {{ rupiah(uang.paid) }}
                    </dd>
                  </div>
                  <div class="grid grid-cols-1 gap-1 border-b border-default py-2 sm:grid-cols-[38%_1fr] sm:gap-3">
                    <dt class="text-muted">
                      Sisa
                    </dt>
                    <dd class="font-semibold text-highlighted">
                      {{ rupiah(uang.remaining) }}
                    </dd>
                  </div>
                  <div
                    v-if="mode === 'internal' && pics.length"
                    class="grid grid-cols-1 gap-1 border-b border-default py-2 sm:grid-cols-[38%_1fr] sm:gap-3"
                  >
                    <dt class="text-muted">
                      PIC
                    </dt>
                    <dd class="font-semibold text-highlighted">
                      {{ pics.join(' · ') }}
                    </dd>
                  </div>
                </dl>
              </section>
            </template>

            <!-- Draft: system quotation template — same table pattern as the overview Rincian Tagihan. -->
            <template v-else>
              <p class="mb-3 text-sm">
                No. surat: {{ noSurat }} · Berlaku s/d: {{ validSampai }}
              </p>
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Rincian Tagihan
              </p>
              <table class="w-full table-fixed border-collapse text-sm sm:table-auto print:table-auto">
                <thead>
                  <tr class="bg-muted text-left text-xs text-muted">
                    <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                      No
                    </th>
                    <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                      Deskripsi
                    </th>
                    <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                      Qty
                    </th>
                    <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                      Harga
                    </th>
                    <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, i) in tagihan"
                    :key="i"
                    class="border-b border-default last:border-0"
                  >
                    <td class="break-words px-2 py-1.5 print:border print:border-default">
                      {{ i + 1 }}
                    </td>
                    <td class="break-words px-2 py-1.5 print:border print:border-default">
                      {{ r.desc }}
                    </td>
                    <td class="break-words px-2 py-1.5 print:border print:border-default">
                      {{ r.qty ?? '–' }}
                    </td>
                    <td class="break-words px-2 py-1.5 print:border print:border-default">
                      {{ r.gratis ? 'FREE' : r.tbc ? 'TBC' : rupiah(r.unit) }}
                    </td>
                    <td class="break-words px-2 py-1.5 print:border print:border-default">
                      {{ r.gratis ? 'FREE' : r.tbc ? 'TBC' : rupiah(r.total) }}
                    </td>
                  </tr>
                  <tr
                    v-if="uang && uang.disc > 0"
                    class="border-b border-default last:border-0"
                  >
                    <td class="break-words px-2 py-1.5 print:border print:border-default">
                      –
                    </td>
                    <td class="break-words px-2 py-1.5 print:border print:border-default">
                      Discount
                    </td>
                    <td class="break-words px-2 py-1.5 print:border print:border-default">
                      –
                    </td>
                    <td class="break-words px-2 py-1.5 print:border print:border-default">
                      –
                    </td>
                    <td class="break-words px-2 py-1.5 print:border print:border-default">
                      -{{ rupiah(uang.disc) }}
                    </td>
                  </tr>
                </tbody>
                <tfoot v-if="uang">
                  <tr class="border-t border-default font-semibold">
                    <td
                      colspan="4"
                      class="px-2 py-1.5 text-right print:border print:border-default"
                    >
                      Total Ditagih
                    </td>
                    <td class="px-2 py-1.5 print:border print:border-default">
                      {{ rupiah(uang.grand) }}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <p
                v-if="uang"
                class="mt-3 text-sm"
              >
                <b>Grand total: {{ rupiah(uang.grand) }}</b> · DP: {{ rupiah(uang.dp) }} · Sisa: {{ rupiah(uang.remaining) }}
              </p>
              <p class="mt-1 text-sm">
                Marketing: ______ · Menyetujui: ______<template v-if="picAcara">
                  · PIC acara: {{ picAcara }}
                </template>
              </p>
            </template>
          </article>
        </div>
        <AppPanel
          v-else-if="id"
          key="hilang"
        >
          <div
            v-if="status === 'pending'"
            class="space-y-2 py-2"
          >
            <USkeleton class="h-5 w-1/3" />
            <USkeleton class="h-3 w-full" />
            <USkeleton class="h-3 w-full" />
            <USkeleton class="h-3 w-5/6" />
            <USkeleton class="mt-4 h-5 w-1/4" />
            <USkeleton class="h-3 w-full" />
            <USkeleton class="h-3 w-4/6" />
          </div>
          <p
            v-else
            class="py-6 text-center text-sm text-muted"
          >
            Event tidak ditemukan.
          </p>
        </AppPanel>
        <div
          v-else
          key="daftar"
        >
          <AppPanel flush>
            <template #head>
              <div class="flex w-full flex-wrap items-center gap-3">
                <UInput
                  v-model="q"
                  placeholder="Cari nama event, klien, jenis, atau tanggal…"
                  icon="i-lucide-search"
                  class="min-w-0 flex-1"
                />
                <span class="text-xs text-muted">{{ daftar.length }} dari {{ st.events.length }} event</span>
              </div>
            </template>
            <div
              v-if="status === 'pending' && !st.events.length"
              class="space-y-2 p-4"
            >
              <USkeleton
                v-for="i in 5"
                :key="i"
                class="h-12 w-full"
              />
            </div>
            <p
              v-else-if="!st.events.length"
              class="p-8 text-center text-sm text-muted"
            >
              <b class="block text-highlighted">Belum ada event</b>
              Brief & quotation dibuat dari event yang sudah ada. Buat event dulu di menu Input & Event.
            </p>
            <p
              v-else-if="!daftar.length"
              class="p-8 text-center text-sm text-muted"
            >
              <b class="block text-highlighted">Tidak ada yang cocok</b>
              Coba kata kunci lain, atau kosongkan pencariannya.
            </p>
            <template v-else>
              <table class="hidden w-full text-sm lg:table">
                <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
                  <tr>
                    <th
                      v-for="k in KOL"
                      :key="k.k"
                      class="px-4 py-2"
                    >
                      <component :is="tbl.kepala(k.k, k.t)" />
                    </th>
                    <th class="px-4 py-2">
                      Generate
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <template
                    v-for="r in baris"
                    :key="r.e.id"
                  >
                    <tr
                      v-if="r.bulan"
                      class="bg-muted"
                    >
                      <td
                        colspan="5"
                        class="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted"
                      >
                        {{ r.bulan.label }} <span class="ml-2 font-semibold normal-case">{{ r.bulan.n }} event</span>
                      </td>
                    </tr>
                    <tr>
                      <td class="px-4 py-2">
                        <NuxtLink
                          :to="`/marketing/event/${r.e.id}`"
                          class="font-semibold text-highlighted hover:text-primary-700"
                        >
                          {{ r.e.nama }}
                        </NuxtLink>
                      </td>
                      <td class="px-4 py-2">
                        {{ clientNama(r.e.clientId) }}
                      </td>
                      <td class="px-4 py-2 num">
                        {{ rentangTglMkt(r.e) }}
                      </td>
                      <td class="px-4 py-2">
                        <AppStatus
                          :color="warnaStatusMkt(r.e.status)"
                          :icon="ikonStatusMkt(r.e.status)"
                          size="sm"
                        >
                          {{ r.e.status }}
                        </AppStatus>
                      </td>
                      <td class="px-4 py-2">
                        <div class="flex gap-1">
                          <UButton
                            v-for="m in TOMBOL"
                            :key="m.m"
                            size="xs"
                            color="neutral"
                            variant="ghost"
                            :label="m.l"
                            :title="m.t"
                            @click="keDok(r.e.id, m.m)"
                          />
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
              <ul class="divide-y divide-default lg:hidden">
                <template
                  v-for="r in baris"
                  :key="r.e.id"
                >
                  <li
                    v-if="r.bulan"
                    class="bg-muted px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted"
                  >
                    {{ r.bulan.label }} · {{ r.bulan.n }} event
                  </li>
                  <li class="space-y-2 p-4">
                    <div class="flex items-start justify-between gap-2">
                      <NuxtLink
                        :to="`/marketing/event/${r.e.id}`"
                        class="min-w-0 font-semibold text-highlighted"
                      >
                        {{ r.e.nama }}
                      </NuxtLink>
                      <AppStatus
                        :color="warnaStatusMkt(r.e.status)"
                        :icon="ikonStatusMkt(r.e.status)"
                        size="sm"
                      >
                        {{ r.e.status }}
                      </AppStatus>
                    </div>
                    <p class="text-xs text-muted">
                      {{ clientNama(r.e.clientId) }} · <span class="num">{{ rentangTglMkt(r.e) }}</span>
                    </p>
                    <div class="flex gap-1">
                      <UButton
                        v-for="m in TOMBOL"
                        :key="m.m"
                        size="sm"
                        color="neutral"
                        variant="outline"
                        :label="m.l"
                        @click="keDok(r.e.id, m.m)"
                      />
                    </div>
                  </li>
                </template>
              </ul>
              <MarketingPager
                v-model="tbl.hal.value"
                :total="daftar.length"
              />
            </template>
          </AppPanel>
        </div>
      </Transition>
    </MarketingGerbang>
  </AppPage>
</template>
