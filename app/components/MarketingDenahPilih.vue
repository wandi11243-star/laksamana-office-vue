<!--
  Marketing › table picker on the Reservasi plan (old vipDenahHTML, :17999).
  The same DenahPeta the Reservasi crew uses — same tables, same status
  colours, same legend — so a VIP booking or an event lock names the tables
  the floor actually has (owner request, Nov 2026: the old flat table list
  "Meja 01 … Rooftop 02" did not match the plan).

  Reads the plan (date's own layout, per floor) and the reservations a day
  either side, then hands back the picked tables through v-model. Tables are
  picked across both floors; the count per floor shows on the floor buttons.
    <MarketingDenahPilih v-model="pilih" :tanggal="tgl" jam="19:00" :kecuali-id="resId" />
-->
<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { PermintaanTumpang } from '~/components/DenahPeta.vue'
import type { Reservasi } from '~/composables/useReservasi'
import { SECTION_LAYOUT } from '~/composables/useReservasi'
import { allLayoutKeys, capMax, dayTypeLayoutLt, defaultDayTypeLt, getLayout, lantaiMap } from '~/utils/venue-layouts'
import { tambahHari } from '~/utils/format'

const props = defineProps<{
  tanggal: string
  /** HH:MM; empty = the plan's loose rule (seated guests only). */
  jam?: string
  /** The booking's own Reservasi row — it never blocks its own tables. */
  kecualiId?: string | null
  /** Guests expected, for the capacity line under the plan. */
  pax?: number
}>()
const pilih = defineModel<string[]>({ default: () => [] })
const toast = useToast()
const desktop = useMediaQuery('(min-width: 1024px)')

const denah = useDenah()
const { master, status } = denah
/**
 * Always the plan as the Reservasi settings have it NOW: the sections are
 * cached app-wide, so a table added or moved in Atur denah & meja (maybe by
 * someone else) is read again every time the picker opens or reloads.
 */
const muatDenah = () => Promise.all(SECTION_LAYOUT.map(k => denah[k].refresh())).then(() => {})
onMounted(muatDenah)
const { data: dineEstMin } = useSection<number>('dineEstMin')
const { data: clashLeadMin } = useSection<number>('clashLeadMin')
const masterKunci = computed(() => ({
  ...master.value,
  dineEstMin: Number(dineEstMin.value) > 0 ? Number(dineEstMin.value) : undefined,
  clashLeadMin: Number(clashLeadMin.value) > 0 ? Number(clashLeadMin.value) : undefined,
}))

const lantai = ref<1 | 2>(1)
const layout = computed(() => getLayout(master.value, dayTypeLayoutLt(master.value, props.tanggal, lantai.value))
  ?? getLayout(master.value, defaultDayTypeLt(props.tanggal, lantai.value, master.value)))
const peta = computed(() => lantaiMap(master.value))
const adaLantai2 = computed(() => [...peta.value.values()].some(l => l === 2))

// The floor that holds the first picked table opens first.
watch(() => props.tanggal, () => {
  lantai.value = peta.value.get(pilih.value[0] ?? '') === 2 ? 2 : 1
}, { immediate: true })

const jumlahDi = (lt: 1 | 2) => pilih.value.filter(m => (peta.value.get(m) ?? 1) === lt || peta.value.get(m) === 0).length

const baris = ref<Reservasi[]>([])
const memuat = ref(false)
const galat = ref('')
async function muat() {
  if (!props.tanggal) return
  memuat.value = true
  galat.value = ''
  try {
    // A day either side: a 01:00 booking holds its table from the night before.
    const [rows] = await Promise.all([
      daftarReservasiSemua(tambahHari(props.tanggal, -1), tambahHari(props.tanggal, 1)),
      muatDenah(),
    ])
    baris.value = rows as unknown as Reservasi[]
  }
  catch (e) {
    galat.value = `Reservasi tidak terjangkau: ${apiErrorMessage(e)}. Meja yang sudah dipesan belum bisa ditandai.`
  }
  finally {
    memuat.value = false
  }
}
watch(() => props.tanggal, muat, { immediate: true })
defineExpose({ muat })

function toggle(m: string) {
  pilih.value = pilih.value.includes(m) ? pilih.value.filter(x => x !== m) : [...pilih.value, m]
}

/** A booked table: refused when the guest sits / the time is too close, else ask first. */
function tumpang(p: PermintaanTumpang) {
  if (p.kunci) {
    toast.add({ title: `Meja ${p.meja} tidak bisa dipakai`, description: p.pesan, color: 'error' })
    return
  }
  if (window.confirm(`${p.pesan}\n\nTetap pakai meja ${p.meja}?`)) toggle(p.meja)
}

const kapasitas = computed(() => {
  const semua = new Map<string, string>()
  for (const k of allLayoutKeys(master.value)) {
    for (const t of getLayout(master.value, k)?.tables ?? []) semua.set(String(t.id), t.cap)
  }
  for (const t of layout.value?.tables ?? []) semua.set(String(t.id), t.cap)
  return pilih.value.reduce((a, m) => a + capMax(semua.get(m)), 0)
})
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <AppSeg
        v-if="adaLantai2"
        :model-value="String(lantai)"
        size="sm"
        :options="[
          { value: '1', label: 'Lantai 1', jumlah: jumlahDi(1) || undefined },
          { value: '2', label: 'Lantai 2', jumlah: jumlahDi(2) || undefined },
        ]"
        @update:model-value="(v?: string) => { lantai = v === '2' ? 2 : 1 }"
      />
      <span class="text-sm text-muted">
        <template v-if="memuat">Memuat reservasi…</template>
        <template v-else>{{ tanggal }}{{ jam ? ` · ${jam}` : '' }}</template>
      </span>
    </div>

    <UAlert
      v-if="galat"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :description="galat"
      class="mt-2"
    />

    <p
      v-if="status === 'pending' && !layout"
      class="py-6 text-center text-sm text-muted"
    >
      Memuat denah…
    </p>
    <p
      v-else-if="!layout"
      class="mt-2 rounded-xl bg-warning/10 p-3 text-sm text-warning"
    >
      Denah Reservasi belum ada. Atur dulu di modul Reservasi › Editor denah.
    </p>
    <div
      v-else
      class="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-4"
    >
      <!-- Desktop: the plan takes the width (bounded by the screen height),
           the picked tables sit beside it instead of under it, so the sides
           are not empty and the plan is bigger (owner request, Nov 2026). -->
      <DenahPeta
        :class="desktop ? 'mx-auto w-[min(100%,calc((100vh-11rem)*1600/1160))]' : ''"
        :layout="layout"
        :fit="desktop"
        :reservasi="baris"
        :tanggal="tanggal"
        :jam="jam"
        mode="pilih"
        :terpilih="pilih"
        :kecuali-id="kecualiId ?? null"
        :master="masterKunci"
        @pilih="toggle"
        @tumpang="tumpang"
      />

      <!-- The picked tables, both floors, and how many guests they seat. -->
      <div class="mt-3 rounded-xl bg-muted p-3 lg:sticky lg:top-0 lg:mt-0">
        <div
          v-if="pilih.length"
          class="flex flex-wrap gap-1.5"
        >
          <button
            v-for="m in pilih"
            :key="m"
            type="button"
            class="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-gold-deep ring-1 ring-gold-deep hover:bg-gold-soft/70"
            :title="`Lepas meja ${m}`"
            @click="toggle(m)"
          >
            {{ m }}
            <UIcon
              name="i-lucide-x"
              class="size-3"
            />
          </button>
        </div>
        <p
          class="text-sm"
          :class="[pilih.length ? 'mt-2' : '', pax && kapasitas && kapasitas < pax ? 'text-warning' : 'text-muted']"
        >
          <template v-if="!pilih.length">
            Belum ada meja dipilih — klik meja pada denah.
          </template>
          <template v-else>
            {{ pilih.length }} meja · muat ±{{ kapasitas }} orang<template v-if="pax">
              untuk {{ pax }} pax{{ kapasitas < pax ? ' — masih kurang' : '' }}
            </template>
          </template>
        </p>
      </div>
    </div>
  </div>
</template>
