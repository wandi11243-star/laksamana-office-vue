<!--
  Marketing › VIP table lock (vipSimpanKunci, :18062). Writes the
  `vip-<id>` Reservasi record through kirimVipKeReservasi — a new one whole
  (Confirmed, vip:true), an existing one updated in place so the crew's
  check-in and own instalments survive — with the H-3 lock window. Tables are
  picked on the Reservasi plan itself (MarketingDenahPilih, owner request Nov
  2026), with that day's bookings coloured; failures change nothing, loudly.
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
const mengunci = ref(false)
const pilih = ref<string[]>([])
const jam = computed(() => jamAtau00Mkt(props.vip.jamMulai))
const denah = ref<{ muat: () => Promise<void> } | null>(null)

// Every opening starts from the booking's own tables.
watch(buka, (v) => {
  if (v) pilih.value = [...(props.vip.meja ?? [])]
}, { immediate: true })

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
    if (!(await tanganiKonflik(e, () => denah.value?.muat() ?? Promise.resolve()))) toast.add({ title: 'Gagal mengunci di Reservasi', description: apiErrorMessage(e), color: 'error' })
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
      lebar="penuh"
    >
      <UAlert
        v-if="!vip.tanggal"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        description="Isi tanggal dulu — meja dikunci per tanggal."
      />
      <template v-else>
        <p class="mb-2 text-xs text-muted">
          Denah yang sama dengan modul Reservasi. Klik meja untuk mengunci — boleh lebih dari satu, dan boleh lintas lantai.
        </p>
        <MarketingDenahPilih
          ref="denah"
          v-model="pilih"
          :tanggal="vip.tanggal"
          :jam="jam"
          :kecuali-id="resIdVipMkt(vip)"
          :pax="Number(vip.paxMax) || Number(vip.paxMin) || 0"
        />
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
