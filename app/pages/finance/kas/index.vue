<!--
  Finance › Kas Kecil › Buku Kas Kecil (old `viewBuku`, deploy/finance/kas/index.html:5197-5330).

  Balances are NEVER stored: the balance of every pos is computed from the FULL
  history (sorted by date, then id), exactly like the old page — a period filter
  never changes a balance. The administrative ticks (Input / Bon) are PATCHed on
  their own, deletes ask first, and every write carries the row's content-hash
  version (fetched right before the write; the bootstrap read has none).
-->
<script setup lang="ts">
import type { KkItem, KkTrx } from '~/composables/useFinance'
import { deleteKkTrx, getKk, getKkTrxSatu, patchKkTrx } from '~/composables/useFinance'
import { fmtRp } from '~/utils/cashier'
import { hariIni } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const toast = useToast()
const route = useRoute()
const periode = ref(typeof route.query.bulan === 'string' && route.query.bulan ? route.query.bulan : hariIni().slice(0, 7))
const tapisPos = ref('__semua')
const tapisKategori = ref('__semua')
const cari = ref('')
const tapisStatus = ref<'semua' | 'input_belum' | 'input_sudah' | 'bon_belum' | 'bon_sudah' | 'belum_lengkap'>('semua')
const hal = ref(1)
const PER_HAL = 25

const { data, status, error, refresh } = useAsyncData('kas-kk', () => getKk())

const pos = computed<KkItem[]>(() => data.value?.data.pos ?? [])
const kategori = computed<KkItem[]>(() => data.value?.data.kategori ?? [])
const trx = computed<KkTrx[]>(() => data.value?.data.trx ?? [])

const namaPos = (id: string) => pos.value.find(p => String(p.id) === String(id))?.nama ?? `pos ${id}`
const namaKategori = (id?: string | null) => (id ? kategori.value.find(k => String(k.id) === String(id))?.nama ?? `kategori ${id}` : '—')
const totalTrx = (t: KkTrx) => t.baris.reduce((s, b) => s + (Number(b.debet) || 0) - (Number(b.kredit) || 0), 0)

/** Balance of one pos over the WHOLE history (`kkSaldoPos`). */
const saldoPos = (posId: string) => trx.value.reduce((s, t) => s + t.baris.reduce((x, b) => x + (String(b.pos_id) === String(posId) ? (Number(b.debet) || 0) - (Number(b.kredit) || 0) : 0), 0), 0)

const urutBulan = computed(() => trx.value
  .filter(t => t.tgl.slice(0, 7) === periode.value)
  .sort((a, b) => (a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : Number(b.id) - Number(a.id))))

const tampil = computed(() => urutBulan.value.filter((t) => {
  if (tapisPos.value !== '__semua' && !t.baris.some(b => String(b.pos_id) === tapisPos.value)) return false
  if (tapisKategori.value !== '__semua' && String(t.kategori_id ?? '') !== tapisKategori.value) return false
  if (tapisStatus.value === 'input_belum' && t.input) return false
  if (tapisStatus.value === 'input_sudah' && !t.input) return false
  if (tapisStatus.value === 'bon_belum' && t.bon) return false
  if (tapisStatus.value === 'bon_sudah' && !t.bon) return false
  if (tapisStatus.value === 'belum_lengkap' && t.input && t.bon) return false
  const q = cari.value.trim().toLowerCase()
  if (q && ![t.keterangan, namaKategori(t.kategori_id), t.baris.map(b => namaPos(String(b.pos_id))).join(' ')].join(' ').toLowerCase().includes(q)) return false
  return true
}))
const totalHal = computed(() => Math.max(1, Math.ceil(tampil.value.length / PER_HAL)))
const halaman = computed(() => {
  const p = Math.min(Math.max(1, hal.value), totalHal.value)
  const mulai = (p - 1) * PER_HAL
  return { p, mulai, akhir: Math.min(mulai + PER_HAL, tampil.value.length), rows: tampil.value.slice(mulai, mulai + PER_HAL) }
})
watch([tapisPos, tapisKategori, cari, tapisStatus, periode], () => {
  hal.value = 1
})
watch(totalHal, (t) => {
  if (hal.value > t) hal.value = t
})

const tanggalPendek = (d: string) => {
  const x = new Date(`${d}T00:00:00`)
  return Number.isNaN(+x) ? d : x.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

const sibuk = ref(false)
async function tandai(t: KkTrx, k: 'input' | 'bon') {
  if (sibuk.value) return
  sibuk.value = true
  try {
    const { trx: live, version } = await getKkTrxSatu(String(t.id))
    await patchKkTrx(String(t.id), { [k]: !live[k] } as { input?: boolean, bon?: boolean }, version ?? '')
    toast.add({ title: k === 'input' ? 'Tanda Input diperbarui.' : 'Tanda Bon diperbarui.', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

const hapusOpen = ref(false)
const hapusTarget = ref<KkTrx | null>(null)
async function jalanHapus() {
  const t = hapusTarget.value
  if (!t || sibuk.value) return
  sibuk.value = true
  try {
    const { version } = await getKkTrxSatu(String(t.id))
    await deleteKkTrx(String(t.id), version ?? '')
    hapusOpen.value = false
    hapusTarget.value = null
    toast.add({ title: 'Transaksi dihapus (baris posnya ikut).', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
</script>

<template>
  <AppPage
    title="Buku kas kecil"
    description="Semua transaksi berikut saldo berjalan tiap pos."
  >
    <template #actions>
      <UButton
        v-if="izin.ubah('kk_buku')"
        label="+ Input transaksi"
        icon="i-lucide-plus"
        size="sm"
        to="/finance/kas/input"
      />
      <UInput
        v-model="periode"
        type="month"
        size="sm"
        class="w-40"
      />
    </template>

    <UAlert
      v-if="!izin.lihat('kk_buku')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
      description="Hubungi admin modul Finance kalau memang perlu."
      class="mb-4"
    />
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
      class="mb-4"
    />
    <p
      v-if="status === 'pending'"
      class="mb-4 text-sm text-muted"
    >
      Memuat…
    </p>

    <AppPanel
      v-if="izin.lihat('kk_buku')"
      title="Saldo tiap pos"
      description="Dihitung dari SELURUH riwayat, bukan hanya bulan yang sedang dibuka."
    >
      <div class="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="p in pos.filter(x => x.aktif !== false)"
          :key="p.id"
          class="flex items-center justify-between gap-3 border-b border-default py-1.5 text-sm"
        >
          <span class="min-w-0 truncate text-muted">{{ p.nama }}</span>
          <b
            class="num"
            :class="saldoPos(String(p.id)) < 0 ? 'text-error' : 'text-highlighted'"
          >{{ fmtRp(saldoPos(String(p.id))) }}</b>
        </div>
      </div>
    </AppPanel>

    <AppPanel
      v-if="izin.lihat('kk_buku')"
      title="Transaksi"
      :description="`${tampil.length} transaksi ditampilkan untuk ${periode}. Satu baris = satu transaksi dengan pecahan posnya.`"
      flush
    >
      <div class="flex flex-wrap items-center gap-2 border-b border-default px-4 py-3 lg:px-5">
        <USelect
          v-model="tapisPos"
          :items="[{ label: 'Semua pos', value: '__semua' }, ...pos.map(p => ({ label: p.nama, value: String(p.id) }))]"
          size="sm"
          class="w-44"
        />
        <USelect
          v-model="tapisKategori"
          :items="[{ label: 'Semua kategori', value: '__semua' }, ...kategori.map(k => ({ label: k.nama, value: String(k.id) }))]"
          size="sm"
          class="w-44"
        />
        <USelect
          v-model="tapisStatus"
          :items="[
            { label: 'Semua status', value: 'semua' },
            { label: 'Input belum', value: 'input_belum' },
            { label: 'Input sudah', value: 'input_sudah' },
            { label: 'Bon belum', value: 'bon_belum' },
            { label: 'Bon sudah', value: 'bon_sudah' },
            { label: 'Belum lengkap', value: 'belum_lengkap' },
          ]"
          size="sm"
          class="w-44"
        />
        <UInput
          v-model="cari"
          icon="i-lucide-search"
          placeholder="Cari keterangan / pos…"
          size="sm"
          class="w-full sm:w-64"
        />
      </div>

      <table class="hidden w-full text-sm lg:table">
        <thead class="bg-table-head text-table-head-text">
          <tr>
            <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
              Tanggal
            </th>
            <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
              Keterangan
            </th>
            <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
              Kategori
            </th>
            <th class="px-3 py-2 text-start text-xs font-bold uppercase tracking-wider">
              Pos
            </th>
            <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
              Nominal
            </th>
            <th class="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">
              Input
            </th>
            <th class="px-3 py-2 text-center text-xs font-bold uppercase tracking-wider">
              Bon
            </th>
            <th class="px-3 py-2 text-end text-xs font-bold uppercase tracking-wider">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="t in halaman.rows"
            :key="t.id"
          >
            <td class="px-3 py-2 whitespace-nowrap">
              {{ tanggalPendek(t.tgl) }}
            </td>
            <td class="px-3 py-2">
              {{ t.keterangan }}
              <div
                v-if="t.dibuat_oleh"
                class="text-[11px] text-muted"
              >
                oleh {{ t.dibuat_oleh }}
              </div>
            </td>
            <td class="px-3 py-2 text-muted">
              {{ namaKategori(t.kategori_id) }}
            </td>
            <td class="px-3 py-2">
              <div
                v-for="b in t.baris"
                :key="b.pos_id"
                class="text-[13px]"
              >
                <span class="text-muted">{{ namaPos(String(b.pos_id)) }}</span>
                <span class="num"> · {{ Number(b.debet) ? fmtRp(Number(b.debet)) : `−${fmtRp(Number(b.kredit))}` }}</span>
              </div>
            </td>
            <td class="px-3 py-2 text-end font-semibold num">
              {{ fmtRp(totalTrx(t)) }}
            </td>
            <td class="px-3 py-2 text-center">
              <UCheckbox
                v-if="izin.ubah('kk_buku')"
                :model-value="!!t.input"
                :disabled="sibuk"
                @update:model-value="() => tandai(t, 'input')"
              />
              <AppStatus
                v-else
                :color="t.input ? 'success' : 'warning'"
                size="sm"
              >
                {{ t.input ? 'Sudah' : 'Belum' }}
              </AppStatus>
            </td>
            <td class="px-3 py-2 text-center">
              <UCheckbox
                v-if="izin.ubah('kk_buku')"
                :model-value="!!t.bon"
                :disabled="sibuk"
                @update:model-value="() => tandai(t, 'bon')"
              />
              <AppStatus
                v-else
                :color="t.bon ? 'success' : 'warning'"
                size="sm"
              >
                {{ t.bon ? 'Ada' : 'Belum' }}
              </AppStatus>
            </td>
            <td class="px-3 py-2">
              <div
                v-if="izin.ubah('kk_buku')"
                class="flex justify-end gap-1"
              >
                <UButton
                  label="Ubah"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  :to="`/finance/kas/input?ubah=${t.id}`"
                />
                <UButton
                  label="Hapus"
                  color="error"
                  variant="ghost"
                  size="xs"
                  @click="hapusTarget = t; hapusOpen = true"
                />
              </div>
            </td>
          </tr>
          <tr v-if="!tampil.length">
            <td
              colspan="8"
              class="px-3 py-6 text-center text-sm text-muted"
            >
              Tidak ada transaksi yang cocok.
            </td>
          </tr>
        </tbody>
      </table>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="t in halaman.rows"
          :key="t.id"
          class="space-y-1.5 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-highlighted">
                {{ t.keterangan }}
              </p>
              <p class="text-[11px] text-muted">
                {{ tanggalPendek(t.tgl) }} · {{ namaKategori(t.kategori_id) }}
              </p>
            </div>
            <b class="shrink-0 num">{{ fmtRp(totalTrx(t)) }}</b>
          </div>
          <p
            v-for="b in t.baris"
            :key="b.pos_id"
            class="text-[13px] text-muted"
          >
            {{ namaPos(String(b.pos_id)) }}:
            <span class="num">{{ Number(b.debet) ? fmtRp(Number(b.debet)) : `−${fmtRp(Number(b.kredit))}` }}</span>
          </p>
          <div class="flex flex-wrap items-center gap-3 pt-1">
            <template v-if="izin.ubah('kk_buku')">
              <UCheckbox
                :model-value="!!t.input"
                label="Input"
                @update:model-value="() => tandai(t, 'input')"
              />
              <UCheckbox
                :model-value="!!t.bon"
                label="Bon"
                @update:model-value="() => tandai(t, 'bon')"
              />
              <UButton
                label="Ubah"
                color="neutral"
                variant="outline"
                size="xs"
                :to="`/finance/kas/input?ubah=${t.id}`"
              />
              <UButton
                label="Hapus"
                color="error"
                variant="ghost"
                size="xs"
                @click="hapusTarget = t; hapusOpen = true"
              />
            </template>
            <template v-else>
              <AppStatus
                :color="t.input ? 'success' : 'warning'"
                size="sm"
              >
                Input {{ t.input ? 'sudah' : 'belum' }}
              </AppStatus>
              <AppStatus
                :color="t.bon ? 'success' : 'warning'"
                size="sm"
              >
                Bon {{ t.bon ? 'ada' : 'belum' }}
              </AppStatus>
            </template>
          </div>
        </article>
        <p
          v-if="!tampil.length"
          class="px-4 py-6 text-center text-sm text-muted"
        >
          Tidak ada transaksi yang cocok.
        </p>
      </div>

      <div
        v-if="totalHal > 1"
        class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-3 lg:px-5"
      >
        <UButton
          label="‹ Sebelumnya"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="halaman.p <= 1"
          @click="hal = halaman.p - 1"
        />
        <span class="text-xs text-muted">Menampilkan {{ halaman.mulai + 1 }}–{{ halaman.akhir }} dari {{ tampil.length }}</span>
        <UButton
          label="Berikutnya ›"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="halaman.p >= totalHal"
          @click="hal = halaman.p + 1"
        />
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="hapusTarget ? `Hapus transaksi ${hapusTarget.keterangan}?` : 'Hapus transaksi?'"
    >
      <p class="text-sm">
        Barisnya dihapus dari server bersama pecahan posnya. Tindakan ini tidak bisa dikembalikan dari layar ini.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          :loading="sibuk"
          @click="jalanHapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="hapusOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
