<!--
  Marketing › VIP table lock (vipSimpanKunci, :18062). Writes the FULL
  `vip-<id>` Reservasi record — Confirmed, vip:true, dps[] merged so the
  crew's own instalments survive — with the H-3 lock window. Occupied tables
  come from that day's reservations; failures change nothing, loudly.
-->
<script setup lang="ts">
import type { DpVipMkt, VipMkt } from '~/utils/marketing'
import {
  VIP_LOCK_LEAD_MIN, barisReservasiVipMkt, dpsVipMkt, gabungDpsVipMkt, jamAtau00Mkt, mejaTerpakaiVipMkt,
} from '~/utils/marketing-vip'
import { ifMatch, tanganiKonflik, versiDari } from '~/utils/versi'
import { tambahHari } from '~/utils/format'

const props = defineProps<{
  vip: VipMkt
  perusahaan: string
  namaPic: string
  oleh: string
  bisaUbah: boolean
}>()

const emit = defineEmits<{ kunci: [meja: string[], resId: string] }>()
const toast = useToast()

const buka = ref(false)
const memuat = ref(false)
const mengunci = ref(false)
const daftar = ref<string[]>([])
const terpakai = ref<Record<string, string>>({})
const pilih = ref<string[]>([])
const galat = ref('')
const resId = computed(() => props.vip.resId || `vip-${props.vip.id}`)
const jam = computed(() => jamAtau00Mkt(props.vip.jamMulai))

async function muat() {
  if (!props.vip.tanggal) {
    galat.value = 'Isi tanggal dulu — meja dikunci per tanggal.'
    return
  }
  memuat.value = true
  galat.value = ''
  try {
    const api = useApi()
    const [master, daftarRes, dineEst] = await Promise.all([
      api<Envelope<{ tables?: string[] }>>('/reservasi/master/tables').catch(() => null),
      // A day either side: a 01:00 booking holds its table from 22:00 the night before.
      daftarReservasiSemua(tambahHari(props.vip.tanggal, -1), tambahHari(props.vip.tanggal, 1)).then(d => ({ data: d })),
      // Seating estimate from the venue master (old vipDineEst), 180 fallback.
      api<Envelope<number>>('/reservasi/master/dineEstMin').catch(() => null),
    ])
    const estimasi = Number(dineEst?.data) > 0 ? Number(dineEst?.data) : 180
    daftar.value = master?.data?.tables ?? []
    terpakai.value = mejaTerpakaiVipMkt(daftarRes?.data ?? [], props.vip.tanggal, jam.value, resId.value, estimasi)
    pilih.value = [...(props.vip.meja ?? [])]
    if (!daftar.value.length) galat.value = 'Modul Reservasi belum punya daftar meja. Isi dulu di sana.'
  }
  catch (e) {
    galat.value = `Reservasi tidak terjangkau: ${apiErrorMessage(e)}. Belum ada yang berubah — coba lagi.`
  }
  finally {
    memuat.value = false
  }
}

function toggle(m: string) {
  if (terpakai.value[m] && !pilih.value.includes(m)) return
  pilih.value = pilih.value.includes(m) ? pilih.value.filter(x => x !== m) : [...pilih.value, m]
}

async function berkasKeData(url?: string): Promise<string> {
  if (!url) return ''
  const kunci = url.split('/marketing/files/')[1] ?? url.split('/files/')[1] ?? ''
  if (!kunci) return ''
  const blob = await useApi()<Blob>(`/marketing/files/${encodeURIComponent(decodeURIComponent(kunci))}`, { responseType: 'blob' })
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!)
  return btoa(bin)
}

async function simpanKunci() {
  if (!pilih.value.length) {
    toast.add({ title: 'Meja belum dipilih', description: 'Pilih minimal satu meja supaya bisa dikunci di Reservasi.', color: 'error' })
    return
  }
  mengunci.value = true
  try {
    const api = useApi()
    const dps = dpsVipMkt({ ...props.vip, meja: pilih.value }, props.oleh)
    for (const d of dps) {
      const b = (props.vip.bukti ?? []).find(x => x.id === d.vipBuktiId)
      if (!b?.url) continue
      try {
        d.proofData = await berkasKeData(b.url)
      }
      catch {
        // Nominal tetap dikirim, buktinya menyusul saat disimpan lagi.
      }
    }
    const ada = await api<Envelope<Record<string, unknown>>>(`/reservasi/reservations/${encodeURIComponent(resId.value)}`).catch((e: unknown) => {
      if ((e as { statusCode?: number })?.statusCode === 404) return null
      throw e
    })
    const lama = (Array.isArray((ada?.data as { dps?: DpVipMkt[] } | undefined)?.dps) ? (ada?.data as { dps?: DpVipMkt[] }).dps : []) as DpVipMkt[]
    const baris = {
      ...(ada?.data ?? {}),
      ...barisReservasiVipMkt({ ...props.vip, meja: pilih.value }, gabungDpsVipMkt(lama, dps), props.perusahaan, props.namaPic, props.oleh),
    }
    // An existing reservation is replaced under its version (If-Match), never blind.
    const versi = versiDari(ada) ?? (ada?.data?.updatedAt as number | undefined)
    if (ada?.data) await api(`/reservasi/reservations/${encodeURIComponent(resId.value)}`, { method: 'PUT', body: baris, headers: ifMatch(versi ?? 0) })
    else await api('/reservasi/reservations', { method: 'POST', body: baris })
    emit('kunci', pilih.value, resId.value)
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
        @click="buka = true; void muat()"
      />
    </div>

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
