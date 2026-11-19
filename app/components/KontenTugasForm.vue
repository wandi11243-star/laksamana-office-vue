<!--
  Tambah / Edit a standalone production task (old openTaskForm + saveTask +
  delTask, deploy/konten/index.html:3283-3305; konten.md D.5). Fields:
  Judul Pekerjaan (required: "Judul wajib diisi"), Brand, Prioritas (default
  Sedang), PIC ("Belum ditentukan"), Deadline (default today + 3), Catatan,
  Konten terkait (optional server-search picker; empty = standalone, clearing
  it unlinks; saved as ProdTask.contentId, JSON blob, no backend change).

  Correction vs the old client: the default deadline came from toISOString(),
  i.e. UTC — between 00:00 and 07:00 WIB it was one day short. Here: local date.
-->
<script setup lang="ts">
import type { KontenItem, ProdKind, ProdTask } from '~/utils/konten'
import { PIC_KOSONG, PRIORITY_KONTEN, PROD_TYPES, ROLES_KONTEN, judulKonten } from '~/utils/konten'
import { hariIni, tambahHari } from '~/utils/format'

const props = defineProps<{ kind: ProdKind, task?: ProdTask | null }>()
const open = defineModel<boolean>('open', { default: false })

const { data: st } = useStateKonten()
const { can } = useAksesKonten()
const brand = useBrandKonten()
const toast = useToast()

const p = computed(() => PROD_TYPES[props.kind])
const contoh = { shoot: 'mis. Rekam b-roll toko', design: 'mis. Desain banner promo', edit: 'mis. Edit video testimoni' }
const f = reactive({ title: '', brand: '', priority: 'medium', pic: PIC_KOSONG, date: '', note: '', contentId: '' })
const sibuk = ref(false)
const hapusBuka = ref(false)

// "Konten terkait" picker: server search via listKonten(), never the whole
// list client-side (spec approach A). USelectMenu cannot hold '' — the stored
// '' (= standalone) maps to a sentinel and back, so clearing the picker
// unlinks the task.
const MANDIRI = '__mandiri'
const cariKonten = ref('')
const hasilKonten = ref<{ value: string, label: string }[]>([])
const mencariKonten = ref(false)
let tCari: ReturnType<typeof setTimeout> | null = null
// Monotonic search token: ignore stale resolutions when an older request
// finishes after a newer one.
let seqCari = 0
onUnmounted(() => {
  // Stop the pending debounced search so it cannot write state after close.
  if (tCari) clearTimeout(tCari)
  tCari = null
  seqCari++
})
// The current link stays on top even outside the results, so edit always
// shows its title (or the deleted-link fallback) once the state has loaded.
const opsiKonten = computed(() => {
  const semua = hasilKonten.value.some(x => x.value === f.contentId)
    ? hasilKonten.value
    : [...(f.contentId ? [{ value: f.contentId, label: judulKonten(st.value.content, f.contentId) }] : []), ...hasilKonten.value]
  return [{ value: MANDIRI, label: '- Mandiri (tanpa konten) -' }, ...semua]
})
const pilihKonten = computed({
  get: () => f.contentId || MANDIRI,
  set: (v: string) => {
    f.contentId = v === MANDIRI ? '' : v
  },
})
// Cheap same-kind check only: hint when the linked content has no need of
// this kind. Non-blocking — the link is still saved.
const peringatanKind = computed(() => {
  if (!f.contentId) return ''
  const c: KontenItem | undefined = st.value.content.find(x => x.id === f.contentId)
  if (!c || c.prod?.[props.kind]) return ''
  return `Konten ini belum punya kebutuhan ${p.value.label.toLowerCase()} — tautan tetap disimpan.`
})
function jadwalMuatKonten(q: string) {
  if (tCari) clearTimeout(tCari)
  tCari = setTimeout(() => muatKonten(q), 300)
}
async function muatKonten(q: string) {
  const seq = ++seqCari
  mencariKonten.value = true
  try {
    const r = await listKonten({ q: q || undefined, perPage: 10 })
    if (seq !== seqCari) return
    hasilKonten.value = (r.data ?? []).map(c => ({ value: c.id, label: c.title || '(tanpa judul)' }))
  }
  catch {
    // Search failed: keep the old options so the picker stays usable,
    // but never stay silent — surface the failure to the user.
    if (seq !== seqCari) return
    toast.add({ title: 'Pencarian konten gagal', color: 'error' })
  }
  if (seq !== seqCari) return
  mencariKonten.value = false
}
watch(cariKonten, jadwalMuatKonten)

const opsiBrand = computed(() => st.value.brands.map(b => ({ value: b.id, label: b.name })))
const opsiPrio = Object.entries(PRIORITY_KONTEN).map(([value, x]) => ({ value, label: x.label }))
const opsiPic = computed(() => [
  { value: PIC_KOSONG, label: '- Belum ditentukan -' },
  ...st.value.users.map(u => ({ value: u.id, label: `${u.name} (${(u.roles ?? []).map(r => (ROLES_KONTEN as Record<string, { short: string }>)[r]?.short ?? r).join(' + ')})` })),
])

watch(open, (o) => {
  if (!o) return
  const x = props.task
  Object.assign(f, {
    title: x?.title ?? '',
    brand: x?.brand ?? (brand.value !== 'all' ? brand.value : (st.value.brands[0]?.id ?? '')),
    priority: x?.priority || 'medium',
    pic: x?.pic || PIC_KOSONG,
    date: x ? (x.date ?? '') : tambahHari(hariIni(), 3),
    note: x?.note ?? '',
    contentId: x?.contentId ?? '',
  })
  // The pinned option (opsiKonten) already shows the linked title from the
  // loaded state; fill the menu with the latest server rows in the background.
  hasilKonten.value = []
  cariKonten.value = ''
  jadwalMuatKonten('')
}, { immediate: true })

async function simpan() {
  const title = f.title.trim()
  if (!title) return toast.add({ title: 'Judul wajib diisi', color: 'error' })
  const data = { kind: props.kind, title, brand: f.brand, priority: f.priority, pic: f.pic === PIC_KOSONG ? '' : f.pic, date: f.date, note: f.note, contentId: f.contentId || undefined }
  const x = props.task
  sibuk.value = true
  const ok = x
    ? await kontenSimpan(() => ubahKonten<ProdTask>('prod-tasks', x.id, { ...x, ...data }, x.updatedAt), 'Tugas diperbarui')
    : await kontenSimpan(() => buatKonten<ProdTask>('prod-tasks', { status: 'todo', ...data }), 'Tugas ditambahkan', { action: `menambah tugas ${p.value.short}`, target: title })
  sibuk.value = false
  if (ok) open.value = false
}

async function hapus() {
  const x = props.task
  if (!x) return
  sibuk.value = true
  const ok = await kontenSimpan(() => hapusKonten('prod-tasks', x.id, x.updatedAt), 'Tugas dihapus')
  sibuk.value = false
  if (!ok) return
  hapusBuka.value = false
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`${task ? 'Edit' : 'Tambah'} ${p.label}`"
    lebar="sedang"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Judul Pekerjaan"
        required
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.title"
          :placeholder="contoh[kind]"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Brand">
        <USelect
          v-model="f.brand"
          :items="opsiBrand"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Prioritas">
        <USelect
          v-model="f.priority"
          :items="opsiPrio"
          class="w-full"
        />
      </UFormField>
      <UFormField label="PIC">
        <USelect
          v-model="f.pic"
          :items="opsiPic"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Deadline">
        <AppTanggal
          v-model="f.date"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Catatan / Brief"
        class="sm:col-span-2"
      >
        <UTextarea
          v-model="f.note"
          placeholder="Detail pekerjaan..."
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Konten terkait"
        :help="mencariKonten ? 'Mencari…' : (peringatanKind || 'Opsional — kosongkan bila tugas mandiri.')"
        class="sm:col-span-2"
      >
        <USelectMenu
          v-model="pilihKonten"
          v-model:search-term="cariKonten"
          :items="opsiKonten"
          value-key="value"
          ignore-filter
          icon="i-lucide-link"
          placeholder="Ketik untuk mencari judul konten…"
          :search-input="{ placeholder: 'Cari judul…' }"
          class="w-full"
        />
      </UFormField>
    </div>
    <template #footer>
      <UButton
        v-if="can(p.view)"
        label="Simpan"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="task && can(p.view)"
        label="Hapus"
        color="error"
        variant="outline"
        @click="hapusBuka = true"
      />
    </template>
  </ResponsiveSheet>
  <KontenKonfirmasi
    v-model:open="hapusBuka"
    title="Hapus tugas ini?"
    :description="task?.title"
    :loading="sibuk"
    @konfirmasi="hapus"
  />
</template>
