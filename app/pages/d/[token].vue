<!--
  Guest seat picker — the public page behind the denah link the WhatsApp bot
  sends (owner request, Nov 2026: "pakai tampilan office-vue"). No login: the
  signed token in the URL is the only credential and dies after 30 minutes.

  Same DenahPeta and the same plan as the Reservasi crew (the date's own
  layout, per floor), fed by GET /automation/denah-data with every guest
  detail stripped. The guest taps one or more free tables, confirms, and
  POST /automation/denah-pilih relays the choice into their chat, where the
  bot continues the booking. A booked table is never overridable here.
-->
<script setup lang="ts">
import type { FetchError } from 'ofetch'
import type { ApiErrorBody } from '~/composables/useApi'
import type { DenahTamu } from '~/composables/useDenahTamu'
import { capMax, dayTypeLayoutLt, defaultDayTypeLt, getLayout, lantaiMap } from '~/utils/venue-layouts'
import { tglPanjang } from '~/utils/format'

definePageMeta({ layout: false, public: true })
useHead({ title: 'Pilih Meja • Laksamana Muda' })

const route = useRoute()
const toast = useToast()
const token = computed(() => String(route.params.token ?? ''))

const data = ref<DenahTamu | null>(null)
const galat = ref('')
const kodeGalat = ref<string | undefined>()
const memuat = ref(true)

async function muat() {
  memuat.value = true
  galat.value = ''
  try {
    data.value = await ambilDenahTamu(token.value)
  }
  catch (e) {
    kodeGalat.value = apiErrorCode(e)
    galat.value = apiErrorMessage(e, 'Denah belum bisa dibuka. Coba lagi sebentar ya Kak.')
  }
  finally {
    memuat.value = false
  }
}
onMounted(muat)

// The link's own clock: picking stops the moment it expires.
const sekarang = ref(Date.now())
let jam: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  jam = setInterval(() => {
    sekarang.value = Date.now()
  }, 15000)
})
onBeforeUnmount(() => clearInterval(jam))
const kedaluwarsa = computed(() => !!data.value && sekarang.value > data.value.expiresAt * 1000)
const berlakuSampai = computed(() => {
  if (!data.value) return ''
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
    .format(new Date(data.value.expiresAt * 1000)).replace(':', '.')
})

const master = computed(() => data.value?.master ?? {})
const lantai = ref<1 | 2>(1)
const layout = computed(() => {
  if (!data.value) return null
  const m = master.value
  return getLayout(m, dayTypeLayoutLt(m, data.value.date, lantai.value))
    ?? getLayout(m, defaultDayTypeLt(data.value.date, lantai.value, m))
})
const peta = computed(() => lantaiMap(master.value))
const adaLantai2 = computed(() => [...peta.value.values()].some(l => l === 2))
const baris = computed(() => data.value?.reservations ?? [])

const pilih = ref<string[]>([])
const maks = computed(() => data.value?.maxTables || 8)
const bisaPilih = computed(() => !!data.value?.pick && !kedaluwarsa.value && !terkirim.value)
const jumlahDi = (lt: 1 | 2) => pilih.value.filter(m => (peta.value.get(m) ?? 1) === lt || peta.value.get(m) === 0).length

function toggle(m: string) {
  if (!bisaPilih.value) return
  if (pilih.value.includes(m)) {
    pilih.value = pilih.value.filter(x => x !== m)
    return
  }
  if (pilih.value.length >= maks.value) {
    toast.add({ title: `Maksimal ${maks.value} meja ya Kak`, color: 'warning' })
    return
  }
  pilih.value = [...pilih.value, m]
}

/** A booked table: a guest can never override it. */
function tumpang(p: { meja: string }) {
  toast.add({ title: `Meja ${p.meja} sudah dipesan`, description: 'Silakan pilih meja lain yang masih tersedia ya Kak.', color: 'warning' })
}

const kapasitas = computed(() => {
  const cap = new Map<string, string>()
  for (const t of layout.value?.tables ?? []) cap.set(String(t.id), t.cap)
  for (const k of Object.keys(master.value.layouts ?? {})) {
    for (const t of getLayout(master.value, k)?.tables ?? []) if (!cap.has(String(t.id))) cap.set(String(t.id), t.cap)
  }
  return pilih.value.reduce((a, m) => a + capMax(cap.get(m)), 0)
})

const judulWaktu = computed(() => (data.value
  ? `${tglPanjang(data.value.date)} · jam ${data.value.time.replace(':', '.')} WIB`
  : ''))

const konfirmasi = ref(false)
const mengirim = ref(false)
const terkirim = ref(false)

async function kirim() {
  if (!pilih.value.length || mengirim.value) return
  mengirim.value = true
  try {
    await kirimPilihanMeja(token.value, pilih.value)
    terkirim.value = true
    konfirmasi.value = false
  }
  catch (e) {
    const tables = ((e as FetchError<ApiErrorBody>)?.data?.error?.details as { tables?: string[] } | undefined)?.tables
    if (apiErrorCode(e) === 'taken' && tables?.length) {
      // Someone booked it meanwhile: drop it and redraw it as taken.
      pilih.value = pilih.value.filter(m => !tables.includes(m))
      await muat()
      konfirmasi.value = false
    }
    toast.add({ title: 'Pilihan belum terkirim', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mengirim.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh bg-muted">
    <div class="mx-auto max-w-6xl px-4 pb-36 pt-5 lg:pb-10">
      <header class="flex items-center gap-3">
        <img
          src="/icon-512.png"
          alt=""
          class="size-11 rounded-[22%] shadow-panel"
        >
        <div class="min-w-0">
          <h1 class="text-xl font-extrabold tracking-tight text-highlighted">
            Pilih meja
          </h1>
          <p class="text-sm text-muted">
            Laksamana Muda<template v-if="judulWaktu">
              · {{ judulWaktu }}
            </template>
          </p>
        </div>
      </header>

      <p
        v-if="memuat && !data"
        class="py-16 text-center text-sm text-muted"
      >
        Memuat denah…
      </p>

      <div
        v-else-if="galat && !data"
        class="mt-6 rounded-panel bg-default p-6 text-center shadow-panel"
      >
        <UIcon
          :name="kodeGalat === 'expired' ? 'i-lucide-clock-alert' : 'i-lucide-map-pinned'"
          class="size-10 text-warning"
        />
        <p class="mt-3 font-semibold text-highlighted">
          {{ galat }}
        </p>
        <p class="mt-1 text-sm text-muted">
          Kembali ke chat WhatsApp dan minta link denah baru ke asisten reservasi ya Kak.
        </p>
        <UButton
          v-if="kodeGalat !== 'expired' && kodeGalat !== 'invalid'"
          class="mt-4"
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          label="Coba lagi"
          @click="muat"
        />
      </div>

      <template v-else-if="data">
        <!-- What to do, or why picking is closed. -->
        <UAlert
          v-if="terkirim"
          class="mt-4"
          color="success"
          variant="subtle"
          icon="i-lucide-circle-check"
          title="Pilihan meja terkirim"
          :description="`Meja ${pilih.join(', ')} sudah masuk ke chat WhatsApp. Silakan kembali ke WhatsApp ya Kak, asisten kami melanjutkan reservasinya di sana.`"
        />
        <UAlert
          v-else-if="kedaluwarsa"
          class="mt-4"
          color="warning"
          variant="subtle"
          icon="i-lucide-clock-alert"
          title="Link denah sudah kedaluwarsa"
          description="Kembali ke chat WhatsApp dan minta link denah baru ke asisten reservasi ya Kak."
        />
        <UAlert
          v-else-if="data.pick"
          class="mt-4"
          color="primary"
          variant="subtle"
          icon="i-lucide-hand"
          :description="`Ketuk meja yang tersedia untuk memilih (boleh lebih dari 1), lalu tekan Kirim pilihan. Link berlaku sampai ${berlakuSampai} WIB.`"
        />
        <UAlert
          v-else
          class="mt-4"
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          :description="`Denah ini hanya untuk dilihat. Balas kode meja pilihan Kakak di chat WhatsApp ya. Link berlaku sampai ${berlakuSampai} WIB.`"
        />

        <div class="mt-4 rounded-panel bg-default p-3 shadow-panel sm:p-4">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <AppSeg
              v-if="adaLantai2"
              :model-value="String(lantai)"
              size="sm"
              :options="[
                { value: '1', label: 'Lantai 1', jumlah: jumlahDi(1) || undefined },
                { value: '2', label: 'Lantai 2', jumlah: jumlahDi(2) || undefined },
              ]"
              @update:model-value="(v?: string) => { lantai = v === '2' ? 2 : 1 }"
            />
            <span
              v-if="memuat"
              class="text-sm text-muted"
            >Memperbarui…</span>
          </div>

          <p
            v-if="!layout"
            class="mt-3 rounded-xl bg-warning/10 p-3 text-sm text-warning"
          >
            Denah untuk tanggal ini belum tersedia. Balas kode meja di chat WhatsApp ya Kak.
          </p>
          <DenahPeta
            v-else
            class="mt-3"
            :layout="layout"
            :reservasi="baris"
            :tanggal="data.date"
            :jam="data.time"
            mode="pilih"
            :terpilih="pilih"
            :master="master"
            @pilih="toggle"
            @tumpang="tumpang"
          />
        </div>
      </template>
    </div>

    <!-- The picked tables and the send button, always in reach of the thumb. -->
    <div
      v-if="data && data.pick && !terkirim && !kedaluwarsa"
      class="fixed inset-x-0 bottom-0 z-10 border-t border-default bg-default/95 shadow-panel backdrop-blur"
    >
      <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <div class="min-w-0 flex-1">
          <p class="text-xs text-muted">
            Meja dipilih
          </p>
          <p class="truncate font-bold text-highlighted">
            {{ pilih.length ? pilih.join(', ') : 'Belum ada' }}
          </p>
          <p
            v-if="pilih.length && kapasitas"
            class="text-xs"
            :class="data.pax && kapasitas < data.pax ? 'text-warning' : 'text-muted'"
          >
            Muat ±{{ kapasitas }} orang<template v-if="data.pax">
              untuk {{ data.pax }} orang{{ kapasitas < data.pax ? ' — masih kurang' : '' }}
            </template>
          </p>
        </div>
        <UButton
          size="lg"
          color="primary"
          icon="i-lucide-send"
          label="Kirim pilihan"
          :disabled="!pilih.length"
          @click="konfirmasi = true"
        />
      </div>
    </div>

    <ResponsiveSheet
      v-model:open="konfirmasi"
      title="Kirim pilihan meja?"
      :description="judulWaktu"
    >
      <div class="space-y-3">
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="m in pilih"
            :key="m"
            class="rounded-full bg-gold-soft px-3 py-1 text-sm font-bold text-gold-deep ring-1 ring-gold-deep"
          >{{ m }}</span>
        </div>
        <p
          v-if="kapasitas"
          class="text-sm text-muted"
        >
          {{ pilih.length }} meja · muat ±{{ kapasitas }} orang.
        </p>
        <p class="text-sm text-muted">
          Pilihan ini dikirim ke chat WhatsApp, lalu asisten kami melanjutkan reservasinya. Meja baru aman setelah reservasi Kakak disetujui.
        </p>
      </div>
      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            class="flex-1 justify-center"
            color="neutral"
            variant="outline"
            label="Ubah pilihan"
            :disabled="mengirim"
            @click="konfirmasi = false"
          />
          <UButton
            class="flex-1 justify-center"
            color="primary"
            label="Ya, kirim ke chat"
            :loading="mengirim"
            @click="kirim"
          />
        </div>
      </template>
    </ResponsiveSheet>
  </div>
</template>
