<!--
  Event Pipeline — kanban of the five stages plus a table view
  (`event/index.html:4762-4887`).

  Rules (F.2): Planning → Upcoming is FORBIDDEN here (only through management
  approval); only manajemen may pull an event back to Planning; Event Done
  locks the data. Drag works with mouse; on touch each card carries an
  explicit "Pindah ke" picker instead. Done events auto-complete by date
  (`autoSelesaikanEvent :4887`) — shown, not written, from here.
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
const me = useMe()
const peran = computed(() => peranEvent(me.value))
const bolehUbah = computed(() => bolehUbahEvent('pipeline', peran.value))
const manajemen = computed(() => bolehSetujui(peran.value))

const tab = ref<'kanban' | 'tabel'>('kanban')
const { data: daftar, status, refresh } = useDaftarEvent<Acara>('events', {}, 'event-pipeline')

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

// Drag & drop (mouse only; touch uses the picker above)
function seretMulai(ev: DragEvent, id: string) {
  ev.dataTransfer?.setData('text/plain', id)
}
async function jatuhkan(ev: DragEvent, tahap: string) {
  ev.preventDefault()
  const id = ev.dataTransfer?.getData('text/plain')
  const e = daftar.value.rows.find(x => x.id === id)
  if (!e || String(e.status) === tahap) return
  const tolak = larangan(e, tahap)
  if (tolak) {
    toast.add({ title: tolak, color: 'error' })
    return
  }
  pindah.value = { id: e.id, ke: tahap }
  await jalankanPindah()
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
      <AppStatGrid class="mb-4 lg:grid-cols-6">
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
        />
      </AppStatGrid>

      <div
        v-if="tab === 'kanban'"
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-5"
      >
        <AppPanel
          v-for="s in EVT_STATUS"
          :key="s"
          :title="`${s} (${(perTahap.get(s) ?? []).length})`"
          :icon="STATUS_IKON_EVENT[s]"
          class="rounded-xl"
          @dragover.prevent
          @drop="jatuhkan($event, s)"
        >
          <!-- Each stage scrolls on its own: a full column never pushes the others down. -->
          <div class="max-h-[60vh] overflow-y-auto pr-0.5">
            <ul class="space-y-2">
              <li
                v-for="e in (perTahap.get(s) ?? [])"
                :key="e.id"
                :draggable="bolehUbah"
                class="rounded-lg border border-default bg-muted/40 p-2.5"
                @dragstart="seretMulai($event, e.id)"
              >
                <ULink
                  :to="`/event/events/${e.id}`"
                  class="block truncate text-sm font-semibold text-highlighted hover:text-primary-700"
                >
                  {{ e.title }}
                </ULink>
                <span class="mt-0.5 block truncate text-xs text-muted">{{ fmtTglJamEms(e.start_datetime) }}{{ e.venue ? ` · ${e.venue}` : '' }}</span>
                <USelect
                  v-if="bolehUbah"
                  :model-value="undefined"
                  :items="EVT_STATUS.filter(t => t !== e.status).map(t => ({ value: t as string, label: `Pindah ke ${t}` }))"
                  placeholder="Pindah ke…"
                  size="sm"
                  class="mt-1.5 w-full"
                  @update:model-value="(v) => { pindah = { id: e.id, ke: String(v) }; jalankanPindah() }"
                />
              </li>
            </ul>
            <p
              v-if="!(perTahap.get(s) ?? []).length"
              class="py-4 text-center text-xs text-dimmed"
            >
              Kosong
            </p>
          </div>
        </AppPanel>
      </div>

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
