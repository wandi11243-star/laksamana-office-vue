<!--
  Quick edit of a booking (old `openQuickEdit`, deploy/reservasi/index.html:4213-4316):
  name, phone, date, time, pax, category and notes — the fields the crew fixes
  ten times a day. Table, DP and status are deliberately NOT here: they change
  through their own buttons in the detail sheet, so the clash check, the proof
  requirement and the seating clock are never skipped.

  Rules kept: pax may not drop below what already arrived (fix arrivals in the
  full form instead); moving date/time re-checks the table against a fresh
  server read; the audit line names WHAT changed, not just "edited".
-->
<script setup lang="ts">
import type { Reservasi } from '~/composables/useReservasi'
import {
  getReservation, listReservations, patchReservation, postAudit, useSection, versiReservasi,
} from '~/composables/useReservasi'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik } from '~/utils/versi'
import { arrivedPax, conflictCheck } from '~/utils/kunci-meja'
import { dpTotal, normPhone, tampilPhone } from '~/utils/dp-reservasi'
import { normTime, rupiah, hariIni, tambahHari, tglPendek } from '~/utils/format'
import { parseDate, type DateValue } from '@internationalized/date'

const props = defineProps<{
  r: Reservasi | null
  bolehSimpan?: boolean
}>()

const emit = defineEmits<{
  tersimpan: []
  konflik: []
}>()

const open = defineModel<boolean>('open', { default: false })
const toast = useToast()
const { mulai: mulaiProses } = useProses()
const { data: categories } = useSection<string[]>('categories')

const nama = ref('')
const phone = ref('')
const tanggal = ref('')
const jam = ref('')
const pax = ref(1)
const kategori = ref('')
const catatan = ref('')
const menyimpan = ref(false)

/**
 * The TANGGAL picker panel (same pattern as app/pages/reservasi/input.vue):
 * a field button opening a sheet with Hari ini/Besok/Lusa shortcuts and a
 * monthly grid. Everything reads and writes `tanggal` as a plain YYYY-MM-DD
 * string, so the save flow (clash re-check, audit line) fires untouched.
 */
const sheetTanggal = ref(false)

/** Button label in long Indonesian form ("Sel, 3 Nov 2026"). */
const tglTampil = computed(() => (tanggal.value ? `${tglPendek(tanggal.value)} ${tanggal.value.slice(0, 4)}` : 'Pilih tanggal'))

/**
 * The earliest pickable day: today — or the stored date when it lies before
 * today, so old bookings stay openable and savable (parity with the old
 * `min: r.date < today ? r.date : today`).
 */
const tglMin = computed(() => (tanggal.value && tanggal.value < hariIni() ? tanggal.value : hariIni()))

/** Shortcut chips under the sheet title: today and the next two days. */
const pintasanTanggal = computed(() => (['Hari ini', 'Besok', 'Lusa'] as const).map((label, i) => ({ label, tgl: tambahHari(hariIni(), i) })))

/** YYYY-MM-DD -> DateValue for UCalendar; undefined when empty so nothing is forced. */
function ubahKeTanggal(iso: string): DateValue | undefined {
  try {
    return parseDate(iso)
  }
  catch {
    return undefined
  }
}

/** The calendar's selected day, bridged to the `tanggal` string. Picking closes the sheet. */
const tglKalender = computed<DateValue | undefined>({
  get: () => (tanggal.value ? ubahKeTanggal(tanggal.value) : undefined),
  set: (v) => {
    if (!v) return
    tanggal.value = v.toString()
    sheetTanggal.value = false
  },
})

/** A shortcut chip: write the day straight to `tanggal` and close. */
function pilihPintasanTanggal(i: number) {
  tanggal.value = tambahHari(hariIni(), i)
  sheetTanggal.value = false
}

/** Fresh form whenever the sheet opens for (another) booking. */
watch([open, () => props.r?.id], () => {
  const r = props.r
  if (!open.value || !r) return
  nama.value = r.name ?? ''
  phone.value = tampilPhone(r.phone)
  tanggal.value = r.date ?? ''
  jam.value = r.time ?? ''
  pax.value = Number(r.pax) || 1
  kategori.value = r.category ?? ''
  catatan.value = r.notes ?? ''
})

const opsiKategori = computed(() => {
  const list = [...(categories.value ?? []).filter(c => c)]
  if (props.r?.category && !list.includes(props.r.category)) list.unshift(props.r.category)
  return list.map(c => ({ value: c, label: c }))
})
const dpRingkasan = computed(() => {
  const r = props.r
  if (!r) return ''
  const total = dpTotal(r) || r.dpAmount || 0
  return `Meja ${r.table || '(belum dipilih)'}, ${r.status}, ${r.dpStatus === 'Sudah' ? `DP ${rupiah(total)}` : 'belum DP'}.`
})

async function simpan() {
  const asal = props.r
  if (!asal || !props.bolehSimpan || menyimpan.value) return
  const n = nama.value.trim()
  const hp = normPhone(phone.value)
  const tgl = tanggal.value
  const waktu = normTime(jam.value)
  const orang = Number(pax.value) || 0
  const kat = kategori.value
  const note = catatan.value.trim()
  if (!n) {
    toast.add({ title: 'Nama tamu tidak boleh kosong', color: 'error' })
    return
  }
  if (!tgl) {
    toast.add({ title: 'Tanggal tidak boleh kosong', color: 'error' })
    return
  }
  if (!waktu) {
    toast.add({ title: 'Jam tidak boleh kosong', color: 'error' })
    return
  }
  if (!(orang >= 1)) {
    toast.add({ title: 'Jumlah pax minimal 1', color: 'error' })
    return
  }
  menyimpan.value = true
  const selesaiProses = mulaiProses(`Menyimpan edit cepat ${asal.name}`)
  try {
    // Fresh row first: the detail underneath may be stale.
    const env = await getReservation(asal.id)
    const segar = env.data
    const versi = versiReservasi(env, segar) ?? segar.updatedAt
    // Pax may not drop below what already arrived — fix the arrival record in
    // the full form instead, or "8 dari 5 orang" cannot be repaired.
    const masuk = arrivedPax(segar)
    if (masuk && orang < masuk) {
      toast.add({ title: `${masuk} orang sudah tercatat masuk — perbaiki catatan kedatangannya dulu lewat Form Lengkap`, color: 'error' })
      return
    }
    const ubah: string[] = []
    if (n !== String(segar.name ?? '')) ubah.push(`nama "${segar.name}" → "${n}"`)
    if (hp !== normPhone(segar.phone)) ubah.push(`HP ${tampilPhone(segar.phone) || '-'} → ${tampilPhone(hp) || '-'}`)
    if (tgl !== String(segar.date ?? '')) ubah.push(`tanggal ${segar.date} → ${tgl}`)
    if (waktu !== String(segar.time ?? '')) ubah.push(`jam ${segar.time || '-'} → ${waktu}`)
    if (orang !== (Number(segar.pax) || 0)) ubah.push(`pax ${segar.pax} → ${orang}`)
    if (kat !== String(segar.category ?? '')) ubah.push(`jenis "${segar.category || '-'}" → "${kat}"`)
    if (note !== String(segar.notes ?? '')) ubah.push(note ? 'catatan diubah' : 'catatan dikosongkan')
    if (!ubah.length) {
      open.value = false
      toast.add({ title: 'Tidak ada yang diubah' })
      return
    }
    // Moving date/time re-checks the table against a fresh read first: the
    // table may belong to someone else at the new hour.
    if ((tgl !== String(segar.date ?? '') || waktu !== String(segar.time ?? '')) && segar.table) {
      const { data } = await listReservations(tgl, tgl)
      const bentrok = conflictCheck(data, {
        date: tgl, table: segar.table, time: waktu, exceptId: segar.id, sharing: segar.sharing,
      })
      if (bentrok) {
        toast.add({ title: `Meja ${segar.table} tidak bisa dipakai di ${tgl} ${waktu} — dipakai ${bentrok.name}.`, color: 'error' })
        return
      }
    }
    await patchReservation(segar.id, {
      name: n, phone: hp, date: tgl, time: waktu, pax: orang, category: kat, notes: note,
    }, versi)
    try {
      await postAudit({ action: 'Edit Cepat', detail: `${n}: ${ubah.join('; ')}`, res: segar.id })
    }
    catch {
      // The edit itself is saved; a missing audit line must not be reported
      // as a failure of the write.
    }
    open.value = false
    toast.add({ title: 'Reservasi diperbarui', color: 'success' })
    emit('tersimpan')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, async () => emit('konflik')))) {
      toast.add({ title: apiErrorMessage(e), color: 'error' })
    }
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
    :title="`Edit cepat — ${r?.name ?? ''}`"
    lebar="sedang"
  >
    <div
      v-if="r"
      class="space-y-3"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField
          label="Nama tamu"
          required
          class="sm:col-span-2"
        >
          <UInput
            v-model="nama"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="No. HP">
          <UInput
            v-model="phone"
            inputmode="numeric"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Tanggal"
          required
        >
          <UButton
            :label="tglTampil"
            icon="i-lucide-calendar"
            color="neutral"
            variant="outline"
            size="xl"
            block
            @click="sheetTanggal = true"
          />
        </UFormField>
        <UFormField
          label="Jam"
          required
        >
          <AppJam
            v-model="jam"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Jumlah pax"
          required
        >
          <UInput
            v-model.number="pax"
            type="number"
            :min="1"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Jenis reservasi">
          <USelect
            v-model="kategori"
            :items="opsiKategori"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Catatan khusus"
          class="sm:col-span-2"
        >
          <UTextarea
            v-model="catatan"
            :rows="2"
            size="xl"
            class="w-full"
          />
        </UFormField>
      </div>
      <p class="rounded-lg border border-default bg-default p-3 text-sm text-muted">
        {{ dpRingkasan }}
        Meja, DP, dan status diubah lewat tombolnya masing-masing di detail reservasi — bukan di sini,
        supaya aturan cek bentrok meja, bukti transfer, dan jam duduk tidak terlewat.
      </p>
      <p
        v-if="!bolehSimpan"
        class="text-sm text-muted"
      >
        Tidak ada akses mengubah reservasi.
      </p>
    </div>
    <template #footer>
      <UButton
        label="Form lengkap"
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        size="xl"
        :to="r ? `/reservasi/input?id=${r.id}` : '/reservasi/input'"
        @click="open = false"
      />
      <UButton
        v-if="bolehSimpan"
        label="Simpan"
        size="xl"
        :loading="menyimpan"
        :disabled="menyimpan"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="ghost"
        size="xl"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
  <ResponsiveSheet
    v-model:open="sheetTanggal"
    title="Pilih tanggal"
  >
    <div class="grid grid-cols-3 gap-2">
      <UButton
        v-for="(p, i) in pintasanTanggal"
        :key="p.label"
        :label="p.label"
        size="lg"
        :color="tanggal === p.tgl ? 'primary' : 'neutral'"
        :variant="tanggal === p.tgl ? 'solid' : 'soft'"
        class="min-h-11 justify-center"
        @click="pilihPintasanTanggal(i)"
      />
    </div>
    <!-- Remounted on every open + default-value so the grid starts on tanggal's month (reka-ui seeds the visible month from defaultValue, not the controlled value). -->
    <UCalendar
      :key="String(sheetTanggal)"
      v-model="tglKalender"
      :default-value="tglKalender"
      :min-value="ubahKeTanggal(tglMin)"
      locale="id"
      class="mx-auto mt-3 w-fit"
    />
  </ResponsiveSheet>
</template>
