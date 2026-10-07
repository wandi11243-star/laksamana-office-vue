<!--
  Finance › Kas Kecil › Pos & Kategori (old `viewPos`, deploy/finance/kas/index.html:5920-5974).

  Two lists: payment sources (`kk_pos`) and spending categories (`kk_kategori`).
  A source that was used by a transaction cannot be deleted (the server answers
  422) — deactivate it instead, which is what the toggle does. Every write
  carries the item's own version from the list read.
-->
<script setup lang="ts">
import type { KkItem, KkList } from '~/composables/useFinance'
import { createKkItem, deleteKkItem, getKkItems, updateKkItem } from '~/composables/useFinance'
import type { Versi } from '~/utils/versi'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['finance'] })

const toast = useToast()

const { data, error, refresh } = useAsyncData('kas-kk-pos', async () => {
  const [sources, categories] = await Promise.all([getKkItems('sources'), getKkItems('categories')])
  return { sources, categories }
})

const daftar = (k: KkList): KkItem[] => {
  const items = (k === 'sources' ? data.value?.sources.items : data.value?.categories.items) ?? []
  return items.slice().sort((a, b) => (Number(a.urut) || 0) - (Number(b.urut) || 0) || String(a.nama).localeCompare(String(b.nama)))
}
const versi = (k: KkList, id: string): Versi => {
  const map: Record<string, Versi> = (k === 'sources' ? data.value?.sources.versions : data.value?.categories.versions) ?? {}
  return map[String(id)] ?? ''
}

interface Draf { nama: string, urut: string }
const draf = ref<Record<string, Draf>>({})
watch(data, () => {
  const next: Record<string, Draf> = {}
  for (const k of ['sources', 'categories'] as const) {
    for (const it of daftar(k)) next[`${k}:${it.id}`] = { nama: String(it.nama ?? ''), urut: String(it.urut ?? '') }
  }
  draf.value = next
}, { immediate: true })

const kotor = (k: KkList, it: KkItem) => {
  const d = draf.value[`${k}:${it.id}`]
  return !!d && (d.nama !== String(it.nama ?? '') || d.urut !== String(it.urut ?? ''))
}

const sibuk = ref(false)
async function jalankan(fn: () => Promise<unknown>, pesan: string) {
  if (sibuk.value) return
  sibuk.value = true
  try {
    await fn()
    toast.add({ title: pesan, color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}
const simpanItem = (k: KkList, it: KkItem) => {
  const d = draf.value[`${k}:${it.id}`]
  if (!d) return
  return jalankan(() => updateKkItem(k, String(it.id), { nama: d.nama.trim(), urut: Number(d.urut) || 0 }, versi(k, String(it.id))), `${d.nama} disimpan.`)
}
const toggleAktif = (k: KkList, it: KkItem) =>
  jalankan(() => updateKkItem(k, String(it.id), { aktif: it.aktif === false }, versi(k, String(it.id))), it.aktif === false ? `${it.nama} diaktifkan.` : `${it.nama} dinonaktifkan.`)

const hapusOpen = ref(false)
const hapus = ref<{ k: KkList, it: KkItem } | null>(null)
function tanyaHapus(k: KkList, it: KkItem) {
  hapus.value = { k, it }
  hapusOpen.value = true
}
async function jalanHapus() {
  const h = hapus.value
  if (!h) return
  sibuk.value = true
  try {
    await deleteKkItem(h.k, String(h.it.id), versi(h.k, String(h.it.id)))
    hapusOpen.value = false
    toast.add({ title: `${h.it.nama} dihapus.`, color: 'success' })
    await refresh()
  }
  catch (e) {
    hapusOpen.value = false
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

const namaBaru = reactive<Record<KkList, string>>({ sources: '', categories: '' })
function tambah(k: KkList) {
  const nama = namaBaru[k].trim()
  if (!nama) return
  jalankan(() => createKkItem(k, { nama }), `${nama} ditambahkan.`).then(() => {
    namaBaru[k] = ''
  })
}

const judul = (k: KkList) => (k === 'sources' ? 'Pos pembayaran' : 'Kategori belanja')
const ket = (k: KkList) => (k === 'sources' ? 'Pos adalah sumber uang: kas, rekening bank, e-wallet.' : 'Kategori adalah jenis belanja: ATK, kebersihan, transport, dsb.')
</script>

<template>
  <AppPage
    title="Pos & kategori"
    description="Daftar pos pembayaran dan kategori belanja."
  >
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
      class="mb-4"
    />

    <AppPanel
      v-for="k in (['sources', 'categories'] as KkList[])"
      :key="k"
      :title="judul(k)"
      :description="ket(k)"
      :count="daftar(k).length"
      class="mb-4"
    >
      <div class="divide-y divide-default">
        <div
          v-for="it in daftar(k)"
          :key="it.id"
          class="flex flex-wrap items-center gap-2 py-2"
          :class="it.aktif === false ? 'opacity-60' : ''"
        >
          <UInput
            v-model="draf[`${k}:${it.id}`]!.nama"
            class="min-w-48 flex-1"
            size="sm"
          />
          <UInput
            v-model="draf[`${k}:${it.id}`]!.urut"
            inputmode="numeric"
            class="w-20"
            size="sm"
            aria-label="Urut"
          />
          <AppStatus
            :color="it.aktif === false ? 'neutral' : 'success'"
            size="sm"
          >
            {{ it.aktif === false ? 'Nonaktif' : 'Aktif' }}
          </AppStatus>
          <div class="flex gap-1">
            <UButton
              v-if="kotor(k, it)"
              label="Simpan"
              size="xs"
              :loading="sibuk"
              @click="simpanItem(k, it)"
            />
            <UButton
              :label="it.aktif === false ? 'Aktifkan' : 'Nonaktifkan'"
              color="neutral"
              variant="outline"
              size="xs"
              @click="toggleAktif(k, it)"
            />
            <UButton
              label="Hapus"
              color="error"
              variant="ghost"
              size="xs"
              @click="tanyaHapus(k, it)"
            />
          </div>
        </div>
        <p
          v-if="!daftar(k).length"
          class="py-4 text-center text-sm text-muted"
        >
          Belum ada {{ judul(k).toLowerCase() }}.
        </p>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <UInput
          v-model="namaBaru[k]"
          :placeholder="`${judul(k)} baru…`"
          size="sm"
          class="w-64"
          @keyup.enter="tambah(k)"
        />
        <UButton
          label="+ Tambah"
          color="neutral"
          variant="outline"
          size="sm"
          :disabled="!namaBaru[k].trim()"
          @click="tambah(k)"
        />
      </div>
    </AppPanel>

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="hapus ? `Hapus ${hapus.it.nama}?` : 'Hapus?'"
    >
      <p class="text-sm">
        Hapus ditolak server bila item sudah dipakai transaksi — yang benar adalah menonaktifkannya supaya riwayat tetap utuh.
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
