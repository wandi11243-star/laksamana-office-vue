<!--
  Quick decision sheets opened when clicking a table on the day-of map:
    1. Booked for later (> 1h): open booker's detail or seat a temporary walk-in.
    2. Sharing table: inspect/manage existing parties or add another walk-in party.
-->
<script setup lang="ts">
import type { Master, Reservasi } from '~/composables/useReservasi'
import { fmtMenit, isSeated, tableFill } from '~/utils/kunci-meja'
import { capMax, cariMeja } from '~/utils/venue-layouts'
import { tglPendek } from '~/utils/format'

const props = defineProps<{
  mejaDipesan: { meja: string, res: Reservasi, lain: number, menit: number } | null
  mejaSharing: string
  partaiSharing: Reservasi[]
  master: Master
  bolehEdit: boolean
  saringAktif: boolean
}>()

const emit = defineEmits<{
  bukaPemesan: [resId: string]
  walkinDariDipesan: [meja: string]
  kelolaPartai: [r: Reservasi]
  tambahKeSharing: [meja: string, sisa: number]
}>()

const openDipesan = defineModel<boolean>('openDipesan', { default: false })
const openSharing = defineModel<boolean>('openSharing', { default: false })

const sisaWaktu = (m: number) => (m > 0 ? `${fmtMenit(m)} lagi` : `jamnya sudah lewat ${fmtMenit(-m)}`)
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
            <span class="text-sm font-normal normal-case">Tamu pemesan datang lebih cepat — tandai Datang langsung di meja ini</span>
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
            <span class="text-sm font-normal normal-case">Tamu lain, harus selesai sebelum jam {{ mejaDipesan.res.time }}</span>
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
