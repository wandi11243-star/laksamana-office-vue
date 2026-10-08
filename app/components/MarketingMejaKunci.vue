<!--
  Marketing › locked tables (D.1 mejaKunci, evmFieldHTML :18226). The value is
  written when the tables are locked — straight into the Reservasi module as
  row `ev-<id>` — never by the tab Save button. Shows the chips + count, warns
  when the event moved dates after locking, and locks/releases through the
  Reservasi endpoints with the old graceful failures.
-->
<script setup lang="ts">
import { kunciTanggalSalahMkt, mejaTerkunciMkt } from '~/utils/marketing-event'
import type { EventMkt } from '~/utils/marketing'
import { lepasKunciMejaMkt, resIdKunciMkt } from '~/composables/useMarketing'

const props = defineProps<{
  ev: EventMkt
  tanggal: string
  jam: string
  bisaUbah: boolean
}>()

const emit = defineEmits<{ kunci: [meja: string[], tgl: string], lepas: [] }>()
const toast = useToast()

const meja = computed(() => mejaTerkunciMkt(props.ev))
const peringatan = computed(() => kunciTanggalSalahMkt(props.ev))

const buka = ref(false)
const memuat = ref(false)
const mengunci = ref(false)
const daftar = ref<string[]>([])
const terpakai = ref<Record<string, string>>({})
const pilih = ref<string[]>([])
const galat = ref('')

async function muat() {
  if (!props.tanggal) {
    galat.value = 'Isi Tanggal Event dulu — meja dikunci per tanggal.'
    return
  }
  memuat.value = true
  galat.value = ''
  try {
    const api = useApi()
    const [master, daftarRes] = await Promise.all([
      api<Envelope<{ tables?: string[] }>>('/reservasi/master/tables').catch(() => null),
      api<Envelope<Record<string, unknown>[]>>('/reservasi/reservations', { query: { from: props.tanggal, to: props.tanggal, perPage: 1000 } }).catch(() => null),
    ])
    daftar.value = master?.data?.tables ?? []
    const pakai: Record<string, string> = {}
    for (const r of daftarRes?.data ?? []) {
      if (String((r as Record<string, unknown>).id) === resIdKunciMkt(props.ev.id)) continue
      const nama = String((r as Record<string, unknown>).name ?? '')
      for (const m of String((r as Record<string, unknown>).table ?? '').split(',').map(s => s.trim()).filter(Boolean)) pakai[m] = nama
    }
    terpakai.value = pakai
    pilih.value = meja.value.slice()
    if (!daftar.value.length) galat.value = 'Modul Reservasi belum punya daftar meja. Isi dulu di sana.'
  }
  catch (e) {
    galat.value = `Reservasi tidak terjangkau: ${apiErrorMessage(e)}. Belum ada yang berubah — coba lagi.`
  }
  finally {
    memuat.value = false
  }
}

function bukaPilih() {
  buka.value = true
  void muat()
}

function toggle(m: string) {
  if (terpakai.value[m] && !pilih.value.includes(m)) return
  pilih.value = pilih.value.includes(m) ? pilih.value.filter(x => x !== m) : [...pilih.value, m]
}

async function simpanKunci() {
  mengunci.value = true
  try {
    const api = useApi()
    const resId = resIdKunciMkt(props.ev.id)
    const baris = {
      id: resId, name: `Event: ${props.ev.nama}`, phone: '', date: props.tanggal,
      time: props.jam || '', pax: +(props.ev.pax ?? 0) || 0,
      table: pilih.value.join(', '), category: 'Event', source: 'marketing',
    }
    const ada = await api<Envelope<Record<string, unknown>>>(`/reservasi/reservations/${encodeURIComponent(resId)}`).catch(() => null)
    if (ada?.data) await api(`/reservasi/reservations/${encodeURIComponent(resId)}`, { method: 'PUT', body: { ...ada.data, ...baris } })
    else await api('/reservasi/reservations', { method: 'POST', body: baris })
    emit('kunci', pilih.value, props.tanggal)
    buka.value = false
  }
  catch (e) {
    toast.add({ title: 'Gagal mengunci di Reservasi', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mengunci.value = false
  }
}

const melepas = ref(false)
async function lepas() {
  melepas.value = true
  const r = await lepasKunciMejaMkt(props.ev.id)
  melepas.value = false
  toast.add({ title: r.ok ? 'Kunci dilepas' : 'Gagal melepas kunci', description: r.pesan, color: r.ok ? 'success' : 'error' })
  if (r.ok) emit('lepas')
}
</script>

<template>
  <div>
    <div
      v-if="!meja.length"
      class="text-sm text-muted"
    >
      Belum ada meja dikunci. Tamu walk-in masih bisa mengambil meja mana pun di modul Reservasi pada tanggal ini.
    </div>
    <template v-else>
      <div class="flex flex-wrap gap-1.5">
        <UBadge
          v-for="m in meja"
          :key="m"
          :label="m"
          color="neutral"
          variant="soft"
        />
      </div>
      <p class="mt-1 text-xs text-muted">
        {{ meja.length }} meja terkunci di modul Reservasi.
      </p>
    </template>
    <UAlert
      v-if="peringatan"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :description="peringatan"
      class="mt-2"
    />
    <div
      v-if="bisaUbah"
      class="mt-2 flex flex-wrap gap-2"
    >
      <UButton
        icon="i-lucide-armchair"
        color="neutral"
        variant="outline"
        size="sm"
        :label="meja.length ? 'Ubah / Kunci Ulang' : 'Pilih & Kunci Meja'"
        @click="bukaPilih"
      />
      <UButton
        v-if="meja.length"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        size="sm"
        label="Lepas Kunci"
        :loading="melepas"
        @click="lepas"
      />
    </div>

    <ResponsiveSheet
      v-model:open="buka"
      title="Pilih & Kunci Meja"
      :description="`${ev.nama} · ${tanggal || '(tanggal belum diisi)'}${jam ? ` · ${jam}` : ''} · ${Number(ev.pax) || 0} pax`"
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
          Denah yang sama dengan modul Reservasi. Klik meja untuk mengunci — boleh lebih dari satu. Meja abu-abu sudah dipesan tamu lain.
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
            :disabled="!tanggal"
            @click="simpanKunci"
          />
        </div>
      </template>
    </ResponsiveSheet>
  </div>
</template>
