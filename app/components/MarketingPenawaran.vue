<!--
  Marketing › Surat Penawaran card on the event detail (penawaranCard,
  :10088-10190): upload the PDF the team made itself (chunked, 40 MB),
  approval by Manager/Approver, send over WhatsApp, revision rounds back to
  Prospect + the Negosiasi Lanjutan queue, and Konfirmasi Deal.
  The letter is NEVER generated here — the system template lives on the
  brief page as a negotiation draft, not an official letter.
-->
<script setup lang="ts">
import type { EventMkt, PenawaranMkt, SettingsMkt } from '~/utils/marketing'
import { MAKS_PDF_PENAWARAN_MKT, noSuratBaruMkt, revisiBerikutMkt } from '~/utils/marketing-event'
import { buatMkt, bukaBerkasMkt, logMkt, mktSimpan, tambalMkt, unggahBertahapMkt } from '~/composables/useMarketing'
import { eventFinance } from '~/utils/marketing-uang'
import { rupiah } from '~/utils/format'

const props = defineProps<{
  ev: EventMkt
  settings: SettingsMkt
  jumlahSurat: number
  namaClient: string
  clientHp: string
  bisaUbah: boolean
  bisaPutus: boolean
  sayaId: string
  sayaNama: string
}>()

const emit = defineEmits<{ deal: [] }>()
/** Open the revision sheet from outside (kanban shortcut via ?revisi=1). */
const revisiMinta = defineModel<boolean>('revisi', { default: false })
const toast = useToast()

const pen = computed<PenawaranMkt>(() => props.ev.penawaran ?? {})
const st = computed(() => pen.value.status ?? null)
const rev = computed(() => +(pen.value.revisiKe ?? 0) || 0)
const uang = computed(() => eventFinance(props.ev, props.settings))
const tahapAkhir = computed(() => ['Deal', 'Confirmed', 'Event Done'].includes(props.ev.status))

async function simpanPenawaran(patch: PenawaranMkt, sukses: string, aksi: string) {
  return mktSimpan(
    () => tambalMkt<EventMkt>('events', props.ev.id, { penawaran: { ...pen.value, ...patch } }, props.ev.updatedAt),
    sukses, { refType: 'event', refId: props.ev.id, action: aksi, detail: props.ev.nama },
  )
}

// ---- buat / ubah ----
const formBuka = ref(false)
const form = ref({ noSurat: '', validUntil: '', note: '' })
const pdfBaru = ref<File | null>(null)
const pdfPersen = ref(0)
const formSibuk = ref(false)
function bukaForm() {
  form.value = {
    noSurat: pen.value.noSurat || noSuratBaruMkt(props.jumlahSurat),
    validUntil: String(pen.value.validUntil ?? ''),
    note: String(pen.value.note ?? ''),
  }
  pdfBaru.value = null
  pdfPersen.value = 0
  formBuka.value = true
}
async function simpanForm() {
  const pdf = pdfBaru.value
  if (pdf && !/\.pdf$/i.test(pdf.name) && pdf.type !== 'application/pdf') {
    toast.add({ title: 'Harus PDF', description: 'Surat penawaran diunggah dalam format PDF.', color: 'error' })
    return
  }
  if (pdf && pdf.size > MAKS_PDF_PENAWARAN_MKT) {
    toast.add({ title: 'File terlalu besar', description: `Berkas PDF maksimal 40MB — punyamu ${(pdf.size / 1048576).toFixed(1)}MB.`, color: 'error' })
    return
  }
  formSibuk.value = true
  try {
    let file = pen.value.file
    if (pdf) {
      const d = await unggahBertahapMkt(pdf, v => (pdfPersen.value = Math.round(v * 100)))
      if (!d.key) throw new Error('unggah gagal')
      file = { key: d.key, name: pdf.name, size: pdf.size, at: new Date().toISOString(), by: props.sayaNama }
    }
    const ok = await simpanPenawaran(
      { noSurat: form.value.noSurat.trim(), validUntil: form.value.validUntil, note: form.value.note.trim(), file, ...(st.value ? {} : { status: 'Draft' }) },
      'Penawaran disimpan', 'mengubah surat penawaran',
    )
    if (ok) formBuka.value = false
  }
  catch (e) {
    toast.add({ title: 'Gagal menyimpan penawaran', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    formSibuk.value = false
  }
}

// ---- putus (approve) ----
const tolakBuka = ref(false)
const tolakNote = ref('')
async function putus(setuju: boolean) {
  if (!setuju) {
    tolakBuka.value = true
    return
  }
  await simpanPenawaran(
    { status: 'Disetujui', approvedBy: props.sayaId, approvedAt: new Date().toISOString(), rejectNote: '' },
    'Penawaran disetujui', 'menyetujui penawaran',
  )
}
async function kirimTolak() {
  const ok = await simpanPenawaran(
    { status: 'Ditolak', rejectNote: tolakNote.value.trim(), approvedBy: props.sayaId, approvedAt: new Date().toISOString() },
    'Penawaran ditolak', 'menolak penawaran',
  )
  if (ok) {
    tolakBuka.value = false
    tolakNote.value = ''
  }
}

// ---- kirim ----
const kirimBuka = ref(false)
async function kirim() {
  if (!['Disetujui', 'Terkirim'].includes(st.value ?? '')) {
    toast.add({ title: 'Belum disetujui', description: 'Penawaran harus disetujui Manager / Approver dulu sebelum dikirim ke client.', color: 'error' })
    return
  }
  if (!pen.value.file?.key) {
    toast.add({ title: 'PDF belum ada', description: 'Berkas surat penawarannya tidak ada — unggah dulu.', color: 'error' })
    return
  }
  const naik = ['Lead', 'Prospect', 'Approval'].includes(props.ev.status)
  const ok = await mktSimpan(
    () => tambalMkt<EventMkt>('events', props.ev.id, {
      penawaran: { ...pen.value, status: 'Terkirim', sentAt: new Date().toISOString(), sentBy: props.sayaId, sentVia: 'WhatsApp' },
      ...(naik ? { status: 'Quotation Terkirim', pipeCol: 'Quotation Terkirim' } : {}),
    }, props.ev.updatedAt),
    'Penawaran terkirim', { refType: 'event', refId: props.ev.id, action: 'Penawaran dikirim ke client', detail: 'WhatsApp' },
  )
  if (ok) kirimBuka.value = true
}
const pesanKirim = computed(() => {
  const c = props.namaClient
  const f = uang.value
  return `Halo ${c}, berikut surat penawaran untuk *${props.ev.nama}* (${props.ev.tanggal ?? ''})`
    + (f.grand ? `.\nGrand Total: ${rupiah(f.grand)}\nDP: ${rupiah(f.dp)}${f.paid ? `\nSudah dibayar: ${rupiah(f.paid)}\nSisa: ${rupiah(f.remaining)}` : ''}` : '.')
    + `\n\nSalam, ${props.sayaNama} — Laksamana Muda`
})
const waKirim = computed(() => {
  const hp = props.clientHp.replace(/\D/g, '')
  return hp.length >= 9 ? `https://wa.me/${hp}?text=${encodeURIComponent(pesanKirim.value)}` : ''
})

// ---- revisi ----
const revisiBuka = ref(false)
const revisiAlasan = ref('')
const revisiPdf = ref<File | null>(null)
const revisiSibuk = ref(false)
watch(revisiMinta, (v) => {
  if (v) {
    revisiBuka.value = true
    revisiMinta.value = false
  }
}, { immediate: true })
async function kirimRevisi() {
  const alasan = revisiAlasan.value.trim()
  if (!alasan) {
    toast.add({ title: 'Permintaan client wajib', description: 'Tanpa ini Approval Flow cuma memajang baris revisi yang tidak bisa diputuskan siapa pun.', color: 'error' })
    return
  }
  const pdf = revisiPdf.value
  if (pdf && pdf.size > MAKS_PDF_PENAWARAN_MKT) {
    toast.add({ title: 'File terlalu besar', description: 'Berkas PDF maksimal 40MB.', color: 'error' })
    return
  }
  revisiSibuk.value = true
  try {
    let file = pen.value.file
    if (pdf) {
      const d = await unggahBertahapMkt(pdf)
      if (!d.key) throw new Error('unggah gagal')
      file = { key: d.key, name: pdf.name, size: pdf.size, at: new Date().toISOString(), by: props.sayaNama }
    }
    const ke = revisiBerikutMkt(rev.value)
    const riwayat = [...(pen.value.revisiRiwayat ?? []), {
      ke, alasan, at: new Date().toISOString(), by: props.sayaId,
      sebelumnya: { status: 'Terkirim', sentAt: pen.value.sentAt ?? '', decidedAt: (pen.value as { decidedAt?: string }).decidedAt ?? '' },
    }]
    const turun = !['Deal', 'Confirmed', 'Event Done', 'Lost'].includes(props.ev.status)
    const ok = await mktSimpan(
      () => tambalMkt<EventMkt>('events', props.ev.id, {
        penawaran: {
          ...pen.value, file, revisiKe: ke, revisiAlasan: alasan, revisiRiwayat: riwayat,
          status: 'Menunggu Approval', submittedBy: props.sayaId, submittedAt: new Date().toISOString(),
          decidedBy: '', decidedAt: '', rejectNote: '',
        },
        ...(turun ? { status: 'Prospect', pipeCol: 'Prospect' } : {}),
      }, props.ev.updatedAt),
      'Revisi diajukan', { refType: 'event', refId: props.ev.id, action: 'Revisi penawaran diajukan', detail: `revisi ke-${ke}: ${alasan}` },
    )
    if (ok) {
      await buatMkt('notifications', {
        type: 'approval',
        title: 'Negosiasi Lanjutan menunggu approval',
        body: `${props.ev.nama} — revisi ke-${ke}: ${alasan}`,
        link: '/marketing/approvals',
        read: false,
        at: new Date().toISOString(),
      }).catch(() => {})
      await logMkt('event', props.ev.id, 'Masuk antrian Negosiasi Lanjutan', `revisi ke-${ke}`).catch(() => {})
      revisiBuka.value = false
      revisiAlasan.value = ''
      revisiPdf.value = null
    }
  }
  catch (e) {
    toast.add({ title: 'Gagal mengajukan revisi', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    revisiSibuk.value = false
  }
}
</script>

<template>
  <AppPanel title="Surat Penawaran">
    <template #head>
      <div class="flex flex-wrap items-center gap-1.5">
        <AppStatus
          v-if="st"
          :color="st === 'Disetujui' || st === 'Terkirim' ? 'success' : st === 'Ditolak' ? 'error' : st === 'Menunggu Approval' ? 'warning' : 'neutral'"
          :icon="st === 'Disetujui' || st === 'Terkirim' ? 'i-lucide-check' : st === 'Ditolak' ? 'i-lucide-x' : st === 'Menunggu Approval' ? 'i-lucide-hourglass' : 'i-lucide-file-text'"
        >
          {{ st === 'Terkirim' ? 'Terkirim ke Client' : st }}
        </AppStatus>
        <UBadge
          v-if="rev > 0"
          :label="`Negosiasi Lanjutan · revisi ke-${rev}`"
          color="neutral"
          variant="soft"
        />
      </div>
    </template>

    <div
      v-if="!st"
      class="text-sm text-muted"
    >
      <p>Belum ada surat penawaran. Marketing membuat sendiri PDF-nya lalu mengunggahnya di sini.</p>
      <UButton
        v-if="bisaUbah"
        icon="i-lucide-plus"
        label="Buat Penawaran"
        size="sm"
        class="mt-2"
        @click="bukaForm"
      />
    </div>
    <dl
      v-else
      class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm"
    >
      <dt class="text-muted">
        No. surat
      </dt>
      <dd>{{ pen.noSurat || '—' }}</dd>
      <dt class="text-muted">
        Berlaku s/d
      </dt>
      <dd>{{ pen.validUntil || '—' }}</dd>
      <dt class="text-muted">
        Berkas
      </dt>
      <dd>
        <UButton
          v-if="pen.file?.key"
          color="neutral"
          variant="link"
          size="xs"
          class="px-0 text-primary-700 underline"
          @click="bukaBerkasMkt(pen.file.key)"
        >
          Baca PDF
        </UButton>
        <span v-else>—</span>
      </dd>
      <dt
        v-if="pen.rejectNote"
        class="text-muted"
      >
        Alasan tolak
      </dt>
      <dd v-if="pen.rejectNote">
        {{ pen.rejectNote }}
      </dd>
    </dl>

    <div
      v-if="st"
      class="mt-3 flex flex-wrap gap-2"
    >
      <UButton
        v-if="bisaUbah && ['Draft', 'Ditolak'].includes(st)"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
        size="sm"
        :label="st === 'Ditolak' ? 'Perbaiki & Ajukan Lagi' : 'Ubah'"
        @click="bukaForm"
      />
      <UButton
        v-if="bisaUbah && st === 'Draft'"
        icon="i-lucide-send"
        color="neutral"
        variant="outline"
        size="sm"
        label="Ajukan Approval"
        @click="simpanPenawaran({ status: 'Menunggu Approval', submittedBy: sayaId, submittedAt: new Date().toISOString() }, 'Diajukan ke approval', 'mengajukan penawaran')"
      />
      <template v-if="bisaPutus && st === 'Menunggu Approval'">
        <UButton
          icon="i-lucide-check"
          size="sm"
          label="Setujui"
          @click="putus(true)"
        />
        <UButton
          icon="i-lucide-x"
          color="error"
          variant="outline"
          size="sm"
          label="Tolak"
          @click="putus(false)"
        />
      </template>
      <UButton
        v-if="bisaUbah && ['Disetujui', 'Terkirim'].includes(st)"
        icon="i-lucide-message-circle"
        color="neutral"
        variant="outline"
        size="sm"
        :label="st === 'Terkirim' ? 'Kirim ulang' : 'Kirim ke Client'"
        @click="kirim"
      />
      <UButton
        v-if="bisaUbah && st === 'Terkirim' && !tahapAkhir"
        icon="i-lucide-repeat"
        color="neutral"
        variant="outline"
        size="sm"
        label="Ajukan Revisi"
        @click="revisiBuka = true"
      />
      <UButton
        v-if="bisaUbah && st === 'Terkirim' && !tahapAkhir"
        icon="i-lucide-check-check"
        size="sm"
        label="Konfirmasi Deal"
        @click="emit('deal')"
      />
    </div>

    <ResponsiveSheet
      v-model:open="formBuka"
      :title="st === 'Ditolak' ? 'Perbaiki & Ajukan Lagi' : pen.file ? 'Ubah Penawaran' : 'Buat Penawaran'"
      :description="ev.nama"
    >
      <div class="grid gap-3">
        <UFormField label="No. surat">
          <UInput v-model="form.noSurat" />
        </UFormField>
        <UFormField label="Berlaku sampai">
          <UInput
            v-model="form.validUntil"
            type="date"
          />
        </UFormField>
        <UFormField label="Catatan">
          <UTextarea
            v-model="form.note"
            autoresize
          />
        </UFormField>
        <UFormField
          label="Berkas PDF"
          hint="Maks 40MB, diunggah bertahap."
        >
          <UInput
            type="file"
            accept="application/pdf,.pdf"
            @change="pdfBaru = ($event.target as HTMLInputElement).files?.[0] ?? null"
          />
          <p
            v-if="pdfPersen"
            class="mt-1 text-xs text-muted"
          >
            Mengunggah PDF… {{ pdfPersen }}%
          </p>
        </UFormField>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="formBuka = false"
        />
        <UButton
          label="Simpan"
          :loading="formSibuk"
          @click="simpanForm"
        />
      </div>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="tolakBuka"
      title="Tolak Penawaran"
      :description="ev.nama"
    >
      <UFormField label="Alasan penolakan">
        <UTextarea
          v-model="tolakNote"
          autoresize
        />
      </UFormField>
      <div class="mt-4 flex justify-end gap-2">
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="tolakBuka = false"
        />
        <UButton
          label="Tolak"
          color="error"
          @click="kirimTolak"
        />
      </div>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="kirimBuka"
      title="Kirim Surat Penawaran"
      :description="ev.nama"
    >
      <p class="text-sm text-muted">
        Unduh dulu berkas PDF-nya, lalu buka WhatsApp client dan lampirkan berkas itu bersama pesan yang sudah disiapkan.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton
          v-if="pen.file?.key"
          icon="i-lucide-file-text"
          color="neutral"
          variant="outline"
          label="Buka / Unduh PDF"
          @click="bukaBerkasMkt(pen.file.key)"
        />
        <UButton
          v-if="waKirim"
          icon="i-lucide-message-circle"
          label="Buka WhatsApp"
          :to="waKirim"
          target="_blank"
        />
      </div>
      <div class="mt-4 flex justify-end">
        <UButton
          label="Selesai"
          @click="kirimBuka = false"
        />
      </div>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="revisiBuka"
      title="Ajukan Revisi Penawaran"
      :description="`${ev.nama} — revisi ke-${revisiBerikutMkt(rev)}`"
    >
      <UFormField
        label="Apa yang diminta client?"
        required
      >
        <UTextarea
          v-model="revisiAlasan"
          placeholder="mis. minta tambah videotron & turun 10% dari harga penawaran pertama"
          autoresize
        />
        <template #hint>
          Kalimat ini yang dibaca manajemen di Approval Flow sebagai perkaranya.
        </template>
      </UFormField>
      <UFormField
        label="Berkas penawaran revisi (PDF, boleh menyusul)"
        class="mt-3"
      >
        <UInput
          type="file"
          accept="application/pdf,.pdf"
          @change="revisiPdf = ($event.target as HTMLInputElement).files?.[0] ?? null"
        />
      </UFormField>
      <UAlert
        color="warning"
        variant="subtle"
        description="Tahapnya turun ke Prospect dan perkaranya langsung masuk antrian Negosiasi Lanjutan di Approval Flow. Setelah disetujui, tahapnya naik ke Approval dan kamu sendiri yang mengirim ulang ke client."
        class="mt-3"
      />
      <div class="mt-4 flex justify-end gap-2">
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="revisiBuka = false"
        />
        <UButton
          label="Ajukan Revisi"
          :loading="revisiSibuk"
          @click="kirimRevisi"
        />
      </div>
    </ResponsiveSheet>
  </AppPanel>
</template>
