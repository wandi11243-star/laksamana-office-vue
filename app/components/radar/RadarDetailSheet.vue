<!--
  The read-only detail panel of Radar (drawerAgenda / drawerRes).

  Agenda: loaded from GET /radar/agenda/{sumber}/{id}. Marketing events open on
  the kitchen & bar highlights first (the person opening a card is usually
  preparing something, not looking for a phone number). VIP has its OWN branch
  — read as an Event-module event it would show six empty boxes. Money only
  arrives for a Head, so this panel never decides what to hide.

  Reservation: drawn from the board row. The old "Hubungi tamu" button is not
  here on purpose: contacting a guest belongs to the Reservasi module, where
  it is recorded.
-->
<script setup lang="ts">
import type { RadarAgenda, RadarDetail, RadarPilihan } from '~/composables/useRadar'
import {
  IKON_SUMBER, LABEL_SUMBER, SUMBER_PENDEK, WARNA_SUMBER, dDay, dLabel, dWarna, dpTeks, paxVipTeks,
  sorotanEvent, tanpaTag, warnaStatusRes,
} from '~/utils/radar'
import { fTgl } from '~/utils/format'

const props = defineProps<{ pilih: RadarPilihan, bolehUang?: boolean }>()
const open = defineModel<boolean>('open', { default: false })

const detail = ref<RadarDetail | null>(null)
const galat = ref('')
const memuat = ref(false)

watch(() => props.pilih, async (p) => {
  detail.value = null
  galat.value = ''
  if (!p || p.jenis !== 'ag') return
  memuat.value = true
  try {
    detail.value = await getRadarDetail(p.a.sumber, p.a.id)
  }
  catch (e) {
    galat.value = apiErrorCode(e) === 'not_found'
      ? 'Agenda ini tidak ditemukan lagi — mungkin sudah berubah di modul asalnya.'
      : apiErrorMessage(e)
  }
  finally {
    memuat.value = false
  }
}, { immediate: true })

const judul = computed(() => {
  const p = props.pilih
  if (!p) return ''
  return p.jenis === 'ag' ? p.a.judul : (p.r.name || '—')
})
const keterangan = computed(() => {
  const p = props.pilih
  if (!p) return ''
  return p.jenis === 'ag' ? LABEL_SUMBER[p.a.sumber] : `Reservasi · ${p.r.category || 'Tamu'}`
})
const waktu = (a: RadarAgenda) => `${a.jam || '—'}${a.selesai ? `–${a.selesai}` : ''}`
const sorot = computed(() => (detail.value?.mkt ? sorotanEvent(detail.value.mkt.detail) : []))
const desk = computed(() => (detail.value?.event?.description ? tanpaTag(detail.value.event.description) : ''))
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="judul"
    :description="keterangan"
  >
    <template v-if="pilih?.jenis === 'ag'">
      <div class="mb-4 flex flex-wrap gap-1.5">
        <AppStatus
          :color="WARNA_SUMBER[pilih.a.sumber]"
          :icon="IKON_SUMBER[pilih.a.sumber]"
          size="sm"
        >
          {{ SUMBER_PENDEK[pilih.a.sumber] }}
        </AppStatus>
        <AppStatus size="sm">
          {{ fTgl(pilih.a.tgl) }}
        </AppStatus>
        <AppStatus
          :color="dWarna(dDay(pilih.a.tgl))"
          size="sm"
        >
          {{ dLabel(dDay(pilih.a.tgl)) }}
        </AppStatus>
        <AppStatus
          v-if="pilih.a.status"
          size="sm"
        >
          {{ pilih.a.status }}
        </AppStatus>
      </div>

      <p
        v-if="memuat"
        class="text-sm text-muted"
      >
        Memuat detail…
      </p>
      <p
        v-else-if="galat"
        class="rounded-field border border-error/30 bg-error/10 p-3 text-sm"
      >
        {{ galat }}
      </p>

      <template v-else-if="detail?.mkt">
        <template v-if="sorot.length">
          <AppSectionTitle
            title="Yang perlu disiapkan"
            icon="i-lucide-chef-hat"
          />
          <div class="mb-4 grid gap-2">
            <div
              v-for="s in sorot"
              :key="s.label"
              class="rounded-r-field border-l-3 border-yellow-deep bg-yellow-light px-3 py-2"
            >
              <p class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-900">
                <UIcon
                  :name="s.icon"
                  class="size-3.5"
                />{{ s.label }}
              </p>
              <p class="whitespace-pre-wrap text-sm text-default">
                {{ s.teks }}
              </p>
            </div>
          </div>
        </template>
        <RadarKv
          :rows="[
            ['Waktu', waktu(detail)],
            ['Tempat', detail.tempat],
            ['Jenis', detail.jenis],
            ['Pax event (kontrak)', detail.pax || null],
            ['Marketing PIC', detail.mkt.mktPIC],
            ...(detail.bolehUang ? [['Pembayaran tercatat', detail.mkt.pembayaran ? `${detail.mkt.pembayaran} transaksi` : 'belum ada'] as [string, string]] : []),
          ]"
        />
        <RadarKv
          v-if="detail.klien"
          :rows="[
            ['Klien', `${detail.klien.nama}${detail.klien.perusahaan ? ` — ${detail.klien.perusahaan}` : ''}`],
            ['PIC klien', detail.klien.pic || detail.klien.nama],
            ['Kontak', detail.klien.hp],
          ]"
        />
      </template>

      <template v-else-if="detail?.vip">
        <RadarKv
          :rows="[
            ['Waktu', waktu(detail)],
            ['Meja', detail.tempat],
            ['Jumlah orang', paxVipTeks(detail)],
            ['Jenis', detail.jenis],
            ['Marketing PIC', detail.vip.mktPIC],
            ['Kontak', detail.vip.hp],
          ]"
        />
        <!-- The reservation name vs the registered client: the one who comes vs the one who pays. -->
        <RadarKv
          v-if="detail.klien || detail.vip.perusahaan"
          :rows="[
            ['Klien', detail.klien?.nama],
            ['Perusahaan', detail.vip.perusahaan || detail.klien?.perusahaan],
          ]"
        />
        <template v-if="detail.vip.catatan.trim()">
          <AppSectionTitle title="Catatan reservasi" />
          <!-- Shown WHOLE: a note cut mid-sentence hides the part it was written for. -->
          <p class="mb-4 whitespace-pre-wrap rounded-field border border-default bg-muted p-3 text-sm">
            {{ detail.vip.catatan.trim() }}
          </p>
        </template>
      </template>

      <template v-else-if="detail?.event">
        <RadarKv
          :rows="[
            ['Waktu', waktu(detail)],
            ['Venue', detail.event.venue],
            ['Kategori', detail.event.category],
            ['Kapasitas', detail.event.capacity],
            ['PIC', detail.event.pic],
            ['Co-PIC', detail.event.co_pic],
          ]"
        />
        <RadarKv
          v-if="detail.event.theme"
          :rows="[['Tema', detail.event.theme], ['Tiketing', detail.event.is_ticketed ? 'Ya' : 'Tidak']]"
        />
        <p
          v-if="desk"
          class="mb-4 whitespace-pre-wrap rounded-field border border-default bg-muted p-3 text-sm"
        >
          {{ desk.slice(0, 400) }}{{ desk.length > 400 ? '…' : '' }}
        </p>
        <template v-if="detail.talents?.length">
          <AppSectionTitle title="Talent terjadwal" />
          <ul class="mb-4 divide-y divide-default">
            <li
              v-for="(t, i) in detail.talents"
              :key="i"
              class="flex items-center gap-2 py-2 text-sm"
            >
              <b class="flex-1 text-highlighted">{{ t.nama }}</b>
              <span
                v-if="t.jam"
                class="text-muted num"
              >{{ t.jam }}</span>
              <AppStatus
                v-if="t.tipe"
                size="sm"
              >
                {{ t.tipe }}
              </AppStatus>
            </li>
          </ul>
        </template>
      </template>

      <p
        v-if="detail && !detail.bolehUang"
        class="text-xs text-dimmed"
      >
        Nominal harga, DP, dan pelunasan hanya tampil untuk Head.
      </p>
    </template>

    <template v-else-if="pilih?.jenis === 'rs'">
      <div class="mb-4 flex flex-wrap gap-1.5">
        <AppStatus
          :color="warnaStatusRes(pilih.r)"
          size="sm"
        >
          {{ pilih.r.status || '—' }}
        </AppStatus>
        <AppStatus size="sm">
          {{ fTgl(pilih.r.date) }}
        </AppStatus>
        <AppStatus
          color="info"
          size="sm"
        >
          {{ pilih.r.time || '—' }} · {{ Number(pilih.r.pax) || 0 }} pax
        </AppStatus>
        <AppStatus
          v-if="pilih.r.vip"
          color="vip"
          icon="i-lucide-crown"
          size="sm"
        >
          VIP
        </AppStatus>
      </div>
      <RadarKv
        :rows="[
          ['Tanggal', fTgl(pilih.r.date)],
          ['Jam datang', pilih.r.time],
          ['Jumlah tamu', `${Number(pilih.r.pax) || 0} pax`],
          ['Meja', pilih.r.table],
          ['Kategori', pilih.r.category],
          ['Sumber', pilih.r.source],
          ['PIC', pilih.r.picName],
          ['Kontak', pilih.r.phone],
        ]"
      />
      <RadarKv
        :rows="[
          ...(bolehUang ? [['DP', dpTeks(pilih.r).teks === 'Belum' ? 'Belum ada' : dpTeks(pilih.r).teks], ['Status DP', pilih.r.dpStatus]] as [string, string | undefined][] : []),
          ['Member', pilih.r.member ? `Ya${pilih.r.memberNo ? ` · ${pilih.r.memberNo}` : ''}` : 'Bukan'],
        ]"
      />
      <div
        v-if="pilih.r.notes"
        class="mb-3 rounded-field border border-yellow-deep bg-yellow-light p-3 text-sm"
      >
        <p class="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-900">
          Catatan
        </p>
        {{ pilih.r.notes }}
      </div>
      <div
        v-if="pilih.r.foodReq || pilih.r.drinkReq"
        class="mb-3 rounded-field border border-default p-3 text-sm"
      >
        <p class="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          Permintaan F&amp;B
        </p>
        {{ [pilih.r.foodReq, pilih.r.drinkReq].filter(Boolean).join(' · ') }}
      </div>
      <div
        v-if="pilih.r.cancelReason"
        class="mb-3 rounded-field border border-error/40 p-3 text-sm"
      >
        <p class="mb-1 text-[11px] font-bold uppercase tracking-wide text-error">
          Alasan batal
        </p>
        {{ pilih.r.cancelReason }}
      </div>
      <p class="text-xs text-dimmed">
        Radar hanya menampilkan. Hubungi tamu dan ubah reservasi di modul Reservasi, supaya tindak lanjutnya tercatat.
      </p>
    </template>

    <template
      v-if="pilih?.jenis === 'ag'"
      #footer
    >
      <UButton
        label="Lihat detail lengkap"
        icon="i-lucide-file-text"
        class="min-h-11"
        :to="`/radar/detail/${pilih.a.sumber}/${encodeURIComponent(pilih.a.id)}`"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
