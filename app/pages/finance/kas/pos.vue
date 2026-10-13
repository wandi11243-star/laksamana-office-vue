<!--
  Finance › Kas Kecil › Pos & Kategori (old `viewKkPos`, deploy/finance/kas/index.html:5940-5990).

  Layout as the old screen: an info strip, then two panels side by side —
  payment sources (`kk_pos`) and spending categories (`kk_kategori`). Each row:
  name (+ "nonaktif"), how many transactions use it, "Ubah nama", and "Hapus"
  (or "Aktifkan" for an inactive one). A new item gets urut = (active count + 1) × 10.

  Hapus of an item already used by a transaction does NOT delete: it offers to
  deactivate (the old `kkHapusPos` confirm) — deleting would strip old
  transactions of their pos and move balances someone already reconciled.
  Ubah nama sends the current `urut` along, so a rename never drops the item to 0.
  Every write carries the item's own version from the list read.
-->
<script setup lang="ts">
import type { KkItem, KkList } from '~/composables/useFinance'
import { createKkItem, deleteKkItem, getKk, getKkItems, updateKkItem } from '~/composables/useFinance'
import type { Versi } from '~/utils/versi'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const toast = useToast()

const { data, error, refresh } = useAsyncData('kas-kk-pos', async () => {
  const [sources, categories, kk] = await Promise.all([getKkItems('sources'), getKkItems('categories'), getKk()])
  return { sources, categories, trx: kk.data.trx }
})

const daftar = (k: KkList): KkItem[] => {
  const items = (k === 'sources' ? data.value?.sources.items : data.value?.categories.items) ?? []
  return items.slice().sort((a, b) => (Number(a.urut) || 0) - (Number(b.urut) || 0))
}
const versi = (k: KkList, id: string): Versi => {
  const map: Record<string, Versi> = (k === 'sources' ? data.value?.sources.versions : data.value?.categories.versions) ?? {}
  return map[String(id)] ?? ''
}
/** How many transactions use this pos / kategori (`pakaiPos` / `pakaiKat`). */
const pakai = (k: KkList, id: string) => (data.value?.trx ?? []).filter(t => (k === 'sources'
  ? t.baris.some(b => String(b.pos_id) === String(id))
  : String(t.kategori_id ?? '') === String(id))).length

const sibuk = ref(false)
async function jalankan(fn: () => Promise<unknown>, pesan: string) {
  if (!izin.ubah('kk_pos') || sibuk.value) return false
  sibuk.value = true
  try {
    await fn()
    toast.add({ title: pesan, color: 'success' })
    await refresh()
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
  finally {
    sibuk.value = false
  }
}

const jenisNama = (k: KkList) => (k === 'sources' ? 'Pos' : 'Kategori')

// ---- Ubah nama
const ubahOpen = ref(false)
const ubah = ref<{ k: KkList, it: KkItem, nama: string } | null>(null)
function bukaUbah(k: KkList, it: KkItem) {
  ubah.value = { k, it, nama: String(it.nama ?? '') }
  ubahOpen.value = true
}
async function simpanNama() {
  const u = ubah.value
  if (!u) return
  const nama = u.nama.trim()
  if (!nama) {
    toast.add({ title: 'Nama tidak boleh kosong.', color: 'error' })
    return
  }
  if (nama === u.it.nama) {
    ubahOpen.value = false
    return
  }
  const ok = await jalankan(() => updateKkItem(u.k, String(u.it.id), { nama, urut: Number(u.it.urut) || 0 }, versi(u.k, String(u.it.id))), `Nama diubah jadi ${nama}.`)
  if (ok) ubahOpen.value = false
}

// ---- Hapus (or deactivate when used) / Aktifkan
const hapusOpen = ref(false)
const hapus = ref<{ k: KkList, it: KkItem, dipakai: boolean } | null>(null)
function tanyaHapus(k: KkList, it: KkItem) {
  hapus.value = { k, it, dipakai: pakai(k, String(it.id)) > 0 }
  hapusOpen.value = true
}
async function jalanHapus() {
  const h = hapus.value
  if (!h) return
  const ok = h.dipakai
    ? await jalankan(() => updateKkItem(h.k, String(h.it.id), { aktif: false }, versi(h.k, String(h.it.id))), `${h.it.nama} dinonaktifkan.`)
    : await jalankan(() => deleteKkItem(h.k, String(h.it.id), versi(h.k, String(h.it.id))), `${h.it.nama} dihapus.`)
  if (ok) hapusOpen.value = false
}
const aktifkan = (k: KkList, it: KkItem) =>
  jalankan(() => updateKkItem(k, String(it.id), { aktif: true }, versi(k, String(it.id))), `${it.nama} diaktifkan.`)

// ---- Tambah
const namaBaru = reactive<Record<KkList, string>>({ sources: '', categories: '' })
async function tambah(k: KkList) {
  const nama = namaBaru[k].trim()
  if (!nama) {
    toast.add({ title: `Nama ${jenisNama(k).toLowerCase()} belum diisi.`, color: 'error' })
    return
  }
  const urut = (daftar(k).filter(x => x.aktif !== false).length + 1) * 10
  if (await jalankan(() => createKkItem(k, { nama, urut }), `${nama} ditambahkan.`)) namaBaru[k] = ''
}

const PANEL: { k: KkList, judul: string, sub: string, kosong: string, placeholder: string }[] = [
  { k: 'sources', judul: 'Pos Pembayaran', sub: 'Tiap pos punya saldo berjalan sendiri', kosong: 'Belum ada pos.', placeholder: 'Nama pos baru' },
  { k: 'categories', judul: 'Kategori Belanja', sub: 'Untuk menyaring & merekap, tidak memengaruhi saldo', kosong: 'Belum ada kategori.', placeholder: 'Nama kategori baru' },
]
</script>

<template>
  <AppPage
    title="Pos & kategori"
    description="Daftar pos pembayaran dan kategori belanja."
  >
    <UAlert
      v-if="!izin.lihat('kk_pos')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini tidak dibuka untuk peranmu."
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

    <template v-if="izin.lihat('kk_pos')">
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-lightbulb"
        class="mb-4"
      >
        <template #description>
          <b>Pos</b> adalah sumber uangnya (Kas Kecil, PO, …) dan tiap pos punya saldo berjalan sendiri. <b>Kategori</b> adalah jenis
          belanjanya (SP, RND, COGS, …) dan dipakai untuk menyaring, bukan untuk menghitung saldo. Keduanya data, bukan kolom — menambah
          pos di sini langsung memunculkan isiannya di form Input Transaksi.
        </template>
      </UAlert>

      <div class="grid items-start gap-4 lg:grid-cols-2">
        <AppPanel
          v-for="p in PANEL"
          :key="p.k"
          :title="p.judul"
          :description="p.sub"
        >
          <div class="divide-y divide-default">
            <div
              v-for="it in daftar(p.k)"
              :key="it.id"
              class="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5"
              :class="it.aktif === false ? 'opacity-55' : ''"
            >
              <div class="min-w-0 flex-1">
                <b class="text-highlighted">{{ it.nama }}</b>
                <AppStatus
                  v-if="it.aktif === false"
                  color="neutral"
                  size="sm"
                  class="ms-1.5"
                >
                  nonaktif
                </AppStatus>
              </div>
              <span class="text-sm text-muted num">{{ pakai(p.k, String(it.id)) }} transaksi</span>
              <div
                v-if="izin.ubah('kk_pos')"
                class="flex gap-1"
              >
                <UButton
                  label="Ubah nama"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="bukaUbah(p.k, it)"
                />
                <UButton
                  v-if="it.aktif === false"
                  label="Aktifkan"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  :loading="sibuk"
                  @click="aktifkan(p.k, it)"
                />
                <UButton
                  v-else
                  label="Hapus"
                  color="error"
                  variant="soft"
                  size="xs"
                  @click="tanyaHapus(p.k, it)"
                />
              </div>
            </div>
            <p
              v-if="!daftar(p.k).length"
              class="py-4 text-center text-sm text-muted"
            >
              {{ p.kosong }}
            </p>
          </div>
          <div
            v-if="izin.ubah('kk_pos')"
            class="mt-3.5 flex gap-2"
          >
            <UInput
              v-model="namaBaru[p.k]"
              :placeholder="p.placeholder"
              class="flex-1"
              @keyup.enter="tambah(p.k)"
            />
            <UButton
              label="Tambah"
              :loading="sibuk"
              @click="tambah(p.k)"
            />
          </div>
        </AppPanel>
      </div>
    </template>

    <ResponsiveSheet
      v-model:open="ubahOpen"
      :title="ubah ? `Nama baru untuk ${ubah.it.nama}` : 'Ubah nama'"
    >
      <UFormField
        v-if="ubah"
        :label="`Nama ${jenisNama(ubah.k).toLowerCase()}`"
      >
        <UInput
          v-model="ubah.nama"
          class="w-full"
          autofocus
          @keyup.enter="simpanNama"
        />
      </UFormField>
      <p class="mt-2 text-xs text-muted">
        Hanya namanya yang berubah — transaksi lama tetap menunjuk {{ ubah?.k === 'sources' ? 'pos' : 'kategori' }} yang sama, jadi saldo historis tidak bergerak.
      </p>
      <template #footer>
        <UButton
          label="Simpan nama"
          :loading="sibuk"
          @click="simpanNama"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="ubahOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="hapus ? (hapus.dipakai ? `Nonaktifkan ${hapus.it.nama}?` : `Hapus ${hapus.it.nama}?`) : 'Hapus?'"
    >
      <p
        v-if="hapus?.dipakai"
        class="text-sm"
      >
        {{ jenisNama(hapus.k) }} <b>{{ hapus.it.nama }}</b> sudah dipakai transaksi lama, jadi tidak bisa dihapus. Nonaktifkan saja?
        Ia akan hilang dari form input tapi transaksi lamanya tetap utuh.
      </p>
      <p
        v-else
        class="text-sm"
      >
        {{ hapus ? jenisNama(hapus.k) : '' }} ini belum dipakai transaksi mana pun, jadi bisa dihapus.
      </p>
      <template #footer>
        <UButton
          :label="hapus?.dipakai ? 'Ya, nonaktifkan' : 'Ya, hapus'"
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
