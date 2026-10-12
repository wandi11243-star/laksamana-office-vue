<!--
  Add one DP instalment to a booking, from its detail sheet
  (old `openAddDp`, deploy/reservasi/index.html:7977-8036).

  A new instalment is born here — proof required with NO exception: whoever
  types the amount is holding the receipt. Same rules as DanaMasukPanel's
  "Tambah Bukti TF DP", extracted so the dashboard and riwayat detail sheets
  can offer it without leaving the booking: nominal + method + proof, money
  flips Pending to Confirmed, one audit line.

  Props: the booking snapshot (for display) + `bolehSimpan` (the finance
  gate — the caller hides the opener without it too). Each save re-reads the
  row first, so a stale detail never overwrites newer transfers; on a version
  conflict the caller reloads through `@konflik` and the person retries.
-->
<script setup lang="ts">
import type { Reservasi } from '~/composables/useReservasi'
import { getReservation, patchReservation, postAudit, useSection, versiReservasi } from '~/composables/useReservasi'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik } from '~/utils/versi'
import {
  cerminDp, dpsTampilan, dpBaru, dpMetodeBawaan, dpTotal, pastikanDps,
} from '~/utils/dp-reservasi'
import { fmtRupiah, rupiah, rupiahVal, tglPendek } from '~/utils/format'

const props = withDefaults(defineProps<{
  r: Reservasi | null
  bolehSimpan?: boolean
}>(), {
  bolehSimpan: false,
})

const emit = defineEmits<{
  tersimpan: []
  konflik: []
}>()

const open = defineModel<boolean>('open', { default: false })
const toast = useToast()
const me = useMe()
const namaSaya = computed(() => me.value?.name ?? '')
const { data: dpMethods } = useSection<string[]>('dpMethods')

const nominal = ref('')
const metode = ref('')
const berkas = ref<File | null>(null)
const namaBerkas = ref('')
const menyimpan = ref(false)

/** Fresh form whenever the sheet opens for (another) booking. */
watch([open, () => props.r?.id], () => {
  if (!open.value || !props.r) return
  nominal.value = ''
  metode.value = dpMetodeBawaan(dpMethods.value ?? [])
  berkas.value = null
  namaBerkas.value = ''
})

const ke = computed(() => (props.r ? dpsTampilan(props.r).length + 1 : 1))
const sudahMasuk = computed(() => (props.r ? dpTotal(props.r) : 0))
const info = computed(() => (props.r
  ? `${tglPendek(props.r.date)} ${props.r.time}, ${props.r.pax} pax${props.r.table ? `, meja ${props.r.table}` : ''}`
  : ''))

function pilihBerkas(f: File | null | undefined) {
  // The 5 MB gate runs BEFORE reading (F1): a bigger file never becomes a data URI.
  if (f && f.size > 5 * 1024 * 1024) {
    toast.add({ title: 'Bukti melebihi 5 MB — kecilkan dulu', color: 'error' })
    berkas.value = null
    namaBerkas.value = ''
    return
  }
  berkas.value = f ?? null
  namaBerkas.value = f ? f.name : ''
}

const bacaBerkas = (f: File): Promise<string> => new Promise((resolve, reject) => {
  const fr = new FileReader()
  fr.onload = () => resolve(String(fr.result))
  fr.onerror = () => reject(fr.error)
  fr.readAsDataURL(f)
})

async function simpan() {
  const asal = props.r
  if (!asal || !props.bolehSimpan || menyimpan.value) return
  const jumlah = rupiahVal(nominal.value)
  if (!jumlah) {
    toast.add({ title: 'Nominal DP wajib diisi', color: 'error' })
    return
  }
  if (!berkas.value) {
    toast.add({ title: 'Bukti transfer wajib diunggah untuk tiap DP', color: 'error' })
    return
  }
  menyimpan.value = true
  try {
    const dataUri = await bacaBerkas(berkas.value)
    const namaFile = berkas.value.name
    // Fresh row first: the detail underneath may predate newer transfers.
    const env = await getReservation(asal.id)
    const segar = env.data
    const versi = versiReservasi(env, segar) ?? segar.updatedAt
    const daftar = dpsTampilan(segar).map(p => ({ ...p }))
    pastikanDps({ ...segar, dps: daftar } as Reservasi)
    daftar.push({
      ...dpBaru(namaSaya.value),
      amount: jumlah,
      method: metode.value,
      proofData: dataUri,
      proofName: namaFile,
    })
    // Money in flips a Pending booking to Confirmed — but only from Pending:
    // anything else is someone else's state, not ours to move.
    const tambahan: Partial<Reservasi> = segar.status === 'Pending' ? { status: 'Confirmed' } : {}
    await patchReservation(segar.id, { dps: daftar, ...cerminDp(daftar), ...tambahan }, versi)
    try {
      await postAudit({
        action: 'Tambah DP',
        detail: `${segar.name}: DP ke-${daftar.length} ${rupiah(jumlah)} (total ${rupiah(daftar.reduce((a, p) => a + (Number(p.amount) || 0), 0))})`,
        res: segar.id,
      })
    }
    catch {
      // The money itself is saved; a missing audit line must not be reported
      // as a failure of the write.
    }
    open.value = false
    toast.add({ title: `DP ${rupiah(jumlah)} tercatat`, color: 'success' })
    emit('tersimpan')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, async () => emit('konflik')))) {
      toast.add({ title: apiErrorMessage(e), color: 'error' })
    }
  }
  finally {
    menyimpan.value = false
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`Tambah bukti TF DP — ${r?.name ?? ''}`"
    :description="info"
  >
    <div
      v-if="r"
      class="space-y-3"
    >
      <p
        v-if="ke > 1"
        class="rounded-lg border border-default bg-default p-3 text-sm text-muted"
      >
        Sudah masuk <b>{{ rupiah(sudahMasuk) }}</b> dari {{ ke - 1 }} kali transfer.
        Ini akan jadi <b>DP ke-{{ ke }}</b>.
      </p>
      <p
        v-else
        class="rounded-lg border border-default bg-default p-3 text-sm text-muted"
      >
        Belum ada DP tercatat. Ini akan jadi <b>DP pertama</b>.
      </p>
      <UFormField
        label="Nominal DP"
        required
      >
        <UInput
          :model-value="nominal"
          inputmode="numeric"
          placeholder="mis. 300.000"
          size="xl"
          class="w-full"
          @update:model-value="(v) => (nominal = fmtRupiah(rupiahVal(String(v))))"
        />
      </UFormField>
      <UFormField label="Metode / tujuan transfer">
        <USelect
          v-model="metode"
          :items="(dpMethods ?? []).filter(m => m).map(m => ({ value: m, label: m }))"
          size="xl"
          class="w-full"
        />
        <p class="mt-1 text-xs text-muted">
          Tanggal, jam, nominal, bank &amp; nama pengirim akan dibaca otomatis dari bukti ini di halaman Dana Masuk.
        </p>
      </UFormField>
      <UFormField
        label="Upload bukti transfer (foto/pdf)"
        required
      >
        <UFileUpload
          :model-value="berkas"
          accept="image/*,application/pdf"
          label="Pilih bukti"
          description="Gambar atau PDF, maks 5 MB"
          @update:model-value="pilihBerkas"
        />
        <p
          v-if="namaBerkas"
          class="mt-1 text-xs text-muted"
        >
          {{ namaBerkas }}
        </p>
      </UFormField>
      <p
        v-if="!bolehSimpan"
        class="text-sm text-muted"
      >
        Tidak ada akses menambah DP.
      </p>
    </div>
    <template #footer>
      <UButton
        v-if="bolehSimpan"
        label="Simpan DP"
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
</template>
