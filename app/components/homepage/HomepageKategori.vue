<!--
  Category manager, shared by Menu and Berita: rename in place, show/hide on
  the website, move up/down, add, and delete an empty one. Every change is
  written at once (no Simpan): categories are few and each edit is small.
  The parent owns the data; `muatUlang` reloads it after each write.
-->
<script setup lang="ts">
import type { KategoriBaris, KategoriBody } from '~/composables/useHomepage'

const props = defineProps<{
  title: string
  description?: string
  rows: KategoriBaris[]
  /** "menu" / "berita": the word in "Dipakai 4 menu". */
  satuan: string
  api: {
    create: (nama: string) => Promise<unknown>
    update: (id: string, body: KategoriBody, headers: Record<string, string>) => Promise<unknown>
    remove: (id: string, headers: Record<string, string>) => Promise<unknown>
    urutan: (list: { id: string, urutan: number }[]) => Promise<unknown>
  }
  muatUlang: () => Promise<unknown>
}>()

const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

const urut = computed(() => [...props.rows].sort((a, b) => a.urutan - b.urutan || a.nama.localeCompare(b.nama)))
const nama = reactive<Record<string, string>>({})
watch(() => props.rows, (rows) => {
  for (const r of rows) nama[r.id] = r.nama
}, { immediate: true })

const sibuk = ref<string | null>(null)
const baru = ref('')

async function jalankan(id: string, fn: () => Promise<unknown>) {
  sibuk.value = id
  try {
    await fn()
    await props.muatUlang()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, props.muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = null
  }
}

function ganti(r: KategoriBaris) {
  const n = (nama[r.id] ?? '').trim()
  if (!n || n === r.nama) {
    nama[r.id] = r.nama
    return
  }
  return jalankan(r.id, () => props.api.update(r.id, { nama: n }, ifMatch(r.version)))
}

const aktifkan = (r: KategoriBaris, aktif: boolean) =>
  jalankan(r.id, () => props.api.update(r.id, { aktif }, ifMatch(r.version)))

function geser(i: number, arah: -1 | 1) {
  const list = [...urut.value]
  const j = i + arah
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j]!, list[i]!]
  return jalankan(list[i]!.id, () => props.api.urutan(list.map((r, n) => ({ id: r.id, urutan: (n + 1) * 10 }))))
}

const hapus = (r: KategoriBaris) =>
  jalankan(r.id, () => props.api.remove(r.id, ifMatch(r.version)))

async function tambah() {
  const n = baru.value.trim()
  if (!n) return
  await jalankan('baru', () => props.api.create(n))
  baru.value = ''
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="title"
    :description="description"
  >
    <ul class="-mx-1 divide-y divide-default">
      <li
        v-for="(r, i) in urut"
        :key="r.id"
        class="flex items-center gap-2 px-1 py-2.5"
      >
        <div class="flex flex-col">
          <UButton
            icon="i-lucide-chevron-up"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="i === 0 || !!sibuk"
            :aria-label="`Naikkan ${r.nama}`"
            @click="geser(i, -1)"
          />
          <UButton
            icon="i-lucide-chevron-down"
            color="neutral"
            variant="ghost"
            size="xs"
            :disabled="i === urut.length - 1 || !!sibuk"
            :aria-label="`Turunkan ${r.nama}`"
            @click="geser(i, 1)"
          />
        </div>
        <div class="min-w-0 flex-1">
          <UInput
            v-model="nama[r.id]"
            class="w-full"
            :ui="{ base: r.aktif ? '' : 'text-muted' }"
            :aria-label="`Nama kategori ${r.nama}`"
            @blur="ganti(r)"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          />
          <p class="mt-1 text-xs text-muted">
            {{ r.jumlah ? `Dipakai ${r.jumlah} ${satuan}` : `Belum ada ${satuan}` }}
            <span v-if="!r.aktif"> · disembunyikan dari website</span>
          </p>
        </div>
        <USwitch
          :model-value="r.aktif"
          :disabled="!!sibuk"
          :aria-label="`Tampilkan ${r.nama} di website`"
          @update:model-value="aktifkan(r, $event)"
        />
        <UTooltip
          :text="r.jumlah ? `Pindahkan dulu ${r.jumlah} ${satuan} ke kategori lain` : 'Hapus kategori'"
        >
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="r.jumlah > 0 || !!sibuk"
            :loading="sibuk === r.id"
            :aria-label="`Hapus ${r.nama}`"
            @click="hapus(r)"
          />
        </UTooltip>
      </li>
      <li
        v-if="!urut.length"
        class="py-6 text-center text-sm text-muted"
      >
        Belum ada kategori.
      </li>
    </ul>

    <form
      class="mt-3 flex gap-2 border-t border-default pt-4"
      @submit.prevent="tambah"
    >
      <UInput
        v-model="baru"
        placeholder="Nama kategori baru"
        class="flex-1"
      />
      <UButton
        type="submit"
        label="Tambah"
        icon="i-lucide-plus"
        :loading="sibuk === 'baru'"
        :disabled="!baru.trim()"
      />
    </form>
    <p class="mt-2 text-xs text-muted">
      Tombol di kanan menyembunyikan kategori beserta isinya dari website tanpa menghapusnya.
    </p>
  </ResponsiveSheet>
</template>
