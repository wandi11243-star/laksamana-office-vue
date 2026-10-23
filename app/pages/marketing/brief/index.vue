<!--
  Marketing › Event Brief & Quotation (docs/migrasi/marketing.md D.5, issue
  #59): hidden from the sidebar, reached from the detail page and list buttons.
  Without ?id= it is the brief table (Event, Client, Tanggal, Status,
  Generate); with ?id=&mode= it previews the paper (buildBriefDocMkt) with
  print + WhatsApp. The 'quote' mode is the system template — a negotiation
  draft, never the official letter (that is the uploaded PDF on the offer
  card); a self-uploaded PDF opens instead when one exists (draftNegotiation).
-->
<script setup lang="ts">
import type { ModeBriefMkt } from '~/utils/marketing-event'
import type { EventMkt, KolomMkt } from '~/utils/marketing'
import { rentangTglMkt, tglMkt } from '~/utils/marketing'
import { ikonStatusMkt, warnaStatusMkt } from '~/utils/status-marketing'
import { buildBriefDocMkt } from '~/utils/marketing-event'
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

const dok = computed(() => (ev.value ? buildBriefDocMkt(ev.value, client.value?.nama ?? '', st.value.settings, mode.value) : ''))
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
  window.print()
}
</script>

<template>
  <AppPage
    title="Event Brief & Quotation"
    description="Briefing internal & versi client, satu klik dari data event."
    :back="id ? { label: 'Kembali', to: `/marketing/event/${id}` } : { label: 'Pipeline', to: '/marketing/pipeline?tab=events' }"
  >
    <MarketingGerbang layar="brief">
      <template v-if="id && ev">
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
        <AppPanel>
          <!-- eslint-disable vue/no-v-html — dok dibangun sendiri dari field yang di-escape di buildBriefDocMkt -->
          <div
            class="brief-dok text-sm"
            v-html="dok"
          />
          <!-- eslint-enable vue/no-v-html -->
        </AppPanel>
      </template>
      <AppPanel v-else-if="id">
        <p class="py-6 text-center text-sm text-muted">
          {{ status === 'pending' ? 'Memuat…' : 'Event tidak ditemukan.' }}
        </p>
      </AppPanel>
      <template v-else>
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
          <p
            v-if="!st.events.length"
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
      </template>
    </MarketingGerbang>
  </AppPage>
</template>

<style scoped>
.brief-dok h1 {
  font-size: 1.25rem;
  font-weight: 800;
}
.brief-dok h2 {
  font-size: 0.95rem;
  font-weight: 700;
  margin-top: 1rem;
}
.brief-dok table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.4rem;
}
.brief-dok th,
.brief-dok td {
  border: 1px solid var(--ui-border);
  padding: 0.3rem 0.5rem;
  text-align: left;
  vertical-align: top;
}
@media print {
  .brief-dok h1 {
    font-size: 1.1rem;
  }
}
</style>
