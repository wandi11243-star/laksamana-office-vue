<!--
  Cashier › Daily Stock Rokok (deploy/cashier/index.html viewRokok :3155-3246).

  Every item is ALWAYS shown; 0 means "checked, no movement", not empty (F.10).
  Sisa Awal sums EVERY earlier date, never just yesterday — recording is often
  skipped, and "yesterday only" would read 0 after a blank day as if stock ran
  out. Item keys no longer in the list are preserved on save (:3233-3236), so a
  removed item never loses its history. A negative ending warns but does NOT
  block the save: today's record can be right while another day is missing.
-->
<script setup lang="ts">
import type { RokokHari } from '~/utils/cashier'
import {
  daftarRokok, jejakList, num, rokokItem, rokokSimpanItems, rokokSisaAwal, tambahJejak,
} from '~/utils/cashier'
import { getRokok, getRokokItems, putRokok } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'
import { hariIni, tglPanjang } from '~/utils/format'
import { pesanGagalEsb, tarikCashierEsb } from '~/composables/useCashierEsb'
import { petakanRokokEsb } from '~/utils/cashier-esb'
import CashierKonfirmasi from '~/widgets/cashier/CashierKonfirmasi.vue'

definePageMeta({ access: ['cashier'] })

const me = useMe()
const toast = useToast()
const tanggal = ref(hariIni())

const { data, status, error, refresh } = useAsyncData(
  'cashier-rokok',
  async () => {
    const [rokok, items] = await Promise.all([getRokok(), getRokokItems()])
    return { rokok, items }
  },
  { watch: [tanggal] },
)

const items = computed(() => daftarRokok(data.value?.items.value))
const hari = computed<RokokHari | null>(() => data.value?.rokok.value?.[tanggal.value] ?? null)
const awal = computed(() => rokokSisaAwal(data.value?.rokok.value, items.value, tanggal.value))

type Isian = Record<string, { in: number, out: number }>
const form = reactive<Isian>({})
const kotor = ref(false)
const ditolak = ref(false)
let perubahanSaatTarik = 0

function isiDariServer() {
  perubahanSaatTarik++
  for (const it of items.value) form[it.k] = rokokItem(hari.value, it.k)
  kotor.value = false
}
watch([hari, items], () => {
  if (kotor.value && ditolak.value) return
  isiDariServer()
}, { immediate: true })
watch(tanggal, () => {
  perubahanSaatTarik++
  kotor.value = false
  ditolak.value = false
  esbConfirmOpen.value = false
  esbMessage.value = ''
  esbError.value = ''
  esbWarnings.value = []
})

function ubah(k: string, f: 'in' | 'out', v: string | number) {
  perubahanSaatTarik++
  if (!form[k]) form[k] = { in: 0, out: 0 }
  form[k][f] = num(v)
  kotor.value = true
}
const akhir = (k: string) => (awal.value[k] ?? 0) + (form[k]?.in ?? 0) - (form[k]?.out ?? 0)

const total = computed(() => {
  let tAw = 0
  let tin = 0
  let tout = 0
  let gerak = 0
  for (const it of items.value) {
    const v = form[it.k] ?? { in: 0, out: 0 }
    tAw += awal.value[it.k] ?? 0
    tin += v.in
    tout += v.out
    if (v.in || v.out) gerak++
  }
  return { tAw, tin, tout, tAk: tAw + tin - tout, gerak }
})
const minus = computed(() => items.value.filter(it => akhir(it.k) < 0))
const esbLoading = ref(false)
const esbMessage = ref('')
const esbError = ref('')
const esbWarnings = ref<string[]>([])
const esbConfirmOpen = ref(false)

async function isiKeluarEsb(force = false) {
  if (esbLoading.value || menyimpan.value || !data.value || status.value === 'pending') return
  const date = tanggal.value
  const filled = items.value.filter(it => (form[it.k]?.out ?? 0) > 0).length
  if (filled && !force) { esbConfirmOpen.value = true; return }
  esbConfirmOpen.value = false
  esbLoading.value = true
  const revision = perubahanSaatTarik
  esbMessage.value = `Menarik bill ${tglPanjang(date)} dari ESB…`
  esbError.value = ''
  esbWarnings.value = []
  try {
    const { summary, ganda } = await tarikCashierEsb(date, message => { if (tanggal.value === date) esbMessage.value = message })
    if (tanggal.value !== date || perubahanSaatTarik !== revision) {
      esbMessage.value = 'Tanggal atau isian berubah saat ESB ditarik. Tidak ada angka yang diterapkan; tarik ulang bila perlu.'
      return
    }
    const mapped = petakanRokokEsb(items.value, summary.menuQty)
    const matched = items.value.filter(it => mapped.kena[it.k])
    for (const it of matched) ubah(it.k, 'out', mapped.out[it.k] || 0)
    esbMessage.value = `Kolom Keluar diisi untuk ${matched.length} item dari ${summary.nBill} bill ESB${ganda ? ` · ${ganda} duplikat disaring` : ''}. Belum tersimpan — periksa lalu tekan Simpan stock harian.`
    if (!matched.length) esbMessage.value += ' Tidak ada item lembar yang cocok.'
    if (mapped.ambigu.length) esbWarnings.value.push(`Menu cocok ke lebih dari satu item dan tidak dihitung: ${mapped.ambigu.map(x => `${x.nama} ×${x.qty} (${x.ke.join(' / ')})`).join(' · ')}.`)
    if (mapped.takKenal.length) esbWarnings.value.push(`Menu rokok ESB tanpa item lembar: ${mapped.takKenal.map(x => `${x.nama} ×${x.qty}`).join(' · ')}.`)
  }
  catch (e) {
    if (tanggal.value !== date) return
    esbMessage.value = ''
    esbError.value = `Gagal menarik data ESB: ${pesanGagalEsb(e)}. Kolom Keluar tidak diubah.`
  }
  finally { esbLoading.value = false }
}

const jejak = computed(() => jejakList(hari.value))
const jejakAkhir = computed(() => jejak.value[jejak.value.length - 1])
const fmtWaktu = (ts: number) => {
  const d = new Date(ts)
  return Number.isNaN(+d) ? '' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const menyimpan = ref(false)
async function simpan() {
  if (!data.value) return
  menyimpan.value = true
  const nilai: Record<string, { in: number, out: number }> = {}
  for (const it of items.value) nilai[it.k] = { ...(form[it.k] ?? { in: 0, out: 0 }) }
  const nama = me.value?.name ?? ''
  const rec: RokokHari = {
    items: rokokSimpanItems(items.value, hari.value, nilai),
    by: nama,
    at: Date.now(),
    log: tambahJejak(hari.value, nama),
  }
  const value = { ...(data.value.rokok.value ?? {}), [tanggal.value]: rec }
  try {
    const out = await putRokok(value, data.value.rokok.version)
    data.value.rokok = out
    // B2: real API 200 but the screen only updates after reload — re-read so
    // the saved day appears immediately (legacy redrew on save).
    await refresh()
    kotor.value = false
    ditolak.value = false
    toast.add({ title: `Stock ${tglPanjang(tanggal.value)} tersimpan di server`, color: 'success' })
  }
  catch (e) {
    ditolak.value = true
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}

function geser(n: number) {
  const d = new Date(`${tanggal.value}T00:00:00`)
  d.setDate(d.getDate() + n)
  tanggal.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const kosongKelas = 'w-24 text-end'
</script>

<template>
  <AppPage
    title="Daily stock rokok"
    description="Barang masuk & keluar per hari, per item."
  >
    <AppPanel
      title="Daily stock rokok"
      description="Isi jumlah yang masuk dan keluar hari itu. Item yang tidak bergerak biarkan 0 — itu tetap tercatat sebagai sudah diperiksa."
    >
      <template #actions>
        <div class="flex items-center gap-1.5">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Hari sebelumnya"
            @click="geser(-1)"
          />
          <UInput
            v-model="tanggal"
            type="date"
            size="sm"
            class="w-40"
          />
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Hari berikutnya"
            @click="geser(1)"
          />
          <UButton
            v-if="tanggal !== hariIni()"
            label="Hari ini"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="tanggal = hariIni()"
          />
          <UButton
            label="Isi Keluar dari ESB"
            icon="i-lucide-cloud-download"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="esbLoading"
            :disabled="!data || menyimpan || status === 'pending'"
            @click="isiKeluarEsb()"
          />
        </div>
      </template>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Stock tanggal ini gagal dimuat: ${apiErrorMessage(error)}`"
      />
      <UAlert
        v-if="ditolak && kotor"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Belum tersimpan."
        description="Data di server berubah sejak halaman ini dibuka. Isian Anda masih di layar — periksa lalu tekan Simpan lagi."
        class="mt-2"
      />
      <UAlert
        v-if="jejakAkhir"
        color="info"
        variant="subtle"
        icon="i-lucide-file-pen-line"
        :title="`Terakhir diisi oleh ${jejakAkhir.by || '—'} · ${fmtWaktu(jejakAkhir.at)}`"
        class="mt-2"
      />
      <UAlert
        v-if="minus.length"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`${minus.length} item sisa akhirnya minus (${minus.map(x => x.n).join(', ')}).`"
        description="Biasanya ada hari sebelumnya yang barang masuknya belum dicatat — periksa tanggal-tanggal sebelum ini. Simpan tetap boleh."
        class="mt-2"
      />
      <UAlert
        v-if="esbMessage"
        class="mt-2"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="esbMessage"
      />
      <UAlert
        v-for="warning in esbWarnings"
        :key="warning"
        class="mt-2"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="warning"
      />
      <UAlert
        v-if="esbError"
        class="mt-2"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="esbError"
      />
    </AppPanel>

    <AppPanel
      flush
      :class="status === 'pending' ? 'opacity-60' : ''"
    >
      <table class="hidden w-full text-sm lg:table">
        <thead class="bg-table-head text-table-head-text">
          <tr>
            <th class="px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wider">
              Item
            </th>
            <th class="px-4 py-2.5 text-end text-xs font-bold uppercase tracking-wider">
              Sisa awal
            </th>
            <th class="px-4 py-2.5 text-end text-xs font-bold uppercase tracking-wider">
              Masuk
            </th>
            <th class="px-4 py-2.5 text-end text-xs font-bold uppercase tracking-wider">
              Keluar
            </th>
            <th class="px-4 py-2.5 text-end text-xs font-bold uppercase tracking-wider">
              Sisa akhir
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="it in items"
            :key="it.k"
            :class="it.lain && 'bg-muted/40'"
          >
            <td class="px-4 py-2">
              <b class="text-highlighted">{{ it.n }}</b>
              <span
                v-if="it.lain"
                class="block text-[11px] text-muted"
              >bukan rokok — ikut dihitung di sini</span>
            </td>
            <td class="px-4 py-2 text-end text-muted num">
              {{ awal[it.k] ?? 0 }}
            </td>
            <td class="px-2 py-1.5">
              <UInput
                :model-value="String(form[it.k]?.in ?? 0)"
                inputmode="numeric"
                :class="kosongKelas"
                :aria-label="`Masuk ${it.n}`"
                @update:model-value="(v: string | number) => ubah(it.k, 'in', v)"
              />
            </td>
            <td class="px-2 py-1.5">
              <UInput
                :model-value="String(form[it.k]?.out ?? 0)"
                inputmode="numeric"
                :class="kosongKelas"
                :aria-label="`Keluar ${it.n}`"
                @update:model-value="(v: string | number) => ubah(it.k, 'out', v)"
              />
            </td>
            <td
              class="px-4 py-2 text-end font-bold num"
              :class="akhir(it.k) < 0 ? 'text-error' : 'text-highlighted'"
            >
              {{ akhir(it.k) }}
            </td>
          </tr>
        </tbody>
        <tfoot class="border-t-2 border-default font-bold">
          <tr>
            <td class="px-4 py-2">
              Total
            </td>
            <td class="px-4 py-2 text-end num">
              {{ total.tAw }}
            </td>
            <td class="px-4 py-2 text-end num">
              {{ total.tin }}
            </td>
            <td class="px-4 py-2 text-end num">
              {{ total.tout }}
            </td>
            <td class="px-4 py-2 text-end num">
              {{ total.tAk }}
            </td>
          </tr>
        </tfoot>
      </table>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="it in items"
          :key="it.k"
          class="space-y-2 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ it.n }}
              </p>
              <p
                v-if="it.lain"
                class="text-[11px] text-muted"
              >
                bukan rokok — ikut dihitung di sini
              </p>
            </div>
            <span
              class="shrink-0 text-sm font-bold num"
              :class="akhir(it.k) < 0 ? 'text-error' : 'text-highlighted'"
            >{{ akhir(it.k) }}</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <UFormField label="Sisa awal">
              <span class="block py-2 text-sm text-muted num">{{ awal[it.k] ?? 0 }}</span>
            </UFormField>
            <UFormField label="Masuk">
              <UInput
                :model-value="String(form[it.k]?.in ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah(it.k, 'in', v)"
              />
            </UFormField>
            <UFormField label="Keluar">
              <UInput
                :model-value="String(form[it.k]?.out ?? 0)"
                inputmode="numeric"
                class="w-full"
                @update:model-value="(v: string | number) => ubah(it.k, 'out', v)"
              />
            </UFormField>
          </div>
        </article>
      </div>

      <div class="flex flex-wrap items-center gap-4 border-t border-default px-4 py-3 lg:px-5">
        <div class="flex flex-wrap gap-4 text-sm">
          <span class="text-muted">Item bergerak <b class="text-highlighted num">{{ total.gerak }} / {{ items.length }}</b></span>
          <span class="text-muted">Total masuk <b class="text-highlighted num">{{ total.tin }}</b></span>
          <span class="text-muted">Total keluar <b class="text-highlighted num">{{ total.tout }}</b></span>
        </div>
        <div class="flex-1" />
        <UButton
          label="Simpan stock harian"
          icon="i-lucide-save"
          :loading="menyimpan"
          :disabled="esbLoading"
          @click="simpan"
        />
      </div>
    </AppPanel>
    <CashierKonfirmasi
      v-model:open="esbConfirmOpen"
      title="Timpa kolom Keluar dari ESB?"
      description="Kolom Keluar yang memiliki pasangan menu akan diganti. Kolom Masuk tetap; perubahan baru tersimpan setelah Simpan stock harian."
      confirm-label="Lanjutkan"
      color="primary"
      :loading="esbLoading"
      @konfirmasi="isiKeluarEsb(true)"
    />
  </AppPage>
</template>
