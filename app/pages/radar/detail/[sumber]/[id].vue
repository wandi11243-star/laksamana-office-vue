<!--
  Radar › Detail Lengkap (deploy/radar vDetailEvent) — replaces "open in
  Marketing / Event". Radar stands alone: every field of the event is shown
  here, read-only, and can be printed / saved as PDF. Marketing keeps no PDF of
  its brief, so this page renders it again from the data.

  Marketing fields the label map does not know still show, with a label made
  from the key — never hidden, only less tidy until MKT_LABEL learns them.
  Money fields never reach a non-Head (the API drops them), so this page does
  not decide what to hide. Attachments are fetched with the token (the file
  endpoint needs Bearer), only when the page opens.
-->
<script setup lang="ts">
import type { RadarDetail, SumberAgenda } from '~/composables/useRadar'
import type { Lampiran } from '~/utils/radar'
import {
  IKON_SUMBER, LABEL_SUMBER, SUMBER_PENDEK, WARNA_SUMBER, dDay, dLabel, dWarna, detailFields,
  lampiranGambar, paxVipTeks, tanpaTag,
} from '~/utils/radar'
import { fTgl } from '~/utils/format'

definePageMeta({ access: ['radar'] })

const route = useRoute()
const me = useMe()
const sumber = String(route.params.sumber) as SumberAgenda
const id = String(route.params.id)

const { data: d, status, error } = useAsyncData(`radar-detail-${sumber}-${id}`, () =>
  ['mkt', 'evt', 'vip'].includes(sumber) ? getRadarDetail(sumber, id) : Promise.resolve(null as RadarDetail | null))

const baris = computed(() => (d.value?.mkt ? detailFields(d.value.mkt.detail) : []))
const desk = computed(() => (d.value?.event?.description ? tanpaTag(d.value.event.description) : ''))
const waktu = computed(() => (d.value ? `${d.value.jam || '—'}${d.value.selesai ? `–${d.value.selesai}` : ''}` : ''))
const dicetak = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

// key → object URL (or '' = failed). Revoked when the page leaves.
const berkas = ref<Record<string, string>>({})
watch(baris, async (rows) => {
  for (const r of rows) {
    for (const l of r.lampiran ?? []) {
      if (l.key in berkas.value) continue
      berkas.value[l.key] = 'memuat'
      try {
        berkas.value[l.key] = await getRadarFileUrl(l.key)
      }
      catch {
        berkas.value[l.key] = ''
      }
    }
  }
}, { immediate: true })
onBeforeUnmount(() => {
  for (const u of Object.values(berkas.value)) if (u.startsWith('blob:')) URL.revokeObjectURL(u)
})
const urlOf = (l: Lampiran) => berkas.value[l.key] || ''

const cetak = () => window.print()
</script>

<template>
  <AppPage
    title="Detail Event"
    description="Detail lengkap, baca-saja — bisa dicetak atau disimpan sebagai PDF."
  >
    <template #actions>
      <div class="flex gap-2 print:hidden">
        <UButton
          label="Daftar Event"
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="outline"
          to="/radar/agenda"
        />
        <UButton
          v-if="d"
          label="Cetak / Simpan PDF"
          icon="i-lucide-printer"
          @click="cetak"
        />
      </div>
    </template>

    <p
      v-if="status === 'pending'"
      class="text-sm text-muted"
    >
      Memuat…
    </p>
    <AppPanel v-else-if="error || !d">
      <p class="text-center text-sm">
        <b class="block text-highlighted">Event tidak ditemukan</b>
        {{ error && apiErrorCode(error) !== 'not_found' ? apiErrorMessage(error) : 'Data mungkin sudah berubah di modul asalnya, atau acaranya belum pasti jalan.' }}
      </p>
    </AppPanel>
    <AppPanel v-else>
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-default pb-3">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
            {{ LABEL_SUMBER[d.sumber] }}
          </p>
          <h2 class="my-1 font-display text-2xl font-bold text-highlighted">
            {{ d.judul }}
          </h2>
          <div class="flex flex-wrap gap-1.5">
            <AppStatus
              :color="WARNA_SUMBER[d.sumber]"
              :icon="IKON_SUMBER[d.sumber]"
              size="sm"
            >
              {{ SUMBER_PENDEK[d.sumber] }}
            </AppStatus>
            <AppStatus size="sm">
              {{ fTgl(d.tgl) }}
            </AppStatus>
            <AppStatus
              :color="dWarna(dDay(d.tgl))"
              size="sm"
            >
              {{ dLabel(dDay(d.tgl)) }}
            </AppStatus>
            <AppStatus
              v-if="d.status"
              size="sm"
            >
              {{ d.status }}
            </AppStatus>
          </div>
        </div>
        <p class="text-right text-xs text-muted">
          Dicetak {{ dicetak }}<br>oleh {{ me?.name || '—' }}
        </p>
      </div>

      <template v-if="d.sumber === 'mkt' && d.mkt">
        <RadarKv
          :rows="[
            ['Waktu', waktu],
            ['Tempat', d.tempat],
            ['Jenis', d.jenis],
            ['Pax event (kontrak)', d.pax || '—'],
            ['Marketing PIC', d.mkt.mktPIC],
            ...(d.bolehUang ? [['Pembayaran tercatat', d.mkt.pembayaran ? `${d.mkt.pembayaran} transaksi` : 'belum ada']] as [string, string][] : []),
          ]"
        />
        <RadarKv
          v-if="d.klien"
          class="mt-3"
          :rows="[
            ['Klien', d.klien.nama + (d.klien.perusahaan ? ` — ${d.klien.perusahaan}` : '')],
            ['PIC klien', d.klien.pic || d.klien.nama],
            ['Kontak', d.klien.hp],
          ]"
        />
        <AppSectionTitle
          title="Detail lengkap"
          class="mt-5"
        />
        <p
          v-if="!baris.length"
          class="text-sm text-muted"
        >
          Belum ada isian detail.
        </p>
        <div
          v-else
          class="overflow-hidden rounded-field border border-default"
        >
          <div
            v-for="r in baris"
            :key="r.label"
            class="grid gap-1 border-b border-default px-3 py-2 last:border-b-0 sm:grid-cols-[34%_1fr] sm:gap-3"
          >
            <span class="text-xs text-muted">{{ r.label }}</span>
            <div
              v-if="r.lampiran"
              class="flex flex-wrap gap-2"
            >
              <template
                v-for="l in r.lampiran"
                :key="l.key"
              >
                <span
                  v-if="berkas[l.key] === 'memuat'"
                  class="text-xs text-muted"
                >Memuat {{ l.name }}…</span>
                <span
                  v-else-if="!urlOf(l)"
                  class="text-xs text-muted"
                >{{ l.name }} — berkas tidak ada</span>
                <a
                  v-else-if="lampiranGambar(l.name)"
                  :href="urlOf(l)"
                  target="_blank"
                  rel="noopener"
                >
                  <img
                    :src="urlOf(l)"
                    :alt="l.name"
                    class="max-h-48 rounded-field border border-default"
                  >
                </a>
                <a
                  v-else
                  :href="urlOf(l)"
                  :download="l.name"
                  class="inline-flex items-center gap-1 text-sm text-primary-700 hover:underline"
                ><UIcon
                  name="i-lucide-paperclip"
                  class="size-4"
                />{{ l.name }}</a>
              </template>
            </div>
            <span
              v-else
              class="whitespace-pre-wrap text-sm"
            >{{ r.teks }}</span>
          </div>
        </div>
      </template>

      <template v-else-if="d.sumber === 'vip' && d.vip">
        <RadarKv
          :rows="[
            ['Waktu', waktu],
            ['Meja', d.tempat],
            ['Tamu', paxVipTeks(d) || '—'],
            ['Marketing PIC', d.vip.mktPIC],
            ['Perusahaan', d.vip.perusahaan || d.klien?.perusahaan],
            ['Kontak', d.vip.hp || d.klien?.hp],
          ]"
        />
        <template v-if="d.vip.catatan">
          <AppSectionTitle
            title="Catatan reservasi"
            class="mt-5"
          />
          <p class="whitespace-pre-wrap rounded-field border border-default p-3 text-sm">
            {{ d.vip.catatan }}
          </p>
        </template>
      </template>

      <template v-else-if="d.event">
        <RadarKv
          :rows="[
            ['Waktu', waktu],
            ['Venue', d.event.venue],
            ['Kategori', d.event.category],
            ['Kapasitas', d.event.capacity ?? '—'],
            ['PIC', d.event.pic],
            ['Co-PIC', d.event.co_pic],
            ['Tema', d.event.theme],
            ['Tiketing', d.event.is_ticketed ? 'Ya' : 'Tidak'],
          ]"
        />
        <p
          v-if="desk"
          class="mt-4 whitespace-pre-wrap rounded-field border border-default p-3 text-sm"
        >
          {{ desk }}
        </p>
        <template v-if="d.talents?.length">
          <AppSectionTitle
            title="Talent terjadwal"
            class="mt-5"
          />
          <ul class="divide-y divide-default">
            <li
              v-for="(t, i) in d.talents"
              :key="i"
              class="flex items-center gap-3 py-2 text-sm"
            >
              <b class="flex-1 text-highlighted">{{ t.nama }}</b>
              <span
                v-if="t.tipe"
                class="text-muted"
              >{{ t.tipe }}</span>
              <span
                v-if="t.jam"
                class="num text-muted"
              >{{ t.jam }}</span>
            </li>
          </ul>
        </template>
      </template>

      <p class="mt-5 text-xs text-muted print:hidden">
        Radar hanya membaca. Perubahan tetap dilakukan di modul asalnya.
      </p>
    </AppPanel>
  </AppPage>
</template>
