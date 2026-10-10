<!--
  Perencanaan Event — plans not yet approved, with the Event History tab
  (`event/index.html:5845-5927`).

  Submission states (F.3): Belum diajukan → Menunggu (stage Prospect) →
  approved/rejected (stage Approval). `ajukanRencana` requires title, date
  and venue (`:4691`). Approving/rejecting is manajemen only. The removed
  Idea Bank tab lives at /event/ideas; its route stays (`:2036`).
-->
<script setup lang="ts">
import type { Acara, OrderTiket, Refund } from '~/composables/useEvent'
import { createEvent, patchEvent, removeEvent, useDaftarEvent } from '~/composables/useEvent'
import { statusPengajuan, tglWIB } from '~/utils/event-hitung'
import { refundGantung } from '~/utils/event-refund'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehSetujui, bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { angka, tglPanjang } from '~/utils/format'
import { PENGAJUAN_IKON, PENGAJUAN_WARNA } from '~/utils/status-event'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const namaSaya = computed(() => me.value?.name ?? '')
const peran = computed(() => peranEvent(me.value))
const bolehUbah = computed(() => bolehUbahEvent('planning', peran.value))
const manajemen = computed(() => bolehSetujui(peran.value))

const tab = ref<'rencana' | 'riwayat'>('rencana')
const saring = ref<'semua' | 'belum' | 'menunggu' | 'ditolak'>('semua')

const { data: daftar, status, refresh } = useDaftarEvent<Acara>('events', {}, 'event-planning')

const rencana = computed(() => daftar.value.rows.filter(e => ['Planning', 'Prospect'].includes(String(e.status))))
const menungguSaya = computed(() => rencana.value.filter(e => statusPengajuan({ pengajuan: e.pengajuan }) === 'Menunggu').length)

const tampil = computed(() => rencana.value.filter((e) => {
  const st = statusPengajuan({ pengajuan: e.pengajuan })
  if (saring.value === 'belum') return st === 'Belum diajukan'
  if (saring.value === 'menunggu') return st === 'Menunggu'
  if (saring.value === 'ditolak') return st === 'Ditolak'
  return true
}).sort((a, b) => String(b.start_datetime ?? '').localeCompare(String(a.start_datetime ?? ''))))

const hitung = computed(() => ({
  semua: rencana.value.length,
  belum: rencana.value.filter(e => statusPengajuan({ pengajuan: e.pengajuan }) === 'Belum diajukan').length,
  menunggu: menungguSaya.value,
  ditolak: rencana.value.filter(e => statusPengajuan({ pengajuan: e.pengajuan }) === 'Ditolak').length,
}))

// History tab (archived Done/Finished events, read-only cards)
const arsip = computed(() => daftar.value.rows
  .filter(e => ['Event Done', 'Finished'].includes(String(e.status)))
  .sort((a, b) => String(b.start_datetime ?? '').localeCompare(String(a.start_datetime ?? ''))))

// --- new plan (`eventForm(null,{status:'Planning'})`) ---
const sheetBaru = ref(false)
const route = useRoute()
watch(() => route.query, (q) => {
  if (q.baru !== undefined && bolehUbah.value) sheetBaru.value = true
}, { immediate: true })

async function simpanBaru(body: Record<string, unknown>) {
  sheetBaru.value = false
  try {
    await createEvent('events', {
      ...body,
      status: 'Planning',
      createdBy: namaSaya.value,
      createdById: me.value?.id ?? '',
      createdAt: Date.now(),
    })
    toast.add({ title: 'Rencana baru dibuat', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

async function ajukan(e: Acara) {
  if (String(e.status) !== 'Planning') {
    toast.add({ title: 'Hanya rencana yang bisa diajukan.', color: 'error' })
    return
  }
  if (!e.title || !e.start_datetime || !e.venue) {
    toast.add({ title: 'Lengkapi dulu judul, tanggal, dan venue sebelum diajukan.', color: 'error' })
    return
  }
  try {
    await patchEvent('events', e.id, {
      status: 'Prospect',
      pengajuan: { status: 'Menunggu', oleh: namaSaya.value, pada: Date.now() },
      updatedAt: Date.now(),
    }, daftar.value.versions[e.id])
    toast.add({ title: 'Rencana diajukan ke manajemen', color: 'success' })
    await refresh()
  }
  catch (err) {
    if (!(await tanganiKonflik(err, refresh))) toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}

async function putuskan(e: Acara, setuju: boolean) {
  try {
    await patchEvent('events', e.id, {
      status: setuju ? 'Approval' : 'Planning',
      pengajuan: { ...(e.pengajuan ?? {}), status: setuju ? 'Disetujui' : 'Ditolak', oleh: namaSaya.value, pada: Date.now() },
      statusAt: Date.now(),
      updatedAt: Date.now(),
    }, daftar.value.versions[e.id])
    toast.add({ title: setuju ? 'Rencana disetujui' : 'Rencana ditolak', color: 'success' })
    await refresh()
  }
  catch (err) {
    if (!(await tanganiKonflik(err, refresh))) toast.add({ title: apiErrorMessage(err), color: 'error' })
  }
}

const hapusId = ref('')
const sheetHapus = computed({ get: () => hapusId.value !== '', set: v => (hapusId.value = v ? hapusId.value : '') })
// Same guard as the event list (`hapusEvent :3024`): a plan that already sold
// tickets keeps its paid orders, and a hanging refund is named as the reason.
const { data: daftarOrder } = useDaftarEvent<OrderTiket>('orders', {}, 'event-planning-orders')
const { data: daftarRefund } = useDaftarEvent<Refund>('refunds', {}, 'event-planning-refunds')
const infoHapus = computed(() => {
  const lunas = daftarOrder.value.rows.filter(o => o.event_id === hapusId.value && o.payment_status === 'Paid')
  const gantungN = lunas.filter(o => daftarRefund.value.rows.some(r => r.order_id === o.id && refundGantung(r, o))).length
  return {
    judul: daftar.value.rows.find(e => e.id === hapusId.value)?.title ?? '',
    lunas: lunas.length,
    gantung: gantungN,
  }
})
async function hapus() {
  const id = hapusId.value
  sheetHapus.value = false
  if (!id || infoHapus.value.lunas) return
  try {
    await removeEvent('events', id, daftar.value.versions[id])
    toast.add({ title: 'Rencana dihapus', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Perencanaan event"
    description="Rencana yang belum disetujui manajemen"
  >
    <template #actions>
      <UButton
        to="/event/ideas"
        color="neutral"
        variant="outline"
        icon="i-lucide-lightbulb"
      >
        Bank ide
      </UButton>
      <UButton
        v-if="bolehUbah"
        color="primary"
        icon="i-lucide-plus"
        @click="sheetBaru = true"
      >
        Rencana baru
      </UButton>
    </template>

    <div class="mb-4">
      <AppSeg
        v-model="tab"
        :options="[{ value: 'rencana', label: 'Perencanaan' }, { value: 'riwayat', label: 'Event history' }]"
      />
    </div>

    <template v-if="tab === 'rencana'">
      <p
        v-if="manajemen && menungguSaya"
        class="mb-3 rounded-field bg-warning/12 px-3 py-2 text-sm font-medium text-warning"
      >
        {{ menungguSaya }} rencana menunggu keputusanmu.
      </p>
      <AppChips
        v-model="saring"
        :options="[
          { value: 'semua', label: `Semua (${hitung.semua})` },
          { value: 'belum', label: `Belum diajukan (${hitung.belum})` },
          { value: 'menunggu', label: `Menunggu keputusan (${hitung.menunggu})` },
          { value: 'ditolak', label: `Ditolak (${hitung.ditolak})` },
        ]"
        class="mb-3"
      />
      <div
        v-if="status === 'pending'"
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <USkeleton
          v-for="i in 3"
          :key="i"
          class="h-36"
        />
      </div>
      <div
        v-else
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <AppPanel
          v-for="e in tampil"
          :key="e.id"
        >
          <ULink
            :to="`/event/events/${e.id}`"
            class="block truncate text-base font-bold text-highlighted hover:text-primary-700"
          >
            {{ e.title }}
          </ULink>
          <p class="mt-0.5 text-xs text-muted">
            {{ tglPanjang(tglWIB(e.start_datetime)) }} · {{ e.venue || '—' }}
          </p>
          <p class="mt-1.5">
            <AppStatus
              :color="PENGAJUAN_WARNA[statusPengajuan({ pengajuan: e.pengajuan })] ?? 'neutral'"
              :icon="PENGAJUAN_IKON[statusPengajuan({ pengajuan: e.pengajuan })]"
              size="sm"
            >
              {{ statusPengajuan({ pengajuan: e.pengajuan }) }}
            </AppStatus>
          </p>
          <div class="mt-2.5 flex flex-wrap gap-1.5">
            <UButton
              :to="`/event/events/${e.id}`"
              color="neutral"
              variant="outline"
              size="sm"
            >
              Buka
            </UButton>
            <UButton
              v-if="bolehUbah && statusPengajuan({ pengajuan: e.pengajuan }) !== 'Menunggu'"
              color="neutral"
              variant="outline"
              size="sm"
              @click="ajukan(e)"
            >
              Ajukan ke manajemen
            </UButton>
            <template v-if="manajemen && statusPengajuan({ pengajuan: e.pengajuan }) === 'Menunggu'">
              <UButton
                color="success"
                size="sm"
                @click="putuskan(e, true)"
              >
                Setujui
              </UButton>
              <UButton
                color="error"
                variant="outline"
                size="sm"
                @click="putuskan(e, false)"
              >
                Tolak
              </UButton>
            </template>
            <UButton
              v-if="bolehUbah"
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-trash-2"
              @click="hapusId = e.id"
            />
          </div>
        </AppPanel>
      </div>
      <p
        v-if="!tampil.length && status !== 'pending'"
        class="py-10 text-center text-sm text-dimmed"
      >
        Belum ada rencana di saringan ini.
      </p>
    </template>

    <template v-else>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AppPanel
          v-for="e in arsip"
          :key="e.id"
        >
          <ULink
            :to="`/event/history/${e.id}`"
            class="block truncate text-base font-bold text-highlighted hover:text-primary-700"
          >
            {{ e.title }}
          </ULink>
          <p class="mt-0.5 text-xs text-muted">
            {{ tglPanjang(tglWIB(e.start_datetime)) }} · {{ e.venue || '—' }}
          </p>
        </AppPanel>
      </div>
      <p
        v-if="!arsip.length && status !== 'pending'"
        class="py-10 text-center text-sm text-dimmed"
      >
        Arsip masih kosong.
      </p>
      <UButton
        to="/event/history"
        color="neutral"
        variant="outline"
        icon="i-lucide-history"
        class="mt-3"
      >
        Buka arsip lengkap
      </UButton>
    </template>

    <ResponsiveSheet
      v-model:open="sheetBaru"
      title="Rencana baru"
    >
      <EventForm
        :pic-terkunci="namaSaya"
        @simpan="simpanBaru($event)"
        @batal="sheetBaru = false"
      />
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="sheetHapus"
      title="Hapus rencana?"
    >
      <template v-if="infoHapus.lunas">
        <p class="text-sm text-muted">
          Rencana <b class="text-highlighted">{{ infoHapus.judul }}</b> sudah punya
          <b class="text-highlighted num">{{ angka(infoHapus.lunas) }} pesanan lunas</b>.
          Menghapusnya berarti menghapus jejak uang yang benar-benar masuk.
        </p>
        <p
          v-if="infoHapus.gantung"
          class="mt-2 text-sm text-muted"
        >
          <b class="text-highlighted num">{{ angka(infoHapus.gantung) }}</b> di antaranya refundnya sudah
          disetujui tapi belum diselesaikan — buka Ticketing › Penjualan lalu tekan Selesaikan refund (manajemen).
        </p>
        <p class="mt-2 text-sm text-muted">
          Kalau acaranya batal, selesaikan lewat refund pada pesanan itu dulu.
        </p>
      </template>
      <p
        v-else
        class="text-sm text-muted"
      >
        Rencana ini dihapus permanen.
      </p>
      <template #footer>
        <UButton
          v-if="!infoHapus.lunas"
          color="error"
          @click="hapus()"
        >
          Ya, hapus
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          @click="sheetHapus = false"
        >
          {{ infoHapus.lunas ? 'Tutup' : 'Batal' }}
        </UButton>
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
