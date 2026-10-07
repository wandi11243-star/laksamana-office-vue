<!--
  Cashier › Daily Stock Rokok (old `viewRokok`, deploy/cashier/index.html:3156-3245).
  In & out per item per day; Sisa Awal = every earlier date summed, not just
  yesterday. EVERY item is always shown — "0" is a recorded answer.

  Written as ONE part: PUT /kompas/sections/rokok with its version (T-03).
  Keys no longer in the list are kept on save (rokokItemsSimpan).
-->
<script setup lang="ts">
import type { RokokData } from '~/utils/cashier'
import { jejakList, num, rokokItems, rokokItemsSimpan, rokokNilai, rokokSisaAwal, tambahJejak } from '~/utils/cashier'
import { getRokok, getRokokItems, putRokok } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'
import { hariIni, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['cashier'] })

const me = useMe()
const toast = useToast()
const tanggal = ref(hariIni())

const { data, error, status, refresh } = useAsyncData('cashier-rokok', async () => {
  const [rokok, items] = await Promise.all([getRokok(), getRokokItems()])
  return { rokok, items }
})

const semua = computed<RokokData>(() => data.value?.rokok.value ?? {})
const items = computed(() => rokokItems(data.value?.items.value))
const rec = computed(() => semua.value[tanggal.value] ?? null)
const awal = computed(() => rokokSisaAwal(semua.value, items.value, tanggal.value))
// Separator drawn ONCE, above the first non-cigarette item (:3137-3140).
const lainPertama = computed(() => items.value.find(it => it.lain)?.k ?? '')

// The form lives outside the stored data: a reload or date switch refills it.
const isi = ref<Record<string, { in: number, out: number }>>({})
function isiUlang() {
  const o: Record<string, { in: number, out: number }> = {}
  for (const it of items.value) o[it.k] = rokokNilai(rec.value, it.k)
  isi.value = o
}
watch([rec, items], isiUlang, { immediate: true })

const akhir = (k: string) => (awal.value[k] ?? 0) + num(isi.value[k]?.in) - num(isi.value[k]?.out)
const total = computed(() => {
  let aw = 0, i = 0, o = 0, ak = 0, gerak = 0
  for (const it of items.value) {
    const vi = num(isi.value[it.k]?.in)
    const vo = num(isi.value[it.k]?.out)
    aw += awal.value[it.k] ?? 0
    i += vi
    o += vo
    ak += akhir(it.k)
    if (vi || vo) gerak++
  }
  return { aw, i, o, ak, gerak }
})
// Minus almost always means an earlier day's incoming stock was never entered.
// Marked, but NOT blocking: today's own entry is right, another day is missing.
const minus = computed(() => items.value.filter(it => akhir(it.k) < 0))

const jejak = computed(() => jejakList(rec.value))
const jejakAkhir = computed(() => jejak.value[jejak.value.length - 1])
const fmtWaktu = (ts: number) => (ts ? new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

function setAngka(k: string, f: 'in' | 'out', v: string | number) {
  const n = Math.max(0, Math.round(Number(String(v).replace(/[^0-9]/g, '')) || 0))
  isi.value[k] = { ...(isi.value[k] ?? { in: 0, out: 0 }), [f]: n }
}

const menyimpan = ref(false)
async function simpan() {
  if (!data.value) return
  const baru: RokokData = {
    ...semua.value,
    [tanggal.value]: {
      items: rokokItemsSimpan(rec.value, items.value, isi.value),
      by: me.value?.name ?? '',
      at: Date.now(),
      log: tambahJejak(rec.value, me.value?.name ?? ''),
    },
  }
  menyimpan.value = true
  try {
    data.value.rokok = await putRokok(baru, data.value.rokok.version)
    toast.add({ title: `Stock ${tglPanjang(tanggal.value)} tersimpan di server`, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: 'Belum tersimpan', description: `${apiErrorMessage(e)} Isian masih di layar — coba simpan lagi.`, color: 'error' })
  }
  finally {
    menyimpan.value = false
  }
}
</script>

<template>
  <AppPage
    title="Daily stock rokok"
    description="Isi jumlah yang masuk dan keluar hari itu. Item yang tidak bergerak biarkan 0 — itu tetap tercatat sebagai jawaban."
  >
    <template #actions>
      <UInput
        v-model="tanggal"
        type="date"
        aria-label="Tanggal"
      />
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />

    <UAlert
      v-if="jejakAkhir"
      color="info"
      variant="subtle"
      icon="i-lucide-file-pen-line"
    >
      <template #title>
        Disubmit oleh <b>{{ jejakAkhir.by || '—' }}</b> · <b>{{ fmtWaktu(jejakAkhir.at) }}</b>
      </template>
      <template
        v-if="jejak.length > 1"
        #description
      >
        Sebelumnya diisi/diubah oleh {{ jejak.slice(0, -1).reverse().map(x => `${x.by || '—'} (${fmtWaktu(x.at)})`).join(' · ') }}
      </template>
    </UAlert>

    <AppPanel
      :title="`Stock ${tglPanjang(tanggal)}`"
      icon="i-lucide-package"
      :count="items.length"
      flush
      :class="status === 'pending' ? 'opacity-60' : ''"
    >
      <!-- Desktop: the old table, TOTAL row in the foot. -->
      <table class="hidden w-full text-sm lg:table">
        <thead class="border-b border-default text-xs text-muted">
          <tr>
            <th class="px-4 py-2 text-left font-semibold">
              Item
            </th>
            <th class="px-4 py-2 text-right font-semibold">
              Sisa awal
            </th>
            <th class="px-4 py-2 text-right font-semibold">
              Masuk
            </th>
            <th class="px-4 py-2 text-right font-semibold">
              Keluar
            </th>
            <th class="px-4 py-2 text-right font-semibold">
              Sisa akhir
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="it in items"
            :key="it.k"
            class="border-b border-default"
            :class="it.k === lainPertama ? 'border-t-2' : ''"
          >
            <td class="px-4 py-2">
              <b class="text-highlighted">{{ it.n }}</b>
              <span
                v-if="it.lain"
                class="block text-xs text-muted"
              >bukan rokok — ikut dihitung di sini</span>
            </td>
            <td class="num px-4 py-2 text-right">
              {{ awal[it.k] ?? 0 }}
            </td>
            <td class="px-4 py-2">
              <UInput
                :model-value="isi[it.k]?.in"
                inputmode="numeric"
                class="ml-auto block w-24"
                :ui="{ base: 'text-right num' }"
                :aria-label="`Masuk ${it.n}`"
                @update:model-value="v => setAngka(it.k, 'in', v)"
              />
            </td>
            <td class="px-4 py-2">
              <UInput
                :model-value="isi[it.k]?.out"
                inputmode="numeric"
                class="ml-auto block w-24"
                :ui="{ base: 'text-right num' }"
                :aria-label="`Keluar ${it.n}`"
                @update:model-value="v => setAngka(it.k, 'out', v)"
              />
            </td>
            <td
              class="num px-4 py-2 text-right"
              :class="akhir(it.k) < 0 ? 'font-bold text-error' : akhir(it.k) === 0 ? 'text-muted' : ''"
            >
              {{ akhir(it.k) }}
            </td>
          </tr>
        </tbody>
        <tfoot class="font-bold">
          <tr class="border-t-2 border-default">
            <td class="px-4 py-2">
              TOTAL
            </td>
            <td class="num px-4 py-2 text-right">
              {{ total.aw }}
            </td>
            <td class="num px-4 py-2 text-right">
              {{ total.i }}
            </td>
            <td class="num px-4 py-2 text-right">
              {{ total.o }}
            </td>
            <td class="num px-4 py-2 text-right">
              {{ total.ak }}
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- Phone: one card per item. -->
      <div class="divide-y divide-default lg:hidden">
        <div
          v-for="it in items"
          :key="it.k"
          class="p-4"
          :class="it.k === lainPertama ? 'border-t-2 border-default' : ''"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <b class="text-highlighted">{{ it.n }}</b>
              <span
                v-if="it.lain"
                class="block text-xs text-muted"
              >bukan rokok</span>
            </div>
            <span class="text-xs text-muted">awal <b class="num text-default">{{ awal[it.k] ?? 0 }}</b> → akhir <b
              class="num"
              :class="akhir(it.k) < 0 ? 'text-error' : 'text-default'"
            >{{ akhir(it.k) }}</b></span>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <UFormField label="Masuk">
              <UInput
                :model-value="isi[it.k]?.in"
                inputmode="numeric"
                class="w-full"
                :ui="{ base: 'text-right num' }"
                @update:model-value="v => setAngka(it.k, 'in', v)"
              />
            </UFormField>
            <UFormField label="Keluar">
              <UInput
                :model-value="isi[it.k]?.out"
                inputmode="numeric"
                class="w-full"
                :ui="{ base: 'text-right num' }"
                @update:model-value="v => setAngka(it.k, 'out', v)"
              />
            </UFormField>
          </div>
        </div>
      </div>
    </AppPanel>

    <UAlert
      v-if="minus.length"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`${minus.length} item sisa akhirnya minus (${minus.map(x => x.n).join(', ')}).`"
      description="Biasanya ada hari sebelumnya yang barang masuknya belum dicatat — periksa tanggal-tanggal sebelumnya. Simpan tetap boleh."
    />

    <AppPanel>
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span class="text-sm text-muted">Item bergerak <b class="num block text-lg text-highlighted">{{ total.gerak }} / {{ items.length }}</b></span>
        <span class="text-sm text-muted">Total masuk <b class="num block text-lg text-highlighted">{{ total.i }}</b></span>
        <span class="text-sm text-muted">Total keluar <b class="num block text-lg text-highlighted">{{ total.o }}</b></span>
        <UButton
          class="ml-auto"
          label="Simpan stock harian"
          icon="i-lucide-save"
          :loading="menyimpan"
          :disabled="!data"
          @click="simpan"
        />
      </div>
    </AppPanel>
  </AppPage>
</template>
