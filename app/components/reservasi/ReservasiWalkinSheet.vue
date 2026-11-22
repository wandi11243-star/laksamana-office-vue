<!--
  Walk-in sheet opened from the day-of table plan (or via sharing / booked-later
  prompts). Supports adding extra tables for a multi-table walk-in party while
  enforcing the H-1h booking lock and cleaning up forced-override flags if a
  table is deselected.
-->
<script setup lang="ts">
import type { Master, Reservasi } from '~/composables/useReservasi'
import { createReservation } from '~/composables/useReservasi'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik } from '~/utils/versi'
import { bookingBerikut, buatIzinTumpang, fmtMenit, mepetKah } from '~/utils/kunci-meja'
import { normPhone, uid } from '~/utils/dp-reservasi'
import type { LayoutDenah, MasterDenah } from '~/utils/venue-layouts'
import { capMax, cariMeja } from '~/utils/venue-layouts'
import { normTime, tglPendek } from '~/utils/format'

const props = withDefaults(defineProps<{
  meja: string
  initialSharing?: boolean
  initialPax?: number
  tglDenah: string
  hariIniMap: boolean
  dineEst: number
  denahTerpilih?: LayoutDenah | null
  semuaHari: Reservasi[]
  master: Master
  masterKunci: MasterDenah & { dineEstMin?: number, clashLeadMin?: number }
  saringAktif?: boolean
  namaSaya: string
}>(), {
  initialSharing: false,
  initialPax: 2,
  denahTerpilih: null,
  saringAktif: false,
})

const emit = defineEmits<{
  tersimpan: []
  konflik: []
}>()

const open = defineModel<boolean>('open', { default: false })
const toast = useToast()
const { mulai: mulaiProses } = useProses()

const walkin = reactive({
  meja: '',
  nama: '',
  phone: '',
  pax: 2,
  sharing: false,
  tambahan: [] as string[],
})
const pilihMejaWalkin = ref(false)
const dipaksaWalkin = ref<string[]>([])
const tanyaWalkin = ref<{ meja: string, pesan: string } | null>(null)
const jamWalkin = ref('')
const menyimpan = ref(false)

/** Reset the form each time the sheet opens for a (new) starting table. */
watch(
  [open, () => props.meja, () => props.initialSharing, () => props.initialPax],
  ([isOpen]) => {
    if (!isOpen) return
    Object.assign(walkin, {
      meja: props.meja,
      nama: '',
      phone: '',
      pax: Number(props.initialPax) > 0 ? Number(props.initialPax) : 2,
      sharing: props.initialSharing,
      tambahan: [],
    })
    pilihMejaWalkin.value = false
    dipaksaWalkin.value = []
    tanyaWalkin.value = null
  },
  { immediate: true },
)

const jamKini = () => normTime(`${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`)
const berikutDi = (m: string) => bookingBerikut(props.semuaHari, m, { date: props.tglDenah, hariIni: props.hariIniMap, dineEst: props.dineEst })
const sisaWaktu = (m: number) => (m > 0 ? `${fmtMenit(m)} lagi` : `jamnya sudah lewat ${fmtMenit(-m)}`)
/** "19:00", or "02:10 (27 Sep)" when the booking is on another day than the map. */
const jamPesan = (r: Reservasi) => (r.date === props.tglDenah ? r.time : `${r.time} (${tglPendek(r.date)})`)

const mejaWalkin = computed(() => [walkin.meja, ...walkin.tambahan].filter(Boolean))
const kapasitasWalkin = computed(() => mejaWalkin.value.reduce((n, id) => n + capMax(cariMeja(props.master, id)?.t.cap), 0))

/** Warnings for EVERY picked table that already has a booking later today. */
const pitaWalkinList = computed(() => mejaWalkin.value
  .map(m => ({ meja: m, nx: berikutDi(m) }))
  .filter((x): x is { meja: string, nx: NonNullable<ReturnType<typeof berikutDi>> } => !!x.nx)
  .map(x => ({ meja: x.meja, ...x.nx, mepet: mepetKah(x.nx.menit) })))

function bukaPilihMejaWalkin() {
  jamWalkin.value = jamKini()
  pilihMejaWalkin.value = !pilihMejaWalkin.value
  tanyaWalkin.value = null
}

function pilihWalkin(mejaId: string) {
  // The starting table stays: it is the one the guest is standing at.
  if (mejaId === walkin.meja) return
  if (walkin.tambahan.includes(mejaId)) {
    walkin.tambahan = walkin.tambahan.filter(m => m !== mejaId)
    // Drop any forced-override flag if the crew removes that table again.
    dipaksaWalkin.value = dipaksaWalkin.value.filter(m => m !== mejaId)
  }
  else {
    walkin.tambahan = [...walkin.tambahan, mejaId]
  }
}

function onTumpangWalkin(p: { meja: string, pesan: string, kunci: boolean }) {
  if (p.kunci) {
    toast.add({ title: p.pesan, color: 'error' })
    return
  }
  tanyaWalkin.value = { meja: p.meja, pesan: p.pesan }
}

function izinkanWalkin() {
  const m = tanyaWalkin.value?.meja
  tanyaWalkin.value = null
  if (!m) return
  if (!dipaksaWalkin.value.includes(m)) dipaksaWalkin.value = [...dipaksaWalkin.value, m]
  pilihWalkin(m)
}

async function simpanWalkin() {
  if (menyimpan.value) return
  const n = Number(walkin.pax) || 0
  if (n < 1) {
    toast.add({ title: 'Jumlah orang wajib diisi', color: 'error' })
    return
  }

  // Re-check the H-1h lock on submit: time may have crossed into the lock
  // window while the sheet stayed open, or an extra table may be locked.
  const mejaCekKunci = walkin.sharing ? walkin.tambahan : mejaWalkin.value
  for (const m of mejaCekKunci) {
    const nx = berikutDi(m)
    if (nx && mepetKah(nx.menit)) {
      toast.add({ title: `Meja ${m} terkunci — ${nx.res.name} ${tglPendek(nx.res.date)} jam ${nx.res.time} (${sisaWaktu(nx.menit)})`, color: 'error' })
      return
    }
  }

  const now = Date.now()
  const jam = jamKini()
  const nama = walkin.nama.trim() || 'Walkin' // a nameless quick entry is all called "Walkin"
  const mejaSimpan = mejaWalkin.value.join(', ')
  // Every table that is booked for later goes into the note, not only the first.
  const catatanWalkin = mejaWalkin.value
    .map(m => ({ m, nx: berikutDi(m) }))
    .filter(x => x.nx)
    .map(x => `Walk-in sementara — meja ${x.m} dipesan ${x.nx!.res.name} jam ${jamPesan(x.nx!.res)}`)
    .join('\n')
  const dipaksaAktif = dipaksaWalkin.value.filter(m => mejaWalkin.value.includes(m))
  const izinWalkin = dipaksaAktif.length ? buatIzinTumpang(mejaSimpan, props.tglDenah, jam, null, props.namaSaya) : null

  menyimpan.value = true
  const selesaiProses = mulaiProses(`Menyimpan walk-in di meja ${mejaSimpan}`)
  try {
    await createReservation({
      id: uid(),
      name: nama,
      phone: normPhone(walkin.phone),
      date: props.tglDenah,
      time: jam,
      pax: n,
      table: mejaSimpan,
      ...(izinWalkin ? { izinTumpang: izinWalkin } : {}),
      sharing: walkin.sharing,
      category: 'Tamu Umum',
      foodReq: '',
      drinkReq: '',
      dpStatus: 'Belum',
      dpMethod: '',
      dpAmount: 0,
      dpProofData: '',
      dpProofName: '',
      docReqData: '',
      docReqName: '',
      source: 'Walk-in',
      picType: 'Host/Captain',
      picName: props.namaSaya,
      member: false,
      memberNo: '',
      // The note names the booking waiting for this table: once the sheet is closed
      // its ribbon is gone, and whoever opens this row tomorrow has no other way to
      // know the guest was seated at a booked table (old catatanWalkIn).
      notes: catatanWalkin,
      vip: false,
      status: 'Datang',
      actualPax: n,
      checkinAt: now,
      leftAt: 0,
      arrivals: [{ ts: now, pax: n, by: props.namaSaya }],
      createdBy: props.namaSaya,
      createdAt: now,
      updatedAt: now,
      followups: [],
      _audit: { action: 'Walk-in', detail: `${nama} (${n} pax) di meja ${mejaSimpan}` },
    } as Partial<Reservasi> & { _audit: { action: string, detail: string } })
    open.value = false
    toast.add({ title: `${nama} duduk di ${mejaSimpan}`, color: 'success' })
    emit('tersimpan')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, async () => emit('konflik')))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    selesaiProses()
    menyimpan.value = false
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :detail="pilihMejaWalkin"
    :title="`Walk-in di meja ${mejaWalkin.join(', ')}`"
    description="Tamu tanpa nama tetap dicatat sebagai “Walkin”."
  >
    <div class="grid grid-cols-1 gap-3">
      <p
        v-for="p in pitaWalkinList"
        :key="p.meja"
        class="rounded-lg border p-3 text-sm"
        :class="p.mepet ? 'border-error/40 bg-error/10 text-error' : 'border-warning/40 bg-warning/10 text-default'"
      >
        Meja <b>{{ p.meja }}</b> <b>sudah dipesan</b> {{ p.res.name }} jam
        <b>{{ tglPendek(p.res.date) }} {{ p.res.time }}</b>
        ({{ sisaWaktu(p.menit) }}, {{ p.res.pax }} pax){{ p.lain ? ` · +${p.lain} reservasi lain` : '' }}.
        <template v-if="p.mepet">
          <b>Jamnya sudah dekat.</b> Kalau tamu ini didudukkan di sini, pastikan ia selesai sebelum jamnya — atau siapkan meja lain untuk dialihkan.
        </template>
        <template v-else>
          Masih bisa dipakai duduk sementara. Pastikan mejanya kosong lagi sebelum jam {{ p.res.time }}.
        </template>
      </p>
      <UFormField label="Nama (opsional)">
        <UInput
          v-model="walkin.nama"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField label="No. WhatsApp (opsional)">
        <UInput
          v-model="walkin.phone"
          inputmode="numeric"
          size="xl"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Jumlah orang"
        required
      >
        <UInput
          v-model.number="walkin.pax"
          type="number"
          :min="1"
          size="xl"
          class="w-full"
        />
      </UFormField>

      <div class="rounded-lg border border-default p-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-muted">Meja:</span>
          <UBadge
            :label="walkin.meja"
            color="primary"
            variant="soft"
            size="lg"
          />
          <UBadge
            v-for="m in walkin.tambahan"
            :key="m"
            color="info"
            variant="soft"
            size="lg"
            class="cursor-pointer"
            :title="`Lepas meja ${m}`"
            @click="pilihWalkin(m)"
          >
            {{ m }}
            <UIcon
              name="i-lucide-x"
              class="size-3.5"
            />
          </UBadge>
          <span class="text-sm text-muted">· muat {{ kapasitasWalkin }} orang</span>
        </div>
        <p
          v-if="kapasitasWalkin && Number(walkin.pax) > kapasitasWalkin"
          class="mt-2 text-sm text-warning"
        >
          {{ walkin.pax }} orang lebih banyak dari kapasitas meja — tambah meja lagi?
        </p>
        <UButton
          :label="pilihMejaWalkin ? 'Selesai pilih meja' : 'Tambah meja (lebih dari 1 meja)'"
          :icon="pilihMejaWalkin ? 'i-lucide-check' : 'i-lucide-armchair'"
          color="info"
          variant="soft"
          size="lg"
          class="mt-3"
          :disabled="saringAktif"
          @click="bukaPilihMejaWalkin"
        />
        <div
          v-if="pilihMejaWalkin && denahTerpilih"
          class="mt-3 space-y-2"
        >
          <p class="text-sm text-muted">
            Klik meja kosong untuk menambah, klik lagi untuk melepas.
          </p>
          <DenahPeta
            :layout="denahTerpilih"
            :reservasi="semuaHari"
            :tanggal="tglDenah"
            :jam="jamWalkin"
            mode="pilih"
            :terpilih="mejaWalkin"
            :dipaksa="dipaksaWalkin"
            :master="masterKunci"
            :legenda="false"
            @pilih="pilihWalkin"
            @tumpang="onTumpangWalkin"
          />
          <div
            v-if="tanyaWalkin"
            class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-default"
          >
            <p>{{ tanyaWalkin.pesan }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <UButton
                label="Tetap pakai meja"
                size="lg"
                @click="izinkanWalkin"
              />
              <UButton
                label="Batal"
                color="neutral"
                variant="soft"
                size="lg"
                @click="tanyaWalkin = null"
              />
            </div>
          </div>
        </div>
      </div>

      <label class="flex items-center gap-2 text-sm">
        <input
          v-model="walkin.sharing"
          type="checkbox"
        > Sharing table
      </label>
    </div>
    <template #footer>
      <UButton
        label="Simpan walk-in"
        size="xl"
        :loading="menyimpan"
        @click="simpanWalkin"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="soft"
        size="xl"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
