<!--
  Booking notification over WhatsApp (old `openWAModal`, deploy/reservasi/index.html:4991-5062):
  one card per team target from `master.waTargets` (preview + copy + open),
  plus a custom card (tick the fields, optional number, preview + copy + open).

  The message wording is the old one verbatim — it lands in a chat, where
  emoji are allowed (DESIGN.md). A group has no number: like the old client,
  the text is copied and the app is opened for a manual paste.
-->
<script setup lang="ts">
import type { Reservasi, WaTarget } from '~/composables/useReservasi'
import { useSection } from '~/composables/useReservasi'
import { dpsTampilan, dpTotal, normPhone } from '~/utils/dp-reservasi'
import { rupiah, tglPanjang } from '~/utils/format'
import { waKirim, waSalin } from '~/utils/wa'

const props = defineProps<{
  r: Reservasi | null
}>()

const open = defineModel<boolean>('open', { default: false })
const toast = useToast()
const { data: waTargets } = useSection<WaTarget[]>('waTargets')

const FIELD_LABELS: Record<string, string> = {
  nama: 'Nama tamu',
  tanggal: 'Tanggal',
  jam: 'Jam',
  pax: 'Jumlah pax',
  meja: 'Meja',
  menu: 'Menu request',
  catatan: 'Catatan khusus',
  dp: 'Info DP',
  pic: 'PIC',
  source: 'Sumber info',
}
const centang = ref<string[]>(['nama', 'tanggal', 'jam', 'pax', 'meja'])
const nomorCustom = ref('')

/** "2026-10-20" -> "Sel, 20 Okt 2026", like the old `fmtDate`. */
const fmtTgl = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(+d)
    ? iso
    : d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function teksWA(r: Reservasi, fields: string[]): string {
  const L = ['*RESERVASI LAKSAMANA MUDA* ⚓', '─────────────────']
  if (fields.includes('nama')) L.push(`👤 Nama : ${r.name}`)
  if (fields.includes('tanggal')) L.push(`📅 Tanggal : ${fmtTgl(r.date)}`)
  if (fields.includes('jam')) L.push(`🕗 Jam : ${r.time} WIB`)
  if (fields.includes('pax')) L.push(`👥 Pax : ${r.pax} orang`)
  if (fields.includes('meja') && r.table) L.push(`🪑 Meja : ${r.table}`)
  if (fields.includes('menu')) {
    if (r.foodReq) L.push(`🍽️ Makanan : ${r.foodReq}`)
    if (r.drinkReq) L.push(`🥤 Minuman : ${r.drinkReq}`)
  }
  if (fields.includes('dp')) {
    L.push('─────────────────')
    L.push(`💰 Status DP : ${r.dpStatus}`)
    if (r.dpStatus === 'Sudah') {
      L.push(`   Nominal : ${rupiah(dpTotal(r) || r.dpAmount)}`)
      L.push(`   Metode : ${r.dpMethod || '-'}`)
      if (dpsTampilan(r).some(p => p.proofData)) L.push('   (Bukti transfer terlampir di sistem)')
    }
  }
  if (fields.includes('catatan') && r.notes) L.push(`📝 Catatan : ${r.notes}`)
  if (fields.includes('pic')) L.push(`🧭 PIC : ${(r.picName || '-') + (r.picType === 'Marketing' ? ' (Marketing)' : '')}`)
  if (fields.includes('source') && r.source) L.push(`📣 Sumber : ${r.source}`)
  L.push('─────────────────')
  L.push(`_Diinput oleh ${r.createdBy || '-'}_`)
  return L.join('\n')
}

/**
 * The confirmation for the GUEST (owner request, Nov 2026): "Kirim WA" is first
 * of all how the crew tells the guest their booking is confirmed. Prefilled and
 * editable; copied, or opened straight in a chat with the guest's number.
 */
function teksKonfirmasi(r: Reservasi): string {
  const L = [
    `Halo Kak ${r.name} 👋`,
    '',
    'Terima kasih sudah reservasi di *Laksamana Muda* ⚓',
    'Reservasi Kakak sudah kami *konfirmasi*:',
    '',
    `📅 ${tglPanjang(r.date)}`,
    `🕗 Jam ${r.time} WIB`,
    `👥 ${r.pax} orang`,
  ]
  if (r.table) L.push(`🪑 Meja ${r.table}`)
  if (r.dpStatus === 'Sudah') L.push(`💰 DP diterima ${rupiah(dpTotal(r) || r.dpAmount)}`)
  L.push('', 'Kalau ada perubahan jam atau jumlah orang, kabari kami lewat chat ini ya Kak. Sampai jumpa! 🙏', '', '_Sail to Good Taste, Stay for the Vibes_')
  return L.join('\n')
}

const teksTamu = ref('')
watch([open, () => props.r], ([o, r]) => {
  if (o && r) teksTamu.value = teksKonfirmasi(r)
}, { immediate: true })
const adaNomorTamu = computed(() => normPhone(props.r?.phone ?? '').length >= 8)

const teksUntuk = (t: WaTarget) => (props.r ? teksWA(props.r, t.fields ?? []) : '')
const teksCustom = computed(() => (props.r ? teksWA(props.r, centang.value) : ''))

async function salin(teks: string) {
  const ok = await waSalin(teks)
  toast.add({ title: ok ? 'Pesan disalin' : 'Gagal menyalin — salin manual dari pratinjau', color: ok ? 'success' : 'error' })
}

/** A group has no number: copy the text and open the app for a manual paste. */
async function kirim(tujuan: string | null, teks: string) {
  if (tujuan && normPhone(tujuan).length >= 8) await waKirim(tujuan, teks)
  else await waKirim(null, teks)
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Kirim WhatsApp"
    :description="r ? `${r.name} · ${r.date} ${r.time}` : ''"
  >
    <div
      v-if="r"
      class="space-y-3"
    >
      <div class="rounded-lg border-2 border-success/50 p-3">
        <p class="flex items-center gap-2 font-semibold text-highlighted">
          <UIcon
            name="i-lucide-message-circle"
            class="size-5 text-success"
          />Konfirmasi ke tamu
        </p>
        <p class="text-sm text-muted">
          {{ adaNomorTamu ? `Dikirim ke ${r.name} · ${r.phone}` : 'Nomor tamu belum diisi — salin pesannya lalu kirim manual.' }}
          Pesan bisa diubah dulu sebelum dikirim.
        </p>
        <UTextarea
          v-model="teksTamu"
          :rows="10"
          autoresize
          class="my-2 w-full"
        />
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <UButton
            label="Kirim ke WhatsApp tamu"
            icon="i-lucide-send"
            color="success"
            size="lg"
            class="justify-center"
            :disabled="!adaNomorTamu"
            loading-auto
            @click="kirim(r.phone, teksTamu)"
          />
          <UButton
            label="Salin pesan"
            icon="i-lucide-copy"
            color="neutral"
            variant="soft"
            size="lg"
            class="justify-center"
            loading-auto
            @click="salin(teksTamu)"
          />
        </div>
      </div>

      <p class="pt-2 text-xs font-bold uppercase tracking-wide text-muted">
        Notifikasi ke tim
      </p>
      <p
        v-if="!(waTargets ?? []).length"
        class="rounded-lg border border-default bg-default p-3 text-sm text-muted"
      >
        Belum ada tujuan WhatsApp di Kelola Akses — pesan custom di bawah tetap bisa dipakai.
      </p>
      <div
        v-for="t in (waTargets ?? [])"
        :key="t.id"
        class="rounded-lg border border-default p-3"
      >
        <p class="font-semibold text-highlighted">
          {{ t.name }}
          <AppStatus
            class="ms-1"
            :color="t.includeDP ? 'success' : 'neutral'"
            size="sm"
          >
            {{ t.includeDP ? 'fokus DP' : 'tanpa DP' }}
          </AppStatus>
        </p>
        <p class="text-sm text-muted">
          {{ t.type === 'group' ? 'Grup — salin pesan lalu tempel di grupnya' : `Nomor: ${t.detail || 'belum diisi'}` }}
        </p>
        <pre class="my-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs">{{ teksUntuk(t) }}</pre>
        <div class="flex flex-wrap gap-2">
          <UButton
            label="Salin pesan"
            color="neutral"
            variant="soft"
            size="sm"
            loading-auto
            @click="salin(teksUntuk(t))"
          />
          <UButton
            label="Buka WhatsApp"
            color="neutral"
            variant="soft"
            size="sm"
            loading-auto
            @click="kirim(t.type === 'group' ? null : t.detail, teksUntuk(t))"
          />
        </div>
      </div>
      <div class="rounded-lg border border-dashed border-default p-3">
        <p class="font-semibold text-highlighted">
          Personal / grup lain
        </p>
        <p class="text-sm text-muted">
          Pilih field yang mau disertakan:
        </p>
        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          <label
            v-for="(label, kunci) in FIELD_LABELS"
            :key="kunci"
            class="flex items-center gap-1.5"
          >
            <input
              v-model="centang"
              type="checkbox"
              :value="kunci"
            > {{ label }}
          </label>
        </div>
        <UFormField
          label="No. tujuan (opsional, kosongkan untuk salin ke grup)"
          class="mt-2"
        >
          <UInput
            v-model="nomorCustom"
            placeholder="08xxxx"
            inputmode="numeric"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <pre class="my-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs">{{ teksCustom }}</pre>
        <div class="flex flex-wrap gap-2">
          <UButton
            label="Salin"
            color="neutral"
            variant="soft"
            size="sm"
            loading-auto
            @click="salin(teksCustom)"
          />
          <UButton
            label="Buka WhatsApp"
            color="neutral"
            variant="soft"
            size="sm"
            loading-auto
            @click="kirim(nomorCustom || null, teksCustom)"
          />
        </div>
      </div>
    </div>
    <template #footer>
      <UButton
        label="Tutup"
        color="neutral"
        variant="soft"
        size="xl"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
