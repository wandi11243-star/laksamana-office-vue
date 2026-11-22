<!--
  Quick decision sheets opened when clicking a table on the day-of map:
    1. Booked for later (> 1h): open booker's detail or seat a temporary walk-in.
    2. Waiting list offer: seat a queued guest before opening a new walk-in.
    3. Sharing table: inspect/manage existing parties or add another walk-in party.
-->
<script setup lang="ts">
import type { Master, Reservasi, Waitlist } from '~/composables/useReservasi'
import { fmtMenit, isSeated, tableFill } from '~/utils/kunci-meja'
import { capMax, cariMeja } from '~/utils/venue-layouts'
import { tglPendek } from '~/utils/format'

const props = defineProps<{
  mejaDipesan: { meja: string, res: Reservasi, lain: number, menit: number } | null
  tawarMeja: string
  tawarBooking?: { res: Reservasi, menit: number, lain: number } | null
  calon: Waitlist[]
  mejaSharing: string
  partaiSharing: Reservasi[]
  master: Master
  bolehEdit: boolean
  saringAktif: boolean
}>()

const emit = defineEmits<{
  bukaPemesan: [resId: string]
  walkinDariDipesan: [meja: string]
  dudukkanDariTawar: [w: Waitlist]
  walkinDariTawar: [meja: string]
  kelolaPartai: [r: Reservasi]
  tambahKeSharing: [meja: string, sisa: number]
}>()

const openDipesan = defineModel<boolean>('openDipesan', { default: false })
const openTawar = defineModel<boolean>('openTawar', { default: false })
const openSharing = defineModel<boolean>('openSharing', { default: false })

const sisaWaktu = (m: number) => (m > 0 ? `${fmtMenit(m)} lagi` : `jamnya sudah lewat ${fmtMenit(-m)}`)
const tunggu = (w: Waitlist) => Math.max(0, Math.round((Date.now() - (w.addedAt || 0)) / 60000))

const kapasitasTawar = computed(() => {
  const me = cariMeja(props.master, props.tawarMeja)
  return me ? capMax(me.t.cap) : 0
})

/** Queue entries that fit the table first, then longest waiting. */
const calonTawar = computed(() => props.calon
  .map(w => ({ w, muat: !kapasitasTawar.value || (Number(w.pax) || 0) <= kapasitasTawar.value }))
  .sort((a, b) => (a.muat === b.muat ? (a.w.addedAt || 0) - (b.w.addedAt || 0) : a.muat ? -1 : 1)))

const sisaSharing = computed(() => {
  const me = cariMeja(props.master, props.mejaSharing)
  return me ? tableFill(me.t, props.partaiSharing, id => capMax(cariMeja(props.master, id)?.t.cap)).sisaMax : 0
})
</script>

<template>
  <div>
    <ResponsiveSheet
      v-model:open="openDipesan"
      :title="`Meja ${mejaDipesan?.meja ?? ''} — sudah dipesan`"
    >
      <div
        v-if="mejaDipesan"
        class="space-y-3"
      >
        <p class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-default">
          Dipesan <b>{{ mejaDipesan.res.name }}</b> — {{ tglPendek(mejaDipesan.res.date) }} jam <b>{{ mejaDipesan.res.time }}</b>,
          {{ mejaDipesan.res.pax }} pax ({{ sisaWaktu(mejaDipesan.menit) }}){{ mejaDipesan.lain ? ` · +${mejaDipesan.lain} reservasi lain di meja ini` : '' }}.
          Mejanya masih kosong. Terkunci sendiri begitu tinggal {{ fmtMenit(60) }} menjelang jamnya.
        </p>
        <UButton
          block
          size="xl"
          icon="i-lucide-clipboard-list"
          class="justify-start"
          @click="emit('bukaPemesan', mejaDipesan.res.id)"
        >
          <span class="text-left">
            <b>Buka reservasi {{ mejaDipesan.res.name }}</b><br>
            <span class="text-sm font-normal">Tamu pemesan datang lebih cepat — tandai Datang langsung di meja ini</span>
          </span>
        </UButton>
        <UButton
          v-if="bolehEdit"
          block
          size="xl"
          color="neutral"
          variant="soft"
          icon="i-lucide-footprints"
          class="justify-start"
          @click="emit('walkinDariDipesan', mejaDipesan.meja)"
        >
          <span class="text-left">
            <b>Walk-in baru (duduk sementara)</b><br>
            <span class="text-sm font-normal">Tamu lain, harus selesai sebelum jam {{ mejaDipesan.res.time }}</span>
          </span>
        </UButton>
      </div>
      <template #footer>
        <UButton
          label="Batal"
          color="neutral"
          variant="soft"
          size="xl"
          @click="openDipesan = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="openTawar"
      :title="`Meja ${tawarMeja} kosong — pilih tamu dari antrean`"
    >
      <div class="space-y-3">
        <p
          v-if="tawarBooking"
          class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-default"
        >
          Meja ini <b>sudah dipesan</b> {{ tawarBooking.res.name }} jam
          <b>{{ tglPendek(tawarBooking.res.date) }} {{ tawarBooking.res.time }}</b>
          ({{ sisaWaktu(tawarBooking.menit) }}, {{ tawarBooking.res.pax }} pax).
          Pastikan mejanya kosong lagi sebelum jamnya.
        </p>
        <p class="text-sm text-muted">
          Kapasitas <b>{{ tawarMeja }}</b>: <b>{{ kapasitasTawar || '-' }} orang</b>.
          <template v-if="calonTawar.some(c => c.muat)">
            <b>{{ calonTawar.filter(c => c.muat).length }}</b> tamu di antrean muat di meja ini (paling atas). Yang paling lama menunggu didahulukan.
          </template>
          <template v-else>
            Tidak ada tamu antrean yang muat. Kamu tetap bisa memaksa mendudukkan atau pakai walk-in baru.
          </template>
        </p>
        <AppList title="Antrean">
          <AppListRow
            v-for="(c, i) in calonTawar"
            :key="c.w.id"
            :title="`${i + 1}. ${c.w.name} — ${c.w.pax} orang`"
            :description="`menunggu ${fmtMenit(tunggu(c.w))}${c.w.phone ? ` · ${c.w.phone}` : ''}${c.w.note ? ` · ${c.w.note}` : ''}${c.muat ? '' : ` · lebih dari kapasitas (${kapasitasTawar})`}`"
            :icon="c.muat ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert'"
          >
            <template #trailing>
              <UButton
                label="Dudukkan"
                size="lg"
                loading-auto
                @click="emit('dudukkanDariTawar', c.w)"
              />
            </template>
          </AppListRow>
        </AppList>
      </div>
      <template #footer>
        <UButton
          label="Walk-in baru (bukan dari antrean)"
          color="neutral"
          variant="soft"
          size="xl"
          @click="emit('walkinDariTawar', tawarMeja)"
        />
        <UButton
          label="Tutup"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="openTawar = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="openSharing"
      :title="`Meja ${mejaSharing}, sharing (${partaiSharing.length} grup)`"
    >
      <div class="space-y-3">
        <AppList title="Grup di meja ini">
          <AppListRow
            v-for="r in partaiSharing"
            :key="r.id"
            :title="r.name"
            :description="`${r.time}, ${r.pax} pax · ${r.status}${isSeated(r) ? ' · sedang duduk' : ''}`"
            icon="i-lucide-users"
          >
            <template #trailing>
              <UButton
                label="Kelola"
                size="lg"
                color="neutral"
                variant="soft"
                @click="emit('kelolaPartai', r)"
              />
            </template>
          </AppListRow>
        </AppList>
        <p
          v-if="bolehEdit && saringAktif"
          class="text-sm text-muted"
        >
          Bersihkan filter dulu untuk menambah tamu ke meja sharing.
        </p>
      </div>
      <template #footer>
        <UButton
          v-if="bolehEdit && !saringAktif"
          :label="`Tambah tamu (walk-in)${sisaSharing ? ` · sisa ${sisaSharing} kursi` : ''}`"
          size="xl"
          @click="emit('tambahKeSharing', mejaSharing, sisaSharing)"
        />
        <UButton
          label="Tutup"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="openSharing = false"
        />
      </template>
    </ResponsiveSheet>
  </div>
</template>
