<!--
  Marketing › locked tables (D.1 mejaKunci, evmFieldHTML :18226). The value is
  written when the tables are locked — straight into the Reservasi module as
  row `ev-<id>` — never by the tab Save button. Shows the chips + count, warns
  when the event moved dates after locking, and locks/releases through the
  Reservasi endpoints with the old graceful failures. Tables are picked on the
  Reservasi plan itself (MarketingDenahPilih, owner request Nov 2026).
-->
<script setup lang="ts">
import { kunciTanggalSalahMkt, mejaTerkunciMkt } from '~/utils/marketing-event'
import type { EventMkt } from '~/utils/marketing'
import { lepasKunciMejaMkt, resIdKunciMkt } from '~/composables/useMarketing'
import { ifMatch, tanganiKonflik, versiDari } from '~/utils/versi'

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
const mengunci = ref(false)
const pilih = ref<string[]>([])
const denah = ref<{ muat: () => Promise<void> } | null>(null)

function bukaPilih() {
  pilih.value = meja.value.slice()
  buka.value = true
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
    const ada = await api<Envelope<Record<string, unknown>>>(`/reservasi/reservations/${encodeURIComponent(resId)}`).catch((e: unknown) => {
      if ((e as { statusCode?: number })?.statusCode === 404) return null
      throw e
    })
    if (ada?.data) {
      // An existing lock is replaced under its version (If-Match), never blind.
      const versi = versiDari(ada) ?? (ada.data.updatedAt as number | undefined)
      await api(`/reservasi/reservations/${encodeURIComponent(resId)}`, { method: 'PUT', body: { ...ada.data, ...baris }, headers: ifMatch(versi ?? 0) })
    }
    else await api('/reservasi/reservations', { method: 'POST', body: baris })
    emit('kunci', pilih.value, props.tanggal)
    buka.value = false
  }
  catch (e) {
    if (!(await tanganiKonflik(e, () => denah.value?.muat() ?? Promise.resolve()))) toast.add({ title: 'Gagal mengunci di Reservasi', description: apiErrorMessage(e), color: 'error' })
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
      lebar="penuh"
    >
      <UAlert
        v-if="!tanggal"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        description="Isi Tanggal Event dulu — meja dikunci per tanggal."
      />
      <template v-else>
        <p class="mb-2 text-xs text-muted">
          Denah yang sama dengan modul Reservasi. Klik meja untuk mengunci — boleh lebih dari satu, dan boleh lintas lantai.
        </p>
        <MarketingDenahPilih
          ref="denah"
          v-model="pilih"
          :tanggal="tanggal"
          :jam="jam"
          :kecuali-id="resIdKunciMkt(ev.id)"
          :pax="Number(ev.pax) || 0"
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
            :disabled="!tanggal"
            @click="simpanKunci"
          />
        </div>
      </template>
    </ResponsiveSheet>
  </div>
</template>
