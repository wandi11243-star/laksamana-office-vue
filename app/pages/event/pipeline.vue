<!--
  Event Pipeline — shared AppKanban board over the five stages plus a table
  view (`event/index.html:4762-4887`).

  Rules (F.2): Planning → Upcoming is FORBIDDEN here (only through management
  approval); only manajemen may pull an event back to Planning; Event Done
  locks the data. Drag state lives in AppKanban (mouse only by design).
  Guards (`larangan`) + the confirm sheet stay here. Done events
  auto-complete by date (`autoSelesaikanEvent :4887`) — shown, not written,
  from here. Cards are born in the events module, so the board has no
  add-card footer.
-->
<script setup lang="ts">
import type { Acara } from '~/composables/useEvent'
import { patchEvent, useDaftarEvent } from '~/composables/useEvent'
import { EVT_STATUS, fmtTglJamEms } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehSetujui, bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka } from '~/utils/format'
import { STATUS_IKON_EVENT, STATUS_WARNA_EVENT } from '~/utils/status-event'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const router = useRouter()
const me = useMe()
const peran = computed(() => peranEvent(me.value))
const bolehUbah = computed(() => bolehUbahEvent('pipeline', peran.value))
const manajemen = computed(() => bolehSetujui(peran.value))

const tab = ref<'kanban' | 'tabel'>('kanban')
const { data: daftar, status, refresh } = useDaftarEvent<Acara>('events', {}, 'event-pipeline')

/** First-load skeleton for the stage cards below (one total plus one per
 *  stage): skeleton cells stand in until the first list lands. Refetch keeps
 *  old numbers, so moving a card never blanks the row. */
const statMemuat = computed(() => !daftar.value.rows.length && (status.value === 'pending' || status.value === 'idle'))

const perTahap = computed(() => {
  const m = new Map<string, Acara[]>()
  for (const s of EVT_STATUS) m.set(s, [])
  for (const e of daftar.value.rows) {
    const l = m.get(String(e.status)) ?? []
    l.push(e)
    m.set(String(e.status), l)
  }
  // each column runs by date, earliest first (renderPipelineEms :4805)
  for (const l of m.values()) l.sort((a, b) => String(a.start_datetime ?? '').localeCompare(String(b.start_datetime ?? '')))
  return m
})
const tabelUrut = computed(() => daftar.value.rows.slice().sort((a, b) => String(b.start_datetime ?? '').localeCompare(String(a.start_datetime ?? ''))))

/** Board columns for AppKanban (same order as the old manual grid). */
const kolomKanban = computed(() => EVT_STATUS.map(s => ({ id: s, title: s, items: perTahap.value.get(s) ?? [] })))

/** AppStat has no neutral tone: a plain count is gold (same as dashboard). */
const toneKartu = (st: string) => STATUS_WARNA_EVENT[st] === 'neutral' ? 'gold' : STATUS_WARNA_EVENT[st]!

/** Move rules (`pindahTahapEms :4847`, F.2). Returns the refusal text, if any. */
function larangan(e: Acara, tahap: string): string | null {
  if (String(e.status) === 'Event Done') return 'Event done mengunci data.'
  if (String(e.status) === 'Planning' && tahap === 'Upcoming') return 'Rencana hanya naik ke Upcoming lewat persetujuan manajemen.'
  if (tahap === 'Planning' && !manajemen.value) return 'Hanya manajemen yang bisa menarik event kembali ke Perencanaan.'
  return null
}

const pindah = ref<{ id: string, ke: string }>({ id: '', ke: '' })
const sheetPindah = computed({ get: () => pindah.value.id !== '', set: v => (pindah.value = v ? pindah.value : { id: '', ke: '' }) })
const acaraPindah = computed(() => daftar.value.rows.find(e => e.id === pindah.value.id) ?? null)

async function jalankanPindah() {
  const e = acaraPindah.value
  const ke = pindah.value.ke
  if (!e || !ke || String(e.status) === ke) {
    sheetPindah.value = false
    return
  }
  const tolak = larangan(e, ke)
  if (tolak) {
    toast.add({ title: tolak, color: 'error' })
    return
  }
  sheetPindah.value = false
  try {
    await patchEvent('events', e.id, { status: ke, statusAt: Date.now(), updatedAt: Date.now() }, daftar.value.versions[e.id])
    toast.add({ title: `${e.title} → ${ke}`, color: 'success' })
    await refresh()
  }
  catch (err) {
    if (!(await tanganiKonflik(err, refresh))) toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}

// ---- board moves (drag state lives in AppKanban; guards + sheet stay here) ----
function alihKartu(id: string, telan: () => boolean) {
  // A click fires right after a drop on the same card — swallow it once.
  if (telan()) return
  router.push(`/event/events/${id}`)
}
/** Drop on a column: guard first,
 *  then open the confirm sheet — saving happens in jalankanPindah(). */
function pindahMinta(p: { id: string, to: string }) {
  const e = daftar.value.rows.find(x => x.id === p.id)
  if (!e || String(e.status) === p.to) return
  const tolak = larangan(e, p.to)
  if (tolak) {
    toast.add({ title: tolak, color: 'error' })
    return
  }
  pindah.value = { id: e.id, ke: p.to }
}
</script>

<template>
  <EventGerbang lihat="pipeline">
    <AppPage
      title="Event pipeline"
      description="Geser kartu antar tahap saat statusnya berubah"
    >
      <AppSeg
        v-model="tab"
        class="mb-4"
        :options="[{ value: 'kanban', label: 'Kanban Pipeline', icon: 'i-lucide-kanban-square' }, { value: 'tabel', label: 'Tabel Event', icon: 'i-lucide-table' }]"
      />

      <!-- pipe-sum: Total + one tile per stage -->
      <AppStatGrid
        class="mb-4 lg:grid-cols-6"
        :loading="statMemuat"
        :count="6"
      >
        <AppStat
          label="Total Event"
          :value="angka(daftar.rows.length)"
          sub="seluruh tahap"
          icon="i-lucide-layers"
          tone="gold"
        />
        <AppStat
          v-for="s in EVT_STATUS"
          :key="s"
          :label="s"
          :value="angka((perTahap.get(s) ?? []).length)"
          sub="event"
          :icon="STATUS_IKON_EVENT[s]"
          :tone="toneKartu(s)"
        />
      </AppStatGrid>

      <AppKanban
        v-if="tab === 'kanban'"
        :columns="kolomKanban"
        :can-drag="bolehUbah"
        drag-reason="Kamu tidak punya izin mengubah tahap event."
        layout="scroll"
        empty-text="Kosong"
        @move="pindahMinta"
      >
        <template #header="{ column }">
          <AppStatus
            :color="STATUS_WARNA_EVENT[column.id] ?? 'neutral'"
            :icon="STATUS_IKON_EVENT[column.id]"
            size="sm"
          >
            {{ column.title }}
          </AppStatus>
          <span class="num ml-auto rounded-full bg-muted px-2 text-xs font-bold">{{ column.items.length }}</span>
        </template>
        <template #card="{ item, dragging, canDrag: bolehSeret, dragReason: alasanSeret, dragStart, dragEnd, swallowClick }">
          <AppKanbanCard
            :dragging="dragging"
            :can-drag="bolehSeret"
            :drag-reason="alasanSeret"
            @dragstart="dragStart"
            @dragend="dragEnd"
            @card-click="alihKartu(item.id, swallowClick)"
          >
            <template #title>
              <p class="truncate text-sm font-semibold text-highlighted">
                {{ item.title || '(tanpa judul)' }}
              </p>
            </template>
            <template #meta>
              <p class="mt-0.5 truncate text-xs text-muted">
                {{ fmtTglJamEms(item.start_datetime) }}{{ item.venue ? ` · ${item.venue}` : '' }}
              </p>
            </template>
          </AppKanbanCard>
        </template>
      </AppKanban>

      <AppPanel
        v-else
        flush
      >
        <UTable
          :columns="[{ id: 'acara', header: 'Event' }, { id: 'tanggal', header: 'Tanggal' }, { id: 'venue', header: 'Venue' }, { id: 'pic', header: 'PIC' }, { id: 'status', header: 'Tahap' }]"
          :data="tabelUrut"
          :loading="status === 'pending'"
        >
          <template #acara-cell="{ row }">
            <ULink
              :to="`/event/events/${row.original.id}`"
              class="block hover:text-primary-700"
            >
              <b class="block text-highlighted">{{ row.original.title || '(tanpa judul)' }}</b>
              <span class="block text-xs text-muted">{{ row.original.category }}</span>
            </ULink>
          </template>
          <template #tanggal-cell="{ row }">
            {{ fmtTglJamEms(row.original.start_datetime) }}
          </template>
          <template #venue-cell="{ row }">
            {{ row.original.venue || '—' }}
          </template>
          <template #pic-cell="{ row }">
            {{ row.original.pic || '—' }}
          </template>
          <template #status-cell="{ row }">
            <AppStatus
              :color="STATUS_WARNA_EVENT[String(row.original.status)] ?? 'neutral'"
              :icon="STATUS_IKON_EVENT[String(row.original.status)]"
              size="sm"
            >
              {{ row.original.status }}
            </AppStatus>
          </template>
        </UTable>
      </AppPanel>

      <ResponsiveSheet
        v-model:open="sheetPindah"
        title="Pindahkan tahap?"
      >
        <p
          v-if="acaraPindah"
          class="text-sm"
        >
          Pindahkan <b>{{ acaraPindah.title }}</b> ke <b>{{ pindah.ke }}</b>?
        </p>
        <template #footer>
          <UButton
            color="primary"
            @click="jalankanPindah()"
          >
            Ya, pindahkan
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetPindah = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>
    </AppPage>
  </EventGerbang>
</template>
