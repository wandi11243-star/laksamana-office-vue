<!--
  Radar › Detail Lengkap — a printable read-only document, in the shape of the
  Marketing event Overview (renderOverview): letter head, fact strip, highlight
  call-out, then numbered sections with label–value rows, tables, centred
  images and note boxes.

  Only RadarDetail fields are shown (useRadar.ts): agenda head, klien, and the
  payload that matches `sumber` (mkt.detail, vip, event + talents). Marketing
  sections (D.1–D.11) only set the ORDER of the mkt rows — no marketing-only
  field is borrowed. Money figures only reach a Head (the API drops them), so
  this page never decides what to hide. Attachments are fetched with the token
  (the file endpoint needs Bearer), only when the page opens.
-->
<script setup lang="ts">
import type { RadarDetail, SumberAgenda } from '~/composables/useRadar'
import type { BarisDetail, Lampiran } from '~/utils/radar'
import {
  IKON_SUMBER, LABEL_SUMBER, SUMBER_PENDEK, WARNA_SUMBER, dDay, dLabel, dWarna, detailFields,
  paxVipTeks, tanpaTag,
} from '~/utils/radar'
import { SEKSI_EVENT_MKT } from '~/utils/marketing-event'
import { fTgl } from '~/utils/format'

definePageMeta({ access: ['radar'] })

const route = useRoute()
const me = useMe()
const sumber = String(route.params.sumber) as SumberAgenda
const id = String(route.params.id)

const { data: d, status, error } = useAsyncData(`radar-detail-${sumber}-${id}`, () =>
  ['mkt', 'evt', 'vip'].includes(sumber) ? getRadarDetail(sumber, id) : Promise.resolve(null as RadarDetail | null))

const waktu = computed(() => (d.value ? `${d.value.jam || '—'}${d.value.selesai ? `–${d.value.selesai}` : ''}` : ''))
const dicetak = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

// key → object URL (or '' = failed). Revoked when the page leaves.
const berkasUrl = ref<Record<string, string>>({})
watch(() => d.value?.mkt, async (mkt) => {
  if (!mkt) return
  for (const r of detailFields(mkt.detail)) {
    for (const l of r.lampiran ?? []) {
      if (l.key in berkasUrl.value) continue
      berkasUrl.value[l.key] = 'memuat'
      try {
        berkasUrl.value[l.key] = await getRadarFileUrl(l.key)
      }
      catch {
        berkasUrl.value[l.key] = ''
      }
    }
  }
}, { immediate: true })
onBeforeUnmount(() => {
  for (const u of Object.values(berkasUrl.value)) if (u.startsWith('blob:')) URL.revokeObjectURL(u)
})
const urlOf = (l: Lampiran) => berkasUrl.value[l.key] || ''
const sedangMemuat = (l: Lampiran) => berkasUrl.value[l.key] === 'memuat'

// ---- marketing: highlight call-out + rows grouped in D.1–D.11 order ----
const mentahMkt = computed(() => (d.value?.mkt?.detail ?? {}) as Record<string, unknown>)
const sorotMkt = computed(() => tanpaTag(mentahMkt.value.highlight ?? ''))

interface SeksiDok { n: string, title: string, baris: BarisDetail[] }

/** Field key → its D section (first claim wins, like the Overview tabs). */
const seksiDariKunci = (() => {
  const m = new Map<string, { id: string, n: string, title: string }>()
  for (const s of SEKSI_EVENT_MKT) for (const f of s.fields) if (!m.has(f.k)) m.set(f.k, s)
  return m
})()

const seksiMkt = computed<SeksiDok[]>(() => {
  if (!d.value?.mkt) return []
  const grup = new Map<string, SeksiDok>()
  const lain: BarisDetail[] = []
  for (const r of detailFields(mentahMkt.value)) {
    if (r.k === 'highlight') continue
    const s = seksiDariKunci.get(r.k)
    if (!s) {
      lain.push(r)
      continue
    }
    let g = grup.get(s.id)
    if (!g) {
      g = { n: s.n, title: s.title, baris: [] }
      grup.set(s.id, g)
    }
    g.baris.push(r)
  }
  const urut = SEKSI_EVENT_MKT.map(s => s.id).filter(id => grup.has(id)).map(id => grup.get(id)!)
  if (lain.length) urut.push({ n: 'Lain', title: 'Lainnya', baris: lain })
  return urut
})

// ---- fact strips (the grey box under the letter head, like the Overview) ----
const metaMkt = computed<[string, string][]>(() => {
  const v = d.value
  if (!v?.mkt) return []
  const klien = v.klien ? `${v.klien.nama}${v.klien.perusahaan ? ` — ${v.klien.perusahaan}` : ''}` : '—'
  const rows: [string, string][] = [
    ['Klien', klien],
    ['Marketing PIC', v.mkt.mktPIC || '—'],
    ['Jenis', v.jenis || '—'],
    ['Pax event', v.pax ? `${v.pax} pax` : '—'],
    ['Waktu', waktu.value],
    ['Tempat', v.tempat || '—'],
  ]
  if (v.bolehUang) rows.push(['Pembayaran tercatat', v.mkt.pembayaran ? `${v.mkt.pembayaran} transaksi` : 'belum ada'])
  return rows
})

const kontakMkt = computed<BarisDetail[]>(() => {
  const k = d.value?.klien
  if (!k) return []
  return [
    { k: 'pic', label: 'PIC klien', teks: k.pic || k.nama || '—' },
    { k: 'hp', label: 'Kontak', teks: k.hp || '—' },
  ]
})

const metaVip = computed<[string, string][]>(() => {
  const v = d.value
  if (!v?.vip) return []
  return [
    ['Waktu', waktu.value],
    ['Meja', v.tempat || '—'],
    ['Tamu', paxVipTeks(v) || '—'],
    ['Marketing PIC', v.vip.mktPIC || '—'],
    ['Perusahaan', v.vip.perusahaan || v.klien?.perusahaan || '—'],
    ['Kontak', v.vip.hp || v.klien?.hp || '—'],
  ]
})

const klienVip = computed<BarisDetail[]>(() => {
  const k = d.value?.klien
  if (!k || !(k.nama || k.pic)) return []
  return [
    { k: 'nama', label: 'Klien', teks: `${k.nama}${k.perusahaan ? ` — ${k.perusahaan}` : ''}` },
    { k: 'pic', label: 'PIC klien', teks: k.pic || k.nama },
  ]
})

const kapasitasTeks = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? '—' : String(v))

const metaEvt = computed<[string, string][]>(() => {
  const v = d.value
  if (!v?.event) return []
  return [
    ['Waktu', waktu.value],
    ['Venue', v.event.venue || '—'],
    ['Kategori', v.event.category || '—'],
    ['Kapasitas', kapasitasTeks(v.event.capacity)],
    ['PIC', v.event.pic || '—'],
    ['Co-PIC', v.event.co_pic || '—'],
    ['Tema', v.event.theme || '—'],
    ['Tiketing', v.event.is_ticketed ? 'Ya' : 'Tidak'],
  ]
})

const desk = computed(() => (d.value?.event?.description ? tanpaTag(d.value.event.description) : ''))
const noTalentEvt = computed(() => (desk.value ? 2 : 1))
const noCatatanVip = computed(() => (klienVip.value.length ? 2 : 1))

const cetak = () => window.print()
</script>

<template>
  <AppPage
    title="Detail Event"
    description="Detail lengkap, baca-saja — bisa dicetak atau disimpan sebagai PDF."
  >
    <template #actions>
      <div class="flex flex-wrap gap-2 print:hidden">
        <UButton
          label="Daftar Event"
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="outline"
          class="min-h-11"
          to="/radar/agenda"
        />
        <UButton
          v-if="d"
          label="Cetak / Simpan PDF"
          icon="i-lucide-printer"
          class="min-h-11"
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

    <article
      v-else
      class="mx-auto w-full max-w-[860px] rounded-xl border border-default bg-default p-4 text-sm sm:p-6 print:max-w-none print:rounded-none print:border-0 print:shadow-none"
    >
      <header class="mb-4 flex flex-wrap items-center gap-3 border-b-4 border-brand-yellow pb-4">
        <img
          src="/mark.png"
          alt=""
          class="size-11 shrink-0 object-contain"
        >
        <div class="min-w-[160px] flex-1">
          <p class="font-display text-xl font-bold text-highlighted">
            Laksamana Muda
          </p>
          <p class="text-[10px] tracking-[0.2em] text-yellow-dark">
            COFFEE &amp; LIVE SPACE
          </p>
        </div>
        <div class="min-w-[180px] text-right">
          <p class="text-[10px] font-bold tracking-[0.15em] text-yellow-dark">
            RANGKUMAN ACARA
          </p>
          <p class="mt-1 font-display text-lg font-bold text-highlighted">
            {{ d.judul || '—' }}
          </p>
          <p class="text-xs text-muted">
            {{ fTgl(d.tgl) }}{{ waktu !== '—' ? ` · ${waktu}` : '' }}
          </p>
        </div>
      </header>

      <div class="mb-3 flex flex-wrap gap-1.5">
        <AppStatus
          :color="WARNA_SUMBER[d.sumber]"
          :icon="IKON_SUMBER[d.sumber]"
          size="sm"
        >
          {{ SUMBER_PENDEK[d.sumber] }}
        </AppStatus>
        <AppStatus size="sm">
          {{ LABEL_SUMBER[d.sumber] }}
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
      <p class="mb-3 text-xs text-muted">
        Dicetak {{ dicetak }} oleh {{ me?.name || '—' }}
      </p>

      <!-- ═══ Marketing · Event Klien ═══ -->
      <template v-if="d.sumber === 'mkt' && d.mkt">
        <div class="mb-3 grid gap-x-6 gap-y-1 rounded-lg bg-muted px-4 py-3 text-sm sm:grid-cols-2">
          <p
            v-for="m in metaMkt"
            :key="m[0]"
          >
            <b>{{ m[0] }}</b> · {{ m[1] }}
          </p>
        </div>

        <div
          v-if="sorotMkt"
          class="mb-4 rounded-r-lg border-l-4 border-yellow-deep bg-yellow-light px-4 py-3 text-sm"
        >
          <p class="mb-1 text-[10px] font-bold tracking-[0.14em] text-yellow-dark">
            POIN PENTING
          </p>
          <p class="whitespace-pre-line leading-relaxed">
            {{ sorotMkt }}
          </p>
        </div>

        <section
          v-if="kontakMkt.length"
          class="mb-5 break-inside-avoid last:mb-0"
        >
          <h3 class="mb-2 flex items-center gap-2 border-b border-default pb-2 text-sm font-semibold text-highlighted">
            <span class="flex h-6 min-w-10 items-center justify-center rounded-md bg-yellow-light px-2 text-xs font-bold text-yellow-dark num">
              1
            </span>
            Kontak klien
          </h3>
          <RadarDokumenIsi
            :baris="kontakMkt"
            :url-of="urlOf"
            :sedang-memuat="sedangMemuat"
          />
        </section>

        <p
          v-if="!seksiMkt.length"
          class="text-sm text-muted"
        >
          Belum ada isian detail.
        </p>
        <section
          v-for="s in seksiMkt"
          :key="s.n + s.title"
          class="mb-5 break-inside-avoid last:mb-0"
        >
          <h3 class="mb-2 flex items-center gap-2 border-b border-default pb-2 text-sm font-semibold text-highlighted">
            <span class="flex h-6 min-w-10 items-center justify-center rounded-md bg-yellow-light px-2 text-xs font-bold text-yellow-dark num">
              {{ s.n }}
            </span>
            {{ s.title }}
          </h3>
          <RadarDokumenIsi
            :baris="s.baris"
            :mentah="mentahMkt"
            :url-of="urlOf"
            :sedang-memuat="sedangMemuat"
          />
        </section>
      </template>

      <!-- ═══ Marketing · Reservasi VIP ═══ -->
      <template v-else-if="d.sumber === 'vip' && d.vip">
        <div class="mb-3 grid gap-x-6 gap-y-1 rounded-lg bg-muted px-4 py-3 text-sm sm:grid-cols-2">
          <p
            v-for="m in metaVip"
            :key="m[0]"
          >
            <b>{{ m[0] }}</b> · {{ m[1] }}
          </p>
        </div>

        <section
          v-if="klienVip.length"
          class="mb-5 break-inside-avoid last:mb-0"
        >
          <h3 class="mb-2 flex items-center gap-2 border-b border-default pb-2 text-sm font-semibold text-highlighted">
            <span class="flex h-6 min-w-10 items-center justify-center rounded-md bg-yellow-light px-2 text-xs font-bold text-yellow-dark num">
              1
            </span>
            Klien
          </h3>
          <RadarDokumenIsi
            :baris="klienVip"
            :url-of="urlOf"
            :sedang-memuat="sedangMemuat"
          />
        </section>

        <section
          v-if="d.vip.catatan.trim()"
          class="mb-5 break-inside-avoid last:mb-0"
        >
          <h3 class="mb-2 flex items-center gap-2 border-b border-default pb-2 text-sm font-semibold text-highlighted">
            <span class="flex h-6 min-w-10 items-center justify-center rounded-md bg-yellow-light px-2 text-xs font-bold text-yellow-dark num">
              {{ noCatatanVip }}
            </span>
            Catatan reservasi
          </h3>
          <p class="whitespace-pre-wrap rounded-xl border border-default p-3 text-sm">
            {{ d.vip.catatan.trim() }}
          </p>
        </section>
      </template>

      <!-- ═══ Event · Jadwal Acara ═══ -->
      <template v-else-if="d.event">
        <div class="mb-3 grid gap-x-6 gap-y-1 rounded-lg bg-muted px-4 py-3 text-sm sm:grid-cols-2">
          <p
            v-for="m in metaEvt"
            :key="m[0]"
          >
            <b>{{ m[0] }}</b> · {{ m[1] }}
          </p>
        </div>

        <section
          v-if="desk"
          class="mb-5 break-inside-avoid last:mb-0"
        >
          <h3 class="mb-2 flex items-center gap-2 border-b border-default pb-2 text-sm font-semibold text-highlighted">
            <span class="flex h-6 min-w-10 items-center justify-center rounded-md bg-yellow-light px-2 text-xs font-bold text-yellow-dark num">
              1
            </span>
            Deskripsi acara
          </h3>
          <p class="whitespace-pre-wrap rounded-xl border border-default p-3 text-sm">
            {{ desk }}
          </p>
        </section>

        <section
          v-if="d.talents?.length"
          class="mb-5 break-inside-avoid last:mb-0"
        >
          <h3 class="mb-2 flex items-center gap-2 border-b border-default pb-2 text-sm font-semibold text-highlighted">
            <span class="flex h-6 min-w-10 items-center justify-center rounded-md bg-yellow-light px-2 text-xs font-bold text-yellow-dark num">
              {{ noTalentEvt }}
            </span>
            Talent terjadwal
          </h3>
          <table class="w-full table-fixed border-collapse text-sm sm:table-auto print:table-auto">
            <thead>
              <tr class="bg-muted text-left text-xs text-muted">
                <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                  Nama
                </th>
                <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                  Tipe
                </th>
                <th class="border-b border-default px-2 py-1.5 print:border print:border-default">
                  Jam
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(t, i) in d.talents"
                :key="i"
                class="border-b border-default last:border-0"
              >
                <td class="break-words px-2 py-1.5 font-semibold text-highlighted print:border print:border-default">
                  {{ t.nama }}
                </td>
                <td class="break-words px-2 py-1.5 print:border print:border-default">
                  {{ t.tipe || '—' }}
                </td>
                <td class="break-words px-2 py-1.5 num print:border print:border-default">
                  {{ t.jam || '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>

      <!-- The API always sends the payload that matches `sumber`, but if it
        ever does not, say so instead of showing a bare header. -->
      <p
        v-if="(d.sumber === 'mkt' && !d.mkt) || (d.sumber === 'vip' && !d.vip) || (d.sumber === 'evt' && !d.event)"
        class="mt-4 rounded-xl border border-default bg-muted p-3 text-sm text-muted"
      >
        Detail acara ini belum lengkap. Coba muat ulang, atau lihat langsung di modul asalnya.
      </p>

      <p class="mt-5 text-xs text-muted print:hidden">
        Radar hanya membaca. Perubahan tetap dilakukan di modul asalnya.
      </p>
    </article>
  </AppPage>
</template>
