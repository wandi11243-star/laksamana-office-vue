<!--
  KwitansiSlot — the receipt state machine of one reservation (`:7142-7253`).

  Where the old screen drew it: the reservation detail, twice (the DP block
  and the modal foot, `:7879`, `:7913`) — never the Dana Masuk table, which is
  per transfer while a receipt is per booking. In Vue it mounts wherever a
  reservation's money is open: the DanaMasukPanel edit sheet now, the
  reservation detail later. Same component both places.

  Props: resId, reservasi (snapshot for totals), bolehMinta (old
  ROLE_KWI_MINTA minus viewer), bolehLangsung (old ROLE_KWI_LANGSUNG:
  manager/admin).

  Rules kept:
  - Issuing is guarded, not downloading: once DIBUAT anyone opening the
    detail may take the PDF (`:7151-7174`).
  - The request (and re-request) is HELD until every transfer is verified;
    `rejected` holds too. The reason is shown BEFORE pressing (F10).
  - Manager/admin never see Request: their button prints, with a warning
    naming the numbers instead of a lock. Without Finance's signature the
    sheet still prints, unsigned — a receipt that cannot print at all harms
    the waiting guest more (`:7130-7142`).

  Deferred to the finance session: auto-issuing for manager/admin
  (old invMinta+invPutus). That calls the decision endpoint with signatory
  choice, which belongs to the finance module; from here a manager without
  the finance module prints the unsigned sheet instead.
-->
<script setup lang="ts">
import type { Reservasi } from '~/composables/useReservasi'
import { postAudit } from '~/composables/useReservasi'
import { berkasKwitansi, mintaKwitansi, statusKwitansi, type StatusKwitansi } from '~/composables/useFinance'
import { apiErrorCode, apiErrorMessage } from '~/composables/useApi'
import {
  adaDp, auditCetakKwitansi, auditMintaKwitansi, invRingkas, kwiTertahan,
  kwiTertahanTeks, kwitansiData, kwitansiHtml, rupiahKwitansi, tulisLembar,
} from '~/utils/kwitansi'
import { dpJumlahTerverifikasi, dpTotal } from '~/utils/dp-reservasi'

const props = withDefaults(defineProps<{
  resId: string
  reservasi: Reservasi | null
  bolehMinta?: boolean
  bolehLangsung?: boolean
}>(), {
  bolehMinta: false,
  bolehLangsung: false,
})

const toast = useToast()

/** The request row: undefined = never asked, null = asked and nothing there (`:7047-7052`). */
const inv = ref<StatusKwitansi | null | undefined>(undefined)
const invGalat = ref('')

async function muatStatus() {
  if (!props.resId) return
  invGalat.value = ''
  try {
    const { data } = await statusKwitansi([props.resId])
    inv.value = (data && data[props.resId]) ? data[props.resId]! : null
  }
  catch (e) {
    // A network failure is NOT null: null means "asked, nothing there", and
    // mixing the two offers Request for a booking that already has one.
    inv.value = undefined
    invGalat.value = apiErrorMessage(e)
  }
}

watch(() => props.resId, muatStatus, { immediate: true })

const tahan = computed(() => kwiTertahan(props.reservasi))
const sudahTerbit = computed(() => !!inv.value && inv.value.status === 'DIBUAT')

const sheetMinta = ref(false)

function bukaMinta() {
  if (!props.bolehMinta) {
    toast.add({ title: 'Anda tidak punya akses meminta kwitansi.', color: 'error' })
    return
  }
  if (!adaDp(props.reservasi)) {
    toast.add({ title: 'Tamu ini belum ada DP', color: 'error' })
    return
  }
  // THE real gate: hiding the button never guards a global function (`:7224-7229`).
  const t = kwiTertahan(props.reservasi)
  if (t) {
    toast.add({ title: `Kwitansi belum bisa diminta — ${kwiTertahanTeks(t)}. Verifikasi dulu di halaman Dana Masuk (DP).`, color: 'error' })
    return
  }
  sheetMinta.value = true
}

async function mintaGo() {
  const r = props.reservasi
  if (!r) return
  sheetMinta.value = false
  try {
    const { data } = await mintaKwitansi({ resId: r.id, jenis: 'KWITANSI', ringkas: invRingkas(r) })
    inv.value = data ?? null
    await postAudit({ action: 'Request Kwitansi', detail: auditMintaKwitansi(r), res: r.id })
    toast.add({ title: inv.value?.status === 'DIBUAT' ? 'Kwitansi resmi sudah terbit' : 'Permintaan kwitansi terkirim ke Finance', color: 'success' })
  }
  catch (e) {
    toast.add({ title: `Gagal mengirim permintaan: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

async function pdfGo() {
  const r = props.reservasi
  if (!r) return
  // The gate guards ISSUING, not downloading — but without either path nobody prints.
  if (!props.bolehLangsung && !sudahTerbit.value) {
    toast.add({ title: 'Kwitansi resmi belum diterbitkan Finance. Tekan Request Kwitansi dulu.', color: 'error' })
    return
  }
  if (!adaDp(r)) {
    toast.add({ title: 'Tamu ini belum ada DP', color: 'error' })
    return
  }
  // Opened SYNC in the gesture: one await before it and the browser blocks the popup.
  const w = window.open('', '_blank', 'width=860,height=980')
  if (!w) {
    toast.add({ title: 'Popup diblokir — izinkan popup untuk membuat PDF', color: 'error' })
    return
  }
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Menyiapkan kwitansi…</title></head>'
    + '<body style="font:14px sans-serif;color:#5c574d;padding:40px">Menyiapkan kwitansi…</body></html>')
  w.document.close()
  try {
    const { data } = await berkasKwitansi(r.id)
    tulisLembar(w, kwitansiHtml(kwitansiData(r, data)))
    await postAudit({ action: 'Kwitansi DP (PDF)', detail: auditCetakKwitansi(r, true, data.no), res: r.id })
  }
  catch (e) {
    if (apiErrorCode(e) === 'not_issued') {
      try {
        w.document.open()
        w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Kwitansi belum terbit</title></head>'
          + '<body style="font:14px sans-serif;padding:40px;line-height:1.7">'
          + '<b>Kwitansi resmi belum terbit</b><br>Finance belum menerbitkan kwitansi untuk reservasi ini.</body></html>')
        w.document.close()
      }
      catch { /* the window was closed */ }
      await muatStatus()
      toast.add({ title: 'Kwitansi resmi belum diterbitkan Finance untuk reservasi ini.', color: 'error' })
      return
    }
    if (props.bolehLangsung) {
      // Finance unreachable: the sheet still prints, unsigned. A receipt that
      // cannot print at all harms the waiting guest more (`:7332-7340`).
      tulisLembar(w, kwitansiHtml(kwitansiData(r, null)))
      await postAudit({ action: 'Kwitansi DP (PDF)', detail: auditCetakKwitansi(r, false, ''), res: r.id })
      toast.add({ title: `Kwitansi dicetak tanpa tanda tangan — modul Finance tak terjangkau (${apiErrorMessage(e)})`, color: 'error' })
      return
    }
    try {
      w.close()
    }
    catch { /* already closed */ }
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

/** Render the sheet HTML to a PDF data URI in the browser (1 lib: html2pdf). */
async function htmlKePdf(html: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const style = doc.querySelector('style')?.textContent ?? ''
  const body = doc.body.innerHTML
  const styleEl = document.createElement('style')
  styleEl.textContent = style
  document.head.appendChild(styleEl)
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;'
  box.innerHTML = body
  document.body.appendChild(box)
  try {
    const { default: html2pdf } = await import('html2pdf.js')
    return String(await html2pdf().set({
      margin: 6,
      image: { type: 'jpeg', quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(box).outputPdf('datauristring'))
  }
  finally {
    box.remove()
    styleEl.remove()
  }
}

const kirimLoading = ref(false)

/** Send the receipt to the guest's WhatsApp through the n8n webhook. */
async function kirimGo() {
  const r = props.reservasi
  if (!r) return
  const hook = String(useRuntimeConfig().public.kwitansiWebhook || '')
  if (!hook) {
    toast.add({ title: 'Kirim ke WhatsApp belum dikonfigurasi (NUXT_PUBLIC_KWITANSI_WEBHOOK).', color: 'error' })
    return
  }
  if (!adaDp(r)) {
    toast.add({ title: 'Tamu ini belum ada DP', color: 'error' })
    return
  }
  // Prefer the guest's own WhatsApp conversation; fall back to the phone.
  const conv = Number((r as unknown as { wa_conversation?: number }).wa_conversation || 0)
  const phone = String(r.phone || '')
  if (!conv && !phone) {
    toast.add({ title: 'Tamu ini tidak punya nomor / percakapan WhatsApp.', color: 'error' })
    return
  }
  kirimLoading.value = true
  try {
    const data = sudahTerbit.value ? (await berkasKwitansi(r.id)).data : null
    const pdf = (await htmlKePdf(kwitansiHtml(kwitansiData(r, data)))).replace(/^data:application\/pdf;base64,/, '')
    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resId: r.id, conversation_id: conv || undefined, phone, pdf_base64: pdf }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await postAudit({ action: 'Kwitansi DP (WhatsApp)', detail: auditCetakKwitansi(r, sudahTerbit.value, data?.no || ''), res: r.id })
    toast.add({ title: 'Kwitansi dikirim ke WhatsApp tamu.', color: 'success' })
  }
  catch (e) {
    toast.add({ title: `Gagal mengirim kwitansi: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    kirimLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UButton
      v-if="sudahTerbit"
      label="Kwitansi PDF"
      color="neutral"
      variant="soft"
      size="sm"
      @click="pdfGo"
    />
    <template v-else-if="bolehLangsung">
      <UButton
        label="Kwitansi PDF"
        color="neutral"
        variant="soft"
        size="sm"
        @click="pdfGo"
      />
      <AppStatus v-if="tahan">
        {{ kwiTertahanTeks(tahan) }}
      </AppStatus>
    </template>
    <AppStatus v-else-if="inv && inv.status === 'MENUNGGU'">
      Kwitansi menunggu Finance{{ inv.mintaOleh ? ` · diminta ${inv.mintaOleh}` : '' }}
    </AppStatus>
    <template v-else-if="inv && inv.status === 'DITOLAK'">
      <AppStatus>
        Kwitansi ditolak{{ inv.catatan ? ` · ${inv.catatan}` : '' }}
      </AppStatus>
      <AppStatus v-if="tahan">
        Menunggu verifikasi dana masuk
      </AppStatus>
      <UButton
        v-else-if="bolehMinta"
        label="Request ulang"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="bukaMinta"
      />
    </template>
    <UButton
      v-else-if="inv === undefined"
      label="Status kwitansi…"
      color="neutral"
      variant="ghost"
      size="sm"
      @click="muatStatus"
    />
    <AppStatus v-else-if="!bolehMinta">
      Belum ada kwitansi
    </AppStatus>
    <AppStatus v-else-if="tahan">
      Dana masuk belum diverifikasi
    </AppStatus>
    <UButton
      v-else-if="bolehMinta"
      label="Request kwitansi"
      color="neutral"
      variant="soft"
      size="sm"
      @click="bukaMinta"
    />
    <span
      v-if="tahan && (bolehMinta || sudahTerbit)"
      class="text-xs text-muted"
    >{{ kwiTertahanTeks(tahan) }}. Verifikasi di halaman Dana Masuk (DP).</span>

    <UButton
      v-if="sudahTerbit || bolehLangsung"
      label="Kirim ke customer"
      icon="i-lucide-send"
      color="primary"
      variant="soft"
      size="sm"
      :loading="kirimLoading"
      @click="kirimGo"
    />

    <ResponsiveSheet
      v-model:open="sheetMinta"
      :title="`Minta kwitansi — ${reservasi?.name ?? ''}`"
    >
      <div
        v-if="reservasi"
        class="space-y-2 text-sm"
      >
        <div class="flex justify-between gap-3 border-b border-default py-1.5">
          <span class="text-muted">Total DP</span>
          <b>{{ rupiahKwitansi(dpTotal(reservasi)) }}</b>
        </div>
        <div class="flex justify-between gap-3 border-b border-default py-1.5">
          <span class="text-muted">Terverifikasi</span>
          <span>{{ rupiahKwitansi(dpJumlahTerverifikasi(reservasi)) }}</span>
        </div>
        <p class="text-muted">
          Finance akan memeriksa dana masuknya dulu, lalu menerbitkan kwitansi bertanda tangan &amp; cap.
          Tombol Kwitansi PDF muncul di sini begitu terbit.
        </p>
      </div>
      <template #footer>
        <UButton
          label="Minta ke Finance"
          size="xl"
          @click="mintaGo"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheetMinta = false"
        />
      </template>
    </ResponsiveSheet>
  </div>
</template>
