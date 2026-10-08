<!--
  Cashier › Pengaturan Item Rokok (deploy/cashier/index.html viewRokokSet :3260-3409).

  The list determines the rows of Daily Stock and its recapitulation. Keys are
  PERMANENT (`rksKunci`): renaming keeps the key, so numbers survive; removing
  an item only takes it off the sheet — its numbers stay stored and come back
  whole if the same name is added again. The order here is the order on the
  rack. While the list has never been set, the built-in default is shown; the
  first edit copies what is visible into the stored list.
-->
<script setup lang="ts">
import type { RokokItem } from '~/utils/cashier'
import { daftarRokok, rokokHariItem, rksKunci } from '~/utils/cashier'
import { getRokok, getRokokItems, hapusRokokItems, putRokokItems } from '~/composables/useCashier'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['cashier'] })

const toast = useToast()
const { data, status, error, refresh } = useAsyncData('cashier-rokokset', async () => {
  const [items, rokok] = await Promise.all([getRokokItems(), getRokok()])
  return { items, rokok }
})

const daftar = computed(() => (data.value ? daftarRokok(data.value.items.value) : []))
const bentrok = (k: string) => daftar.value.find(x => x.k === k) ?? null

async function simpanDaftar(baru: RokokItem[], pesan: string) {
  if (!data.value) return
  try {
    const out = await putRokokItems(baru, data.value.items.version)
    data.value.items = out
    // B2: real API 200 but the screen only updates after reload — re-read so
    // the saved list appears immediately (legacy redrew on save).
    await refresh()
    toast.add({ title: pesan, color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Daftar belum tersimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

function geser(k: string, arah: number) {
  const list = daftar.value.slice()
  const i = list.findIndex(x => x.k === k)
  const j = i + arah
  if (i < 0 || j < 0 || j >= list.length) return
  const tmp = list[i]!
  list[i] = list[j]!
  list[j] = tmp
  simpanDaftar(list, 'Urutan item disimpan.')
}

// ---- Ubah nama (key tidak berubah)
const ubahOpen = ref(false)
const ubahItem = ref<RokokItem | null>(null)
const ubahNama = ref('')
function bukaUbah(it: RokokItem) {
  ubahItem.value = it
  ubahNama.value = it.n
  ubahOpen.value = true
}
async function simpanUbah() {
  const it = ubahItem.value
  if (!it) return
  const n = ubahNama.value.trim()
  if (!n) return toast.add({ title: 'Nama tidak boleh kosong.', color: 'error' })
  const list = daftar.value.map(x => (x.k === it.k ? { ...x, n } : x))
  ubahOpen.value = false
  await simpanDaftar(list, `Nama diperbarui jadi ${n}.`)
}

// ---- Tambah item
const tambahOpen = ref(false)
const namaBaru = ref('')
const lainBaru = ref(false)
function bukaTambah() {
  namaBaru.value = ''
  lainBaru.value = false
  tambahOpen.value = true
}
async function simpanTambah() {
  const nama = namaBaru.value.trim()
  if (!nama) return toast.add({ title: 'Nama item wajib diisi.', color: 'error' })
  const k = rksKunci(nama)
  if (!k) return toast.add({ title: 'Nama itu tidak menghasilkan kunci yang sah — pakai huruf atau angka.', color: 'error' })
  const ada = bentrok(k)
  if (ada) return toast.add({ title: `Kunci ${k} sudah dipakai item ${ada.n}. Pakai nama yang berbeda.`, color: 'error' })
  tambahOpen.value = false
  await simpanDaftar([...daftar.value, { k, n: nama, lain: lainBaru.value }], `Item ${nama} ditambahkan (kunci ${k}).`)
}

// ---- Buang item
const hapusOpen = ref(false)
const hapusItem = ref<RokokItem | null>(null)
const hapusHari = computed(() => (hapusItem.value && data.value ? rokokHariItem(data.value.rokok.value, hapusItem.value.k) : 0))
function bukaHapus(it: RokokItem) {
  if (daftar.value.length <= 1) return toast.add({ title: 'Daftar tidak boleh kosong — sisakan minimal satu item.', color: 'error' })
  hapusItem.value = it
  hapusOpen.value = true
}
async function jalanHapus() {
  const it = hapusItem.value
  if (!it) return
  hapusOpen.value = false
  await simpanDaftar(daftar.value.filter(x => x.k !== it.k), `Item ${it.n} dibuang dari lembar. Angkanya tetap tersimpan.`)
}

// ---- Kembalikan ke bawaan
const pulihOpen = ref(false)
async function pulihkan() {
  if (!data.value) return
  pulihOpen.value = false
  try {
    const out = await hapusRokokItems(data.value.items.version)
    data.value.items = { value: [], version: out.version }
    // B2: re-read so the built-in list appears immediately (see simpanDaftar).
    await refresh()
    toast.add({ title: 'Daftar dikembalikan ke bawaan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: `Gagal mengembalikan: ${apiErrorMessage(e)}`, color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Pengaturan item rokok"
    description="Item apa saja yang muncul di lembar Daily Stock Rokok."
  >
    <AppPanel
      title="Item di lembar stock"
      icon="i-lucide-package"
      :count="daftar.length"
      description="Urutan di sini = urutan baris di lembar harian. Kasir menghitung fisik sesuai susunan rak."
      flush
    >
      <template #actions>
        <UButton
          label="Tambah item"
          icon="i-lucide-plus"
          size="sm"
          @click="bukaTambah"
        />
        <UButton
          label="Kembalikan ke bawaan"
          icon="i-lucide-undo-2"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="pulihOpen = true"
        />
      </template>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Daftar gagal dimuat: ${apiErrorMessage(error)}`"
      />

      <table class="hidden w-full text-sm lg:table">
        <thead class="bg-table-head text-table-head-text">
          <tr>
            <th class="px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wider">
              Urut
            </th>
            <th class="px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wider">
              Nama
            </th>
            <th class="px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wider">
              Kunci data
            </th>
            <th class="px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wider">
              Kelompok
            </th>
            <th class="px-4 py-2.5 text-end text-xs font-bold uppercase tracking-wider">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="(it, i) in daftar"
            :key="it.k"
          >
            <td class="px-4 py-2 text-muted num">
              {{ i + 1 }}
            </td>
            <td class="px-4 py-2 font-semibold text-highlighted">
              {{ it.n }}
            </td>
            <td class="px-4 py-2 text-muted num">
              {{ it.k }}
            </td>
            <td class="px-4 py-2">
              <AppStatus
                :color="it.lain ? 'neutral' : 'gold'"
                size="sm"
              >
                {{ it.lain ? 'Lainnya' : 'Rokok' }}
              </AppStatus>
            </td>
            <td class="px-4 py-2">
              <div class="flex flex-wrap justify-end gap-1">
                <UButton
                  icon="i-lucide-arrow-up"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :disabled="i === 0"
                  :aria-label="`Naikkan ${it.n}`"
                  @click="geser(it.k, -1)"
                />
                <UButton
                  icon="i-lucide-arrow-down"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :disabled="i === daftar.length - 1"
                  :aria-label="`Turunkan ${it.n}`"
                  @click="geser(it.k, 1)"
                />
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Ubah nama ${it.n}`"
                  @click="bukaUbah(it)"
                />
                <UButton
                  :label="it.lain ? 'Jadikan rokok' : 'Jadikan lainnya'"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="simpanDaftar(daftar.map(x => x.k === it.k ? { ...x, lain: !x.lain } : x), `${it.n} dipindah ke kelompok ${it.lain ? 'Rokok' : 'Lainnya'}.`)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Buang ${it.n}`"
                  @click="bukaHapus(it)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="(it, i) in daftar"
          :key="it.k"
          class="space-y-2 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                <span class="me-1.5 text-muted num">{{ i + 1 }}</span>{{ it.n }}
              </p>
              <p class="text-[13px] text-muted num">
                {{ it.k }}
              </p>
            </div>
            <AppStatus
              :color="it.lain ? 'neutral' : 'gold'"
              size="sm"
            >
              {{ it.lain ? 'Lainnya' : 'Rokok' }}
            </AppStatus>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              label="Naik"
              color="neutral"
              variant="outline"
              size="xs"
              :disabled="i === 0"
              @click="geser(it.k, -1)"
            />
            <UButton
              label="Turun"
              color="neutral"
              variant="outline"
              size="xs"
              :disabled="i === daftar.length - 1"
              @click="geser(it.k, 1)"
            />
            <UButton
              label="Ubah nama"
              color="neutral"
              variant="outline"
              size="xs"
              @click="bukaUbah(it)"
            />
            <UButton
              :label="it.lain ? 'Jadikan rokok' : 'Jadikan lainnya'"
              color="neutral"
              variant="outline"
              size="xs"
              @click="simpanDaftar(daftar.map(x => x.k === it.k ? { ...x, lain: !x.lain } : x), `${it.n} dipindah ke kelompok ${it.lain ? 'Rokok' : 'Lainnya'}.`)"
            />
            <UButton
              label="Buang"
              color="error"
              variant="ghost"
              size="xs"
              @click="bukaHapus(it)"
            />
          </div>
        </article>
      </div>

      <div class="border-t border-default px-4 py-3 text-sm text-muted lg:px-5">
        Menghapus item tidak menghapus angkanya: item yang dibuang cuma hilang dari lembar, datanya tetap tersimpan
        dan kembali utuh kalau ditambahkan lagi dengan nama yang sama.
        <span v-if="status === 'pending'"> Memuat…</span>
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="tambahOpen"
      title="Tambah item"
    >
      <div class="space-y-3">
        <UFormField label="Nama item">
          <UInput
            v-model="namaBaru"
            placeholder="cth: LA Menthol"
            class="w-full"
          />
        </UFormField>
        <UCheckbox
          v-model="lainBaru"
          label="Bukan rokok — tampil di kelompok Lainnya"
        />
        <p
          v-if="namaBaru.trim() && rksKunci(namaBaru)"
          class="rounded-field bg-muted px-3 py-2 text-sm text-muted"
        >
          Kunci data: <b class="num">{{ rksKunci(namaBaru) }}</b>
        </p>
      </div>
      <template #footer>
        <UButton
          label="Tambah"
          @click="simpanTambah"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="tambahOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="ubahOpen"
      :title="ubahItem ? `Ubah nama ${ubahItem.n}` : 'Ubah nama'"
    >
      <div class="space-y-3">
        <UFormField
          label="Nama item"
          :help="ubahItem ? `Kunci ${ubahItem.k} tidak berubah, jadi angkanya tetap.` : ''"
        >
          <UInput
            v-model="ubahNama"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Simpan nama"
          @click="simpanUbah"
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
      :title="hapusItem ? `Buang ${hapusItem.n} dari lembar?` : 'Buang item?'"
    >
      <p class="text-sm">
        <template v-if="hapusHari">
          {{ hapusHari }} hari punya angka untuk item ini. Angkanya TIDAK dihapus — tetap tersimpan dan kembali utuh
          kalau item ini ditambahkan lagi dengan nama yang sama.
        </template>
        <template v-else>
          Belum ada satu hari pun yang mencatat pergerakan item ini.
        </template>
      </p>
      <p class="mt-2 text-sm text-muted">
        Yang berubah cuma: item ini tidak lagi muncul di lembar harian dan tidak lagi ikut Sisa Awal.
      </p>
      <template #footer>
        <UButton
          label="Ya, buang"
          color="error"
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

    <ResponsiveSheet
      v-model:open="pulihOpen"
      title="Kembalikan ke daftar bawaan?"
    >
      <p class="text-sm">
        Daftar yang sekarang diganti daftar bawaan. Angka harian tidak tersentuh: item yang tidak ada di daftar
        bawaan tetap tersimpan, hanya tidak muncul di lembar.
      </p>
      <template #footer>
        <UButton
          label="Kembalikan ke bawaan"
          @click="pulihkan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="pulihOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
