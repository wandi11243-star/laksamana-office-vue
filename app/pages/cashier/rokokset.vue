<!--
  Cashier › Pengaturan Item Rokok (old `viewRokokSet`, deploy/cashier/index.html:3247-3410).
  The list decides which rows Daily Stock and Rekap show, in that order. The
  KEY is permanent (every daily number is stored under it); only the NAME can
  change. Removing an item never deletes its numbers — re-adding the same name
  brings them back.

  Written as ONE part: PUT /kompas/sections/rokok_items; `null` = back to the built-in list.
-->
<script setup lang="ts">
import type { RokokItem } from '~/utils/cashier'
import { rokokHariBergerak, rokokItems, rokokKunci } from '~/utils/cashier'
import { getRokok, getRokokItems, putRokokItems } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'
import CashierKonfirmasi from '~/widgets/cashier/CashierKonfirmasi.vue'

definePageMeta({ access: ['cashier'] })

const toast = useToast()

const { data, error, refresh } = useAsyncData('cashier-rokokset', async () => {
  const [items, rokok] = await Promise.all([getRokokItems(), getRokok()])
  return { items, rokok }
})

const daftar = computed(() => rokokItems(data.value?.items.value).map(it => ({ k: it.k, n: it.n, lain: !!it.lain })))
const disetel = computed(() => Array.isArray(data.value?.items.value) && !!data.value?.items.value.length)
const pesan = ref<{ warna: 'success' | 'error', teks: string } | null>(null)

const menyimpan = ref(false)
async function tulis(baru: RokokItem[] | null, teks: string) {
  if (!data.value) return false
  menyimpan.value = true
  try {
    data.value.items = await putRokokItems(baru, data.value.items.version)
    pesan.value = teks ? { warna: 'success', teks } : null
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: 'Belum tersimpan', description: apiErrorMessage(e), color: 'error' })
    return false
  }
  finally {
    menyimpan.value = false
  }
}

// ---- add ----
const namaBaru = ref('')
const lainBaru = ref(false)
async function tambah() {
  const nama = namaBaru.value.trim()
  if (!nama) {
    pesan.value = { warna: 'error', teks: 'Nama item wajib diisi.' }
    return
  }
  const k = rokokKunci(nama)
  if (!k) {
    pesan.value = { warna: 'error', teks: 'Nama itu tidak menghasilkan kunci yang sah — pakai huruf atau angka.' }
    return
  }
  // Named, so "Djarum  Mild" vs "Djarum Mild" is understood, not taken for a bug.
  const bentrok = daftar.value.find(it => it.k === k)
  if (bentrok) {
    pesan.value = { warna: 'error', teks: `Kunci ${k} sudah dipakai item ${bentrok.n}. Pakai nama yang berbeda.` }
    return
  }
  if (await tulis([...daftar.value, { k, n: nama, lain: lainBaru.value }], `Item ${nama} ditambahkan (kunci ${k}).`)) {
    namaBaru.value = ''
    lainBaru.value = false
  }
}

const geser = (i: number, arah: number) => {
  const j = i + arah
  if (j < 0 || j >= daftar.value.length) return
  const d = [...daftar.value]
  ;[d[i], d[j]] = [d[j]!, d[i]!]
  tulis(d, '')
}
const toggleLain = (it: RokokItem) =>
  tulis(daftar.value.map(x => (x.k === it.k ? { ...x, lain: !x.lain } : x)), `${it.n} dipindah ke kelompok ${it.lain ? 'Rokok' : 'Lainnya'}.`)

// ---- rename (sheet, replaces the old prompt) ----
const ubahTarget = ref<RokokItem | null>(null)
const namaUbah = ref('')
const ubahSalah = ref('')
const ubahBuka = computed({ get: () => !!ubahTarget.value, set: (v) => {
  if (!v) ubahTarget.value = null
} })
function mintaUbah(it: RokokItem) {
  ubahTarget.value = it
  namaUbah.value = it.n
  ubahSalah.value = ''
}
async function simpanNama() {
  const it = ubahTarget.value
  if (!it) return
  const n = namaUbah.value.trim()
  if (!n) {
    ubahSalah.value = 'Nama tidak boleh kosong.'
    return
  }
  if (await tulis(daftar.value.map(x => (x.k === it.k ? { ...x, n } : x)), `Nama diperbarui jadi ${n}.`)) ubahTarget.value = null
}

// ---- remove ----
const buangTarget = ref<RokokItem | null>(null)
const buangBuka = computed({ get: () => !!buangTarget.value, set: (v) => {
  if (!v) buangTarget.value = null
} })
const buangHari = computed(() => (buangTarget.value ? rokokHariBergerak(data.value?.rokok.value ?? {}, buangTarget.value.k) : 0))
function mintaBuang(it: RokokItem) {
  if (daftar.value.length <= 1) {
    pesan.value = { warna: 'error', teks: 'Daftar tidak boleh kosong — sisakan minimal satu item.' }
    return
  }
  buangTarget.value = it
}
async function buang() {
  const it = buangTarget.value
  if (!it) return
  if (await tulis(daftar.value.filter(x => x.k !== it.k), `Item ${it.n} dibuang dari lembar. Angkanya tetap tersimpan.`)) buangTarget.value = null
}

// ---- back to built-in ----
const bawaanBuka = ref(false)
async function pulihkan() {
  if (await tulis(null, 'Daftar dikembalikan ke bawaan sistem.')) bawaanBuka.value = false
}
</script>

<template>
  <AppPage
    title="Pengaturan item rokok"
    description="Item apa saja yang muncul di lembar Daily Stock Rokok, berikut urutannya."
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
    />
    <UAlert
      v-if="pesan"
      :color="pesan.warna"
      variant="subtle"
      :icon="pesan.warna === 'success' ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert'"
      :title="pesan.teks"
    />
    <UAlert
      color="info"
      variant="subtle"
      icon="i-lucide-lightbulb"
      title="Daftar ini menentukan baris di Daily Stock Rokok dan Rekap Stock Rokok."
      description="Membuang item tidak menghapus angkanya — datanya tetap tersimpan dan kembali utuh kalau item itu ditambahkan lagi dengan nama yang sama. Kunci data dibuat sekali dan tidak berubah walau namanya diganti; itu yang mengikat angka harian ke itemnya."
    />

    <AppPanel
      title="Item di lembar stock"
      :description="`${daftar.length} item · ${disetel ? 'daftar disetel sendiri' : 'masih memakai daftar bawaan sistem'}`"
      icon="i-lucide-list"
      flush
    >
      <template
        v-if="disetel"
        #actions
      >
        <UButton
          label="Kembalikan ke bawaan"
          icon="i-lucide-undo-2"
          size="sm"
          color="neutral"
          variant="outline"
          @click="bawaanBuka = true"
        />
      </template>
      <div class="divide-y divide-default">
        <div
          v-for="(it, i) in daftar"
          :key="it.k"
          class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5"
        >
          <div class="flex gap-0.5">
            <UButton
              icon="i-lucide-arrow-up"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="Naikkan"
              :disabled="i === 0 || menyimpan"
              @click="geser(i, -1)"
            />
            <UButton
              icon="i-lucide-arrow-down"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="Turunkan"
              :disabled="i === daftar.length - 1 || menyimpan"
              @click="geser(i, 1)"
            />
          </div>
          <div class="min-w-0 flex-1">
            <b class="text-highlighted">{{ it.n }}</b>
            <span class="num ml-2 text-xs text-muted">{{ it.k }}</span>
          </div>
          <AppStatus
            :color="it.lain ? 'neutral' : 'info'"
            size="sm"
          >
            {{ it.lain ? 'Lainnya' : 'Rokok' }}
          </AppStatus>
          <div class="flex flex-wrap gap-1">
            <UButton
              label="Ubah nama"
              size="xs"
              color="neutral"
              variant="outline"
              @click="mintaUbah(it)"
            />
            <UButton
              :label="it.lain ? 'Jadikan rokok' : 'Jadikan lainnya'"
              size="xs"
              color="neutral"
              variant="outline"
              :disabled="menyimpan"
              @click="toggleLain(it)"
            />
            <UButton
              label="Buang"
              size="xs"
              color="error"
              variant="soft"
              @click="mintaBuang(it)"
            />
          </div>
        </div>
      </div>
    </AppPanel>

    <AppPanel
      title="Tambah item"
      description="Item baru langsung muncul di lembar harian, dimulai dari sisa 0."
      icon="i-lucide-plus"
    >
      <div class="flex flex-wrap items-center gap-3">
        <UInput
          v-model="namaBaru"
          placeholder="Nama item, mis. Djarum Mild"
          class="min-w-52 flex-1"
          @keydown.enter="tambah"
        />
        <UCheckbox
          v-model="lainBaru"
          label="Bukan rokok (Korek, Coin, Eskrim…)"
        />
        <UButton
          label="Tambah"
          icon="i-lucide-plus"
          :loading="menyimpan"
          :disabled="!data"
          @click="tambah"
        />
      </div>
      <p class="mt-2 text-xs text-muted">
        Item bertanda bukan rokok dikelompokkan di bawah, dipisahkan satu garis — tetap dihitung di meja yang sama.
      </p>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="ubahBuka"
      title="Ubah nama item"
      :description="`Kunci ${ubahTarget?.k || ''} tidak berubah, jadi angkanya tetap.`"
    >
      <UFormField
        label="Nama item"
        :error="ubahSalah || false"
      >
        <UInput
          v-model="namaUbah"
          class="w-full"
          @keydown.enter="simpanNama"
        />
      </UFormField>
      <template #footer>
        <UButton
          label="Simpan"
          :loading="menyimpan"
          @click="simpanNama"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="outline"
          @click="ubahTarget = null"
        />
      </template>
    </ResponsiveSheet>

    <CashierKonfirmasi
      v-model:open="buangBuka"
      :title="`Buang ${buangTarget?.n || ''} dari lembar Daily Stock Rokok?`"
      :description="buangHari
        ? `${buangHari} hari punya angka untuk item ini. Angkanya TIDAK dihapus — tetap tersimpan dan kembali utuh kalau item ini ditambahkan lagi dengan nama yang sama.`
        : 'Belum ada satu hari pun yang mencatat pergerakan item ini.'"
      confirm-label="Buang"
      :loading="menyimpan"
      @konfirmasi="buang"
    >
      <p class="text-sm text-muted">
        Yang berubah cuma: item ini tidak lagi muncul di lembar harian dan tidak lagi ikut Sisa Awal.
      </p>
    </CashierKonfirmasi>

    <CashierKonfirmasi
      v-model:open="bawaanBuka"
      title="Kembalikan daftar ke bawaan sistem?"
      description="Item yang kamu tambahkan sendiri akan hilang dari lembar — angkanya tetap tersimpan, tapi harus ditambahkan lagi kalau mau muncul lagi."
      confirm-label="Kembalikan"
      color="primary"
      :loading="menyimpan"
      @konfirmasi="pulihkan"
    />
  </AppPage>
</template>
