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
import type { EventMkt } from '~/utils/marketing'
import { buildBriefDocMkt } from '~/utils/marketing-event'
import { urlBerkasMkt, useStateMkt } from '~/composables/useMarketing'

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
const daftar = computed(() => {
  const s = q.value.trim().toLowerCase()
  const semua = [...st.value.events].sort((a, b) => String(b.tanggal ?? '').localeCompare(String(a.tanggal ?? '')))
  if (!s) return semua
  return semua.filter(e => [e.nama, clientNama(e.clientId), e.jenis, e.tanggal].join(' ').toLowerCase().includes(s))
})
const clientNama = (cid: string) => st.value.clients.find(c => c.id === cid)?.nama ?? '—'
/** Month separators when listing by date, like the old table. */
const fmtBulan = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
const grupBulan = computed(() => {
  const m = new Map<string, EventMkt[]>()
  for (const e of daftar.value) {
    const k = String(e.tanggal ?? '').slice(0, 7) || 'tanpa-tanggal'
    const l = m.get(k) ?? []
    l.push(e)
    m.set(k, l)
  }
  return [...m.entries()].map(([k, items]) => ({ k, label: k === 'tanpa-tanggal' ? 'Tanpa tanggal' : fmtBulan(k), items }))
})
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
            :to="urlBerkasMkt(String(pdfSendiri.key))"
            target="_blank"
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
        <AppPanel>
          <template #head>
            <UInput
              v-model="q"
              placeholder="Cari nama event, klien, jenis, atau tanggal…"
              icon="i-lucide-search"
              class="w-full"
            />
          </template>
          <div
            v-for="g in grupBulan"
            :key="g.k"
          >
            <p class="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-muted">
              {{ g.label }}
            </p>
            <div class="hidden lg:block">
              <UTable
                :data="g.items"
              :columns="[
                { accessorKey: 'nama', header: 'Event' },
                { accessorKey: 'clientId', header: 'Client' },
                { accessorKey: 'tanggal', header: 'Tanggal' },
                { accessorKey: 'status', header: 'Status' },
                { id: 'aksi', header: 'Generate' },
              ]"
            >
              <template #nama-cell="{ row }">
                <NuxtLink
                  :to="`/marketing/event/${row.original.id}`"
                  class="text-primary-700 underline"
                >
                  {{ row.original.nama }}
                </NuxtLink>
              </template>
              <template #clientId-cell="{ row }">
                {{ clientNama(row.original.clientId) }}
              </template>
              <template #aksi-cell="{ row }">
                <div class="flex gap-1">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    label="Internal"
                    @click="keDok(row.original.id, 'internal')"
                  />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    label="Client"
                    @click="keDok(row.original.id, 'client')"
                  />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    label="Draft"
                    @click="keDok(row.original.id, 'quote')"
                  />
                </div>
              </template>
            </UTable>
          </div>
          </div>
          <AppList
            class="lg:hidden"
          >
            <template
              v-for="g in grupBulan"
              :key="g.k"
            >
              <p class="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-muted">
                {{ g.label }}
              </p>
              <AppListRow
                v-for="e in g.items"
                :key="e.id"
                :title="e.nama"
                :description="`${clientNama(e.clientId)} · ${e.tanggal ?? ''} · ${e.status}`"
              >
              <template #trailing>
                <div class="flex gap-1">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    label="Internal"
                    @click="keDok(e.id, 'internal')"
                  />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    label="Client"
                    @click="keDok(e.id, 'client')"
                  />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    label="Draft"
                    @click="keDok(e.id, 'quote')"
                  />
                </div>
              </template>
            </AppListRow>
            </template>
          </AppList>
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
