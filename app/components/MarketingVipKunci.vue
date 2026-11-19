<!--
  Marketing › VIP table lock (vipSimpanKunci, :18062). Writes the
  `vip-<id>` Reservasi record through kirimVipKeReservasi — a new one whole
  (Confirmed, vip:true), an existing one updated in place so the crew's
  check-in and own instalments survive — with the H-3 lock window. Occupied tables
  come from that day's reservations; failures change nothing, loudly.
-->
<script setup lang="ts">
import type { VipMkt } from '~/utils/marketing'
import { VIP_LOCK_LEAD_MIN, jamAtau00Mkt } from '~/utils/marketing-vip'
import { tanganiKonflik } from '~/utils/versi'

const props = defineProps<{
  vip: VipMkt
  perusahaan: string
  namaPic: string
  oleh: string
  bisaUbah: boolean
  /** Sheet only, opened from outside (the table's "Ubah meja" icon). */
  tanpaTombol?: boolean
}>()

const emit = defineEmits<{ kunci: [meja: string[], resId: string] }>()
const toast = useToast()

const buka = defineModel<boolean>('buka', { default: false })
const memuat = ref(false)
const mengunci = ref(false)
const daftar = ref<string[]>([])
const terpakai = ref<Record<string, string>>({})
const pilih = ref<string[]>([])
const galat = ref('')
const jam = computed(() => jamAtau00Mkt(props.vip.jamMulai))

async function muat() {
  if (!props.vip.tanggal) {
    galat.value = 'Isi tanggal dulu — meja dikunci per tanggal.'
    return
  }
  memuat.value = true
  galat.value = ''
  try {
    const [meja, pakai] = await Promise.all([daftarMejaReservasi(), mejaTerpakaiVip(props.vip)])
    daftar.value = meja
    terpakai.value = pakai
    pilih.value = [...(props.vip.meja ?? [])]
    if (!daftar.value.length) galat.value = 'Modul Reservasi belum punya daftar meja. Isi dulu di Master data Reservasi.'
  }
  catch (e) {
    galat.value = `Reservasi tidak terjangkau: ${apiErrorMessage(e)}. Belum ada yang berubah — coba lagi.`
  }
  finally {
    memuat.value = false
  }
}
watch(buka, (v) => {
  if (v) void muat()
}, { immediate: true })

function toggle(m: string) {
  if (terpakai.value[m] && !pilih.value.includes(m)) return
  pilih.value = pilih.value.includes(m) ? pilih.value.filter(x => x !== m) : [...pilih.value, m]
}

async function simpanKunci() {
  if (!pilih.value.length) {
    toast.add({ title: 'Meja belum dipilih', description: 'Pilih minimal satu meja supaya bisa dikunci di Reservasi.', color: 'error' })
    return
  }
  mengunci.value = true
  try {
    const resId = await kirimVipKeReservasi({ ...props.vip, meja: pilih.value }, { perusahaan: props.perusahaan, namaPic: props.namaPic, oleh: props.oleh })
    emit('kunci', pilih.value, resId)
    buka.value = false
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muat))) toast.add({ title: 'Gagal mengunci di Reservasi', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mengunci.value = false
  }
}
</script>

<template>
  <div>
    <template v-if="!tanpaTombol">
      <div
        v-if="!(vip.meja ?? []).length"
        class="text-sm text-muted"
      >
        Belum ada meja dikunci. Tamu walk-in masih bisa mengambil meja mana pun di modul Reservasi pada tanggal ini.
      </div>
      <div
        v-else
        class="flex flex-wrap gap-1.5"
      >
        <UBadge
          v-for="m in vip.meja"
          :key="m"
          :label="m"
          color="neutral"
          variant="soft"
        />
      </div>
      <div
        v-if="bisaUbah"
        class="mt-2"
      >
        <UButton
          icon="i-lucide-armchair"
          color="neutral"
          variant="outline"
          size="sm"
          :label="(vip.meja ?? []).length ? 'Ubah Meja & Kunci' : 'Pilih Meja & Kunci'"
          loading-auto
          @click="buka = true"
        />
      </div>
    </template>

    <ResponsiveSheet
      v-model:open="buka"
      title="Pilih & Kunci Meja"
      :description="`${vip.nama} · ${vip.tanggal || '(tanggal belum diisi)'} · kunci H-${VIP_LOCK_LEAD_MIN / 60} jam dari ${jam}`"
    >
      <p
        v-if="memuat"
        class="py-6 text-center text-sm text-muted"
      >
        Menghubungi modul Reservasi…
      </p>
      <template v-else>
        <UAlert
          v-if="galat"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :description="galat"
          class="mb-3"
        />
        <p class="mb-2 text-xs text-muted">
          Daftar meja dari modul Reservasi. Klik meja untuk mengunci — boleh lebih dari satu, dan boleh lintas lantai. Meja abu-abu sudah dipesan tamu lain.
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="m in daftar"
            :key="m"
            :label="m"
            size="sm"
            :color="pilih.includes(m) ? 'primary' : 'neutral'"
            :variant="pilih.includes(m) ? 'solid' : terpakai[m] ? 'soft' : 'outline'"
            :disabled="!!terpakai[m] && !pilih.includes(m)"
            :title="terpakai[m] ? `Dipesan ${terpakai[m]}` : m"
            @click="toggle(m)"
          />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="ghost"
            @click="buka = false"
          />
          <UButton
            icon="i-lucide-check"
            label="Simpan & Kunci di Reservasi"
            :loading="mengunci"
            :disabled="!vip.tanggal"
            @click="simpanKunci"
          />
        </div>
      </template>
    </ResponsiveSheet>
  </div>
</template>
