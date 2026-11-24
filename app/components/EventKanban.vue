<script setup lang="ts">
import type { Acara } from '~/composables/useEvent'
import { patchEvent, useDaftarEvent } from '~/composables/useEvent'
import { EVT_STATUS, fmtTglJamEms } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehSetujui, bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { STATUS_IKON_EVENT, STATUS_WARNA_EVENT } from '~/utils/status-event'
import { tanganiKonflik } from '~/utils/versi'

const toast = useToast()
const router = useRouter()
const me = useMe()
const peran = computed(() => peranEvent(me.value))
const bolehUbah = computed(() => bolehUbahEvent('events', peran.value))
const manajemen = computed(() => bolehSetujui(peran.value))

const { data: daftar, error, status, refresh } = useDaftarEvent<Acara>('events', {}, 'event-pipeline')

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

/** Board columns for AppKanban (same order as the old manual grid). */
const kolomKanban = computed(() => EVT_STATUS.map(s => ({ id: s, title: s, items: perTahap.value.get(s) ?? [] })))

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
  if (!bolehUbah.value || !e || !ke || String(e.status) === ke) {
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
  if (!bolehUbah.value || !e || String(e.status) === p.to) return
  const tolak = larangan(e, p.to)
  if (tolak) {
    toast.add({ title: tolak, color: 'error' })
    return
  }
  pindah.value = { id: e.id, ke: p.to }
}
</script>

<template>
  <UAlert
    v-if="error"
    color="error"
    variant="soft"
    :title="apiErrorMessage(error)"
  />
  <USkeleton
    v-else-if="status === 'pending' && !daftar.rows.length"
    class="h-40 w-full"
  />
  <AppKanban
    v-else
    :columns="kolomKanban"
    :can-drag="bolehUbah"
    drag-reason="Kamu tidak punya izin mengubah tahap event."
    layout="scroll"
    :col-min="210"
    list-class="max-h-[min(68dvh,640px)]"
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
        loading-auto
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
</template>
