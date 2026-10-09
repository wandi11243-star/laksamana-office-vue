<!--
  Marketing › Template Task (docs/migrasi/marketing.md D.8, F.12, issue #62).
  One card per Format F&B (= an event's to-do category); inside it sub
  categories (ordered — that order is also the board's order) and items.
  Old division categories that still hold items wait below, untouched, until
  someone moves them into a format (renderTemplates, :12817-12858).

  Storage: the format list and the sub categories are documents (fbFormats,
  fbSubs — read, changed, written back under their content hash); items are
  task-templates rows. A rename or move also rewrites the events that use the
  category as a KEY, else they lose their list and progress.
  Cards start CLOSED; open/closed is this browser's view only (localStorage).
-->
<script setup lang="ts">
import type { EventMkt } from '~/utils/marketing'
import type { SubKatMkt, TemplateTugasMkt, UbahEventMkt } from '~/utils/marketing-tugas'
import {
  bersihNamaMkt, cekNamaKategoriMkt, cekNamaSubMkt, kategoriLamaMkt, kategoriOrgMkt, rencanaHapusLamaMkt,
  rencanaPindahMkt, rencanaSalinMkt, rencanaUbahNamaMkt, stafMkt, subsDariMkt, templateDivMkt, templateSubMkt, urutSubMkt,
} from '~/utils/marketing-tugas'
import { tglMkt } from '~/utils/marketing'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const { data: st, status } = useStateMkt()
const { can } = useAksesMkt()
const bisaUbah = computed(() => can('edit_template'))

const formats = computed(() => formatFbMkt(st.value))
const tpl = computed(() => st.value.taskTemplates as unknown as TemplateTugasMkt[])
const subs = computed(() => st.value.fbSubs as SubKatMkt[])
const org = computed(() => kategoriOrgMkt(st.value.categories, st.value.taskCategories))
const lama = computed(() => kategoriLamaMkt(org.value, tpl.value, subs.value))
const staf = computed(() => stafMkt(st.value.users).map(u => u.name))
const idBaru = (awalan: string) => `${awalan}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// ---- open / closed (per browser; default closed, stored explicitly 0/1)
const KUNCI_TUTUP = 'lm_mkt_tmpl_tutup'
const tutup = ref<Record<string, 0 | 1>>({})
onMounted(() => {
  try {
    tutup.value = JSON.parse(localStorage.getItem(KUNCI_TUTUP) || '{}') || {}
  }
  catch {
    tutup.value = {}
  }
})
const simpanTutup = () => {
  try {
    localStorage.setItem(KUNCI_TUTUP, JSON.stringify(tutup.value))
  }
  catch { /* view state only */ }
}
const ditutup = (d: string) => tutup.value[d] !== 0
function balik(d: string) {
  tutup.value = { ...tutup.value, [d]: ditutup(d) ? 0 : 1 }
  simpanTutup()
}
const semua = computed(() => [...formats.value, ...lama.value])
const adaTerbuka = computed(() => semua.value.some(d => !ditutup(d)))
function balikSemua() {
  const v: 0 | 1 = adaTerbuka.value ? 1 : 0
  tutup.value = Object.fromEntries(semua.value.map(d => [d, v]))
  simpanTutup()
}

// ---- writes
const sibuk = ref(false)
async function jalankan(langkah: () => Promise<unknown>, sukses: string, jejak?: { action: string, detail: string }) {
  sibuk.value = true
  const ok = await mktSimpan(langkah, sukses, jejak ? { refType: 'template', refId: '-', ...jejak } : undefined)
  sibuk.value = false
  return ok
}
const tulisFormats = (ubah: (f: string[]) => string[]) =>
  ubahDokumenMkt<string[] | null>('fbFormats', f => ubah(Array.isArray(f) ? f : formats.value))
const tulisSubs = (ubah: (s: SubKatMkt[]) => SubKatMkt[]) =>
  ubahDokumenMkt<SubKatMkt[] | null>('fbSubs', s => ubah(Array.isArray(s) ? s : []))
async function tambalTemplates(xs: { id: string, updatedAt?: number, fields: Partial<TemplateTugasMkt> }[]) {
  for (const t of xs) await tambalMkt<TemplateTugasMkt>('task-templates', t.id, t.fields, t.updatedAt)
}
async function tambalEvents(xs: UbahEventMkt[]) {
  for (const e of xs) await tambalMkt<EventMkt>('events', e.id, e.fields as Partial<EventMkt>, e.updatedAt)
}
async function hapusTemplates(xs: TemplateTugasMkt[]) {
  for (const t of xs) await hapusMkt('task-templates', t.id, t.updatedAt)
}

// ---- one-field name sheet (category new/rename, sub new/rename)
const nama = reactive({ buka: false, judul: '', sub: '', label: '', nilai: '', help: '', aksi: (_: string) => {} })
function mintaNama(o: { judul: string, sub?: string, label: string, nilai?: string, help?: string, aksi: (v: string) => void }) {
  Object.assign(nama, { sub: '', nilai: '', help: '', ...o, buka: true })
}

function kategoriBaru() {
  mintaNama({
    judul: 'Kategori Baru', sub: 'Kategori to-do event — mis. Prasmanan, Set Menu', label: 'Nama Kategori',
    help: 'Begitu disimpan, kategori ini langsung bisa dipilih di isian Format F&B pada form event.',
    aksi: async (v) => {
      const n = bersihNamaMkt(v)
      const salah = cekNamaKategoriMkt(n, formats.value, org.value)
      if (salah) return toast.add({ title: salah.judul, description: salah.isi, color: 'error' })
      if (await jalankan(() => tulisFormats(f => [...f, n]), `Kategori "${n}" ditambahkan.`)) nama.buka = false
    },
  })
}
function ubahNamaKategori(fmt: string) {
  const dipakai = st.value.events.filter(e => (e.detail as Record<string, unknown> | undefined)?.fbFormat === fmt).length
  mintaNama({
    judul: 'Ubah Nama Kategori', sub: fmt, label: 'Nama Kategori', nilai: fmt,
    help: `Isi kategori tidak berubah — hanya namanya.${dipakai ? ` ${dipakai} event memakai kategori ini; isian Format F&B-nya ikut diperbarui supaya daftar to-do dan progresnya tidak terputus.` : ''}`,
    aksi: async (v) => {
      const baru = bersihNamaMkt(v)
      if (baru === fmt) return (nama.buka = false)
      const salah = cekNamaKategoriMkt(baru, formats.value, org.value, fmt)
      if (salah) return toast.add({ title: salah.judul, description: salah.isi, color: 'error' })
      const r = rencanaUbahNamaMkt(fmt, baru, formats.value, subs.value, tpl.value, st.value.events)
      const ok = await jalankan(async () => {
        await tulisFormats(f => f.map(x => (x === fmt ? baru : x)))
        await tulisSubs(s => s.map(x => (x.div === fmt ? { ...x, div: baru } : x)))
        await tambalTemplates(r.templates)
        await tambalEvents(r.events)
      }, `Kategori "${fmt}" jadi "${baru}".`, { action: 'Nama kategori diubah', detail: `${fmt} → ${baru}${r.nEvent ? ` · ${r.nEvent} event ikut` : ''}` })
      if (ok) nama.buka = false
    },
  })
}
async function hapusKategori(fmt: string) {
  const n = templateDivMkt(tpl.value, fmt).length
  const ns = subsDariMkt(subs.value, fmt).length
  const dipakai = st.value.events.filter(e => (e.detail as Record<string, unknown> | undefined)?.fbFormat === fmt).length
  if (!confirm(`Hapus kategori ${fmt}${n ? ` beserta ${n} item to-do` : ''}${ns ? ` dan ${ns} sub kategori` : ''}?${dipakai ? `\n\n${dipakai} event masih memakai kategori ini. Isian Format F&B pada event itu tidak diubah, tapi daftar to-do-nya tidak akan muncul lagi.` : ''}\n\nTindakan ini tidak bisa dibatalkan.`)) return
  await jalankan(async () => {
    await tulisFormats(f => f.filter(x => x !== fmt))
    await tulisSubs(s => s.filter(x => x.div !== fmt))
    await hapusTemplates(templateDivMkt(tpl.value, fmt))
  }, `Kategori "${fmt}" dihapus.`)
}

// ---- copy from another category
const salin = reactive({ buka: false, target: '', sumber: '' })
const sumberSalin = computed(() => [...formats.value.filter(f => f !== salin.target), ...lama.value])
function bukaSalin(target: string) {
  salin.target = target
  if (!formats.value.filter(f => f !== target).length && !lama.value.length) {
    return toast.add({ title: 'Tidak ada sumber', description: 'Belum ada kategori lain yang bisa disalin.', color: 'error' })
  }
  salin.sumber = sumberSalin.value[0] ?? ''
  salin.buka = true
}
async function doSalin() {
  if (!salin.sumber || salin.sumber === salin.target) return toast.add({ title: 'Pilih sumber', description: 'Pilih kategori asal dulu.', color: 'error' })
  const r = rencanaSalinMkt(salin.target, salin.sumber, subs.value, tpl.value, idBaru)
  const ok = await jalankan(async () => {
    if (r.subsBaru.length) await tulisSubs(s => [...s, ...r.subsBaru])
    for (const t of r.itemBaru) {
      const { id: _id, ...baris } = t
      await buatMkt<TemplateTugasMkt>('task-templates', baris)
    }
  }, `${r.itemBaru.length} item${r.subsBaru.length ? ` & ${r.subsBaru.length} sub kategori` : ''} masuk ke ${salin.target}${r.lewat ? ` · ${r.lewat} dilewati karena sudah ada` : ''}.`,
  { action: 'Isi kategori disalin', detail: `${salin.sumber} → ${salin.target} · ${r.itemBaru.length} item${r.lewat ? ` (${r.lewat} dilewati)` : ''}` })
  if (ok) salin.buka = false
}

// ---- sub categories
function subBaru(div: string) {
  mintaNama({
    judul: 'Sub Kategori Baru', sub: `Di dalam ${div}`, label: 'Nama Sub Kategori',
    help: `Kelompok di dalam ${div} — mis. Appetizer, Main Course, Dessert. Item to-do-nya ditambahkan setelah ini.`,
    aksi: async (v) => {
      const n = bersihNamaMkt(v)
      const salah = cekNamaSubMkt(n, subs.value, div)
      if (salah) return toast.add({ title: salah.judul, description: salah.isi, color: 'error' })
      if (await jalankan(() => tulisSubs(s => [...s, { id: idBaru('sc'), div, nama: n }]), `"${n}" ditambahkan ke ${div}.`, { action: 'Sub kategori dibuat', detail: `${div} · ${n}` })) nama.buka = false
    },
  })
}
function ubahNamaSub(sc: SubKatMkt) {
  mintaNama({
    judul: 'Ubah Nama Sub Kategori', sub: `${sc.div} · ${sc.nama}`, label: 'Nama Sub Kategori', nilai: sc.nama,
    help: 'Item to-do di dalamnya ikut pindah — namanya diperbarui, bukan disalin.',
    aksi: async (v) => {
      const n = bersihNamaMkt(v)
      if (n === sc.nama) return (nama.buka = false)
      const salah = cekNamaSubMkt(n, subs.value, sc.div, sc.id)
      if (salah) return toast.add({ title: salah.judul, description: salah.isi, color: 'error' })
      const ok = await jalankan(async () => {
        await tulisSubs(s => s.map(x => (x.id === sc.id ? { ...x, nama: n } : x)))
        await tambalTemplates(templateSubMkt(tpl.value, sc.div, sc.nama).map(t => ({ id: t.id, updatedAt: t.updatedAt, fields: { sub: n } })))
      }, `Sub kategori diubah jadi "${n}".`, { action: 'Sub kategori diubah', detail: `${sc.div} · ${sc.nama} → ${n}` })
      if (ok) nama.buka = false
    },
  })
}
async function hapusSub(sc: SubKatMkt) {
  const isi = templateSubMkt(tpl.value, sc.div, sc.nama)
  if (!confirm(`Hapus sub kategori ${sc.nama}?${isi.length ? `\n\n${isi.length} item to-do di dalamnya TIDAK ikut terhapus — mereka pindah ke kelompok "tanpa sub kategori" dan bisa dikelompokkan ulang.` : ''}`)) return
  await jalankan(async () => {
    await tambalTemplates(isi.map(t => ({ id: t.id, updatedAt: t.updatedAt, fields: { sub: '' } })))
    await tulisSubs(s => s.filter(x => x.id !== sc.id))
  }, `Sub kategori "${sc.nama}" dihapus.`, { action: 'Sub kategori dihapus', detail: `${sc.div} · ${sc.nama}` })
}
async function geserSub(sc: SubKatMkt, arah: -1 | 1) {
  const daftar = subsDariMkt(subs.value, sc.div)
  const tetangga = daftar[daftar.indexOf(sc) + arah]
  if (!tetangga) return
  await jalankan(() => tulisSubs(s => urutSubMkt(s, sc.id, tetangga.id)), '', { action: 'Urutan sub kategori diubah', detail: `${sc.div} · ${sc.nama}` })
}
const seret = ref<SubKatMkt | null>(null)
const sasaran = ref('')
async function lepas(sc: SubKatMkt) {
  const a = seret.value
  seret.value = null
  sasaran.value = ''
  if (!a || a.id === sc.id || a.div !== sc.div) return
  await jalankan(() => tulisSubs(s => urutSubMkt(s, a.id, sc.id)), '', { action: 'Urutan sub kategori diubah', detail: `${a.div} · ${a.nama}` })
}

// ---- items
const form = reactive({ buka: false, div: '', awal: null as TemplateTugasMkt | null, sub: '' })
function bukaItem(div: string, awal: TemplateTugasMkt | null = null, sub = '') {
  Object.assign(form, { buka: true, div, awal, sub })
}
async function simpanItem(baris: Omit<TemplateTugasMkt, 'id'>) {
  const t = form.awal
  const ok = t
    ? await jalankan(() => tambalMkt<TemplateTugasMkt>('task-templates', t.id, baris, t.updatedAt), `Template task ${form.div} disimpan.`, { action: 'Template task diperbarui', detail: `${form.div} · ${baris.task}` })
    : await jalankan(() => buatMkt<TemplateTugasMkt>('task-templates', baris), `Template task ${form.div} disimpan.`, { action: 'Template task dibuat', detail: `${form.div} · ${baris.task}` })
  if (ok) form.buka = false
}
async function hapusItem(t: TemplateTugasMkt) {
  if (!confirm(`Yakin hapus template task ${t.task ?? ''}? Tindakan ini tidak bisa dibatalkan.`)) return
  await jalankan(() => hapusMkt('task-templates', t.id, t.updatedAt), 'Template task dihapus.')
}

// ---- old division categories
const tujuan = reactive<Record<string, string>>({})
async function pindah(div: string) {
  const fmt = tujuan[div] || formats.value[0] || ''
  if (!fmt) return toast.add({ title: 'Pilih kategori', description: 'Pilih kategori tujuan dulu.', color: 'error' })
  const r = rencanaPindahMkt(div, fmt, subs.value, tpl.value, st.value.events, idBaru)
  if (!confirm(`Pindahkan ${div} (${r.nItem} item) menjadi sub kategori di dalam ${fmt}?${r.nSubLama ? `\n\n${r.nSubLama} sub kategori di dalamnya akan digabung namanya jadi "${div} — nama sub", supaya tidak ada yang tertimpa.` : ''}\n\nProgres yang sudah tercatat di event ber-format ${fmt} ikut pindah.`)) return
  await jalankan(async () => {
    await tulisSubs(() => r.subs)
    await tambalTemplates(r.templates)
    await tambalEvents(r.events)
  }, `${div} kini sub kategori di dalam ${fmt}.`, { action: 'Kategori lama dipindah', detail: `${div} → ${fmt} · ${r.nItem} item` })
}
async function hapusLama(div: string) {
  const isi = templateDivMkt(tpl.value, div)
  const ns = subsDariMkt(subs.value, div).length
  if (!confirm(`Hapus kategori ${div}${isi.length ? ` beserta ${isi.length} task di dalamnya` : ''}${ns ? ` dan ${ns} sub kategori` : ''}? Tindakan ini tidak bisa dibatalkan.`)) return
  await jalankan(async () => {
    await tulisSubs(s => s.filter(x => x.div !== div))
    await hapusTemplates(isi)
    await tambalEvents(rencanaHapusLamaMkt(div, st.value.events))
  }, `Kategori "${div}" dihapus.`)
}
</script>

<template>
  <AppPage
    title="Template Task"
    description="Standar to-do per Format F&B — jadi acuan handover & isi papan Task Divisi."
  >
    <template #actions>
      <UButton
        v-if="semua.length"
        :label="adaTerbuka ? 'Tutup semua' : 'Buka semua'"
        color="neutral"
        variant="outline"
        @click="balikSemua"
      />
      <UButton
        v-if="bisaUbah"
        icon="i-lucide-plus"
        label="Tambah Kategori"
        @click="kategoriBaru"
      />
    </template>
    <MarketingGerbang layar="templates">
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        class="mb-4"
        description="Tiap event mengambil satu kategori to-do — kategori yang dipakai mengikuti isian Format F&B di form event. Event yang memilih Prasmanan mendapat seluruh daftar di bawah kartu Prasmanan; divisi (Kitchen, Bar, Floor, …) jadi sub kategori di dalamnya."
      />
      <p
        v-if="status === 'pending' && !st.taskTemplates.length"
        class="p-6 text-center text-sm text-muted"
      >
        Memuat…
      </p>
      <AppPanel v-else-if="!formats.length">
        <p class="text-sm text-muted">
          Belum ada kategori. Tambahkan satu supaya event bisa memilihnya dan punya daftar to-do.
        </p>
      </AppPanel>

      <template
        v-for="(div, i) in [...formats, ...lama]"
        :key="div"
      >
        <template v-if="i === formats.length">
          <p class="mt-6 mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
            Kategori lama — belum dipindah
          </p>
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            class="mb-3"
            description="Ini template dari waktu divisi masih jadi kategori to-do. Isinya tidak hilang dan tidak dipindah otomatis — menebak kategorinya salah berarti menaruh pekerjaan di event yang keliru. Pindahkan sendiri ke kategori yang sesuai; item beserta progres yang sudah tercatat ikut pindah."
          />
        </template>
        <AppPanel
          v-if="i >= formats.length && bisaUbah && formats.length"
          class="mb-2"
        >
          <div class="flex flex-wrap items-center gap-2">
            <div class="min-w-40 flex-1">
              <b class="text-sm">{{ div }}</b>
              <p class="text-xs text-muted">
                {{ templateDivMkt(tpl, div).length }} item to-do{{ subsDariMkt(subs, div).length ? ` · ${subsDariMkt(subs, div).length} sub kategori` : '' }}
              </p>
            </div>
            <USelect
              :model-value="tujuan[div] || formats[0]"
              :items="formats"
              aria-label="Kategori tujuan"
              class="w-44"
              @update:model-value="tujuan[div] = String($event)"
            />
            <UButton
              label="Pindahkan"
              size="sm"
              :loading="sibuk"
              @click="pindah(div)"
            />
          </div>
        </AppPanel>

        <AppPanel
          class="mb-3"
          flush
        >
          <div class="flex flex-wrap items-start gap-2 p-4">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-start gap-2 text-start"
              :aria-expanded="!ditutup(div)"
              @click="balik(div)"
            >
              <UIcon
                name="i-lucide-chevron-right"
                class="mt-1 size-4 shrink-0 transition"
                :class="ditutup(div) ? '' : 'rotate-90'"
              />
              <span class="min-w-0">
                <span class="flex flex-wrap items-center gap-1.5 font-semibold text-highlighted">
                  {{ div }}
                  <UBadge
                    :label="String(templateDivMkt(tpl, div).length)"
                    color="neutral"
                    variant="soft"
                    size="sm"
                  />
                  <UBadge
                    v-if="subsDariMkt(subs, div).length"
                    :label="`${subsDariMkt(subs, div).length} sub`"
                    color="neutral"
                    variant="soft"
                    size="sm"
                  />
                </span>
                <span
                  v-if="i < formats.length"
                  class="block text-xs text-muted"
                >Seluruh to-do event yang kategorinya {{ div }}.</span>
              </span>
            </button>
            <div
              v-if="bisaUbah"
              class="flex flex-wrap gap-1"
            >
              <template v-if="i < formats.length">
                <UButton
                  icon="i-lucide-copy"
                  label="Salin dari"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  @click="bukaSalin(div)"
                />
                <UButton
                  icon="i-lucide-pencil"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  aria-label="Ubah nama kategori"
                  @click="ubahNamaKategori(div)"
                />
              </template>
              <UButton
                icon="i-lucide-plus"
                label="Sub Kategori"
                size="xs"
                color="neutral"
                variant="outline"
                @click="subBaru(div)"
              />
              <UButton
                icon="i-lucide-plus"
                label="Tambah Task"
                size="xs"
                @click="bukaItem(div)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="outline"
                :aria-label="`Hapus kategori ${div} beserta seluruh task di dalamnya`"
                @click="i < formats.length ? hapusKategori(div) : hapusLama(div)"
              />
            </div>
          </div>

          <div
            v-if="!ditutup(div)"
            class="border-t border-default"
          >
            <p
              v-if="!templateDivMkt(tpl, div).length && !subsDariMkt(subs, div).length"
              class="px-4 py-3 text-sm text-muted"
            >
              —
            </p>
            <template v-else>
              <template v-if="templateSubMkt(tpl, div, '').length">
                <p
                  v-if="subsDariMkt(subs, div).length"
                  class="px-4 pt-3 text-xs font-semibold tracking-wide text-muted uppercase"
                >
                  Tanpa sub kategori
                </p>
                <MarketingTabelTemplate
                  :items="templateSubMkt(tpl, div, '')"
                  :bisa-ubah="bisaUbah"
                  :tgl="tglMkt"
                  @ubah="bukaItem(div, $event)"
                  @hapus="hapusItem"
                  @tambah="bukaItem(div)"
                />
              </template>
              <div
                v-for="(sc, k) in subsDariMkt(subs, div)"
                :key="sc.id"
              >
                <div
                  class="flex flex-wrap items-center gap-2 border-t border-default bg-muted px-4 py-2"
                  :class="sasaran === sc.id ? 'ring-2 ring-primary-400 ring-inset' : ''"
                  :draggable="bisaUbah"
                  @dragstart="seret = sc"
                  @dragend="seret = null; sasaran = ''"
                  @dragover.prevent="seret && seret.div === sc.div && seret.id !== sc.id && (sasaran = sc.id)"
                  @dragleave="sasaran === sc.id && (sasaran = '')"
                  @drop.prevent="lepas(sc)"
                >
                  <UIcon
                    v-if="bisaUbah"
                    name="i-lucide-grip-vertical"
                    class="hidden size-4 cursor-grab text-dimmed lg:block"
                    title="Tarik untuk mengubah urutan"
                  />
                  <span class="min-w-0 flex-1 text-sm font-semibold">
                    {{ sc.nama }}
                    <UBadge
                      :label="String(templateSubMkt(tpl, div, sc.nama).length)"
                      color="neutral"
                      variant="soft"
                      size="sm"
                    />
                  </span>
                  <div
                    v-if="bisaUbah"
                    class="flex gap-1"
                  >
                    <UButton
                      icon="i-lucide-arrow-up"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :disabled="k === 0 || sibuk"
                      aria-label="Naikkan urutan"
                      @click="geserSub(sc, -1)"
                    />
                    <UButton
                      icon="i-lucide-arrow-down"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :disabled="k === subsDariMkt(subs, div).length - 1 || sibuk"
                      aria-label="Turunkan urutan"
                      @click="geserSub(sc, 1)"
                    />
                    <UButton
                      icon="i-lucide-plus"
                      label="Item"
                      size="xs"
                      color="neutral"
                      variant="outline"
                      @click="bukaItem(div, null, sc.nama)"
                    />
                    <UButton
                      icon="i-lucide-pencil"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      aria-label="Ubah nama sub kategori"
                      @click="ubahNamaSub(sc)"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      aria-label="Hapus sub kategori"
                      @click="hapusSub(sc)"
                    />
                  </div>
                </div>
                <MarketingTabelTemplate
                  :items="templateSubMkt(tpl, div, sc.nama)"
                  :bisa-ubah="bisaUbah"
                  :tgl="tglMkt"
                  @ubah="bukaItem(div, $event)"
                  @hapus="hapusItem"
                  @tambah="bukaItem(div, null, sc.nama)"
                />
              </div>
            </template>
          </div>
        </AppPanel>
      </template>

      <MarketingTemplateForm
        v-model:open="form.buka"
        :div="form.div"
        :awal="form.awal"
        :sub-awal="form.sub"
        :subs="subs"
        :staf="staf"
        :sibuk="sibuk"
        @simpan="simpanItem"
      />

      <ResponsiveSheet
        v-model:open="nama.buka"
        :title="nama.judul"
        :description="nama.sub"
      >
        <UFormField
          :label="nama.label"
          :help="nama.help"
          required
        >
          <UInput
            v-model="nama.nilai"
            class="w-full"
            autofocus
            @keydown.enter.prevent="nama.aksi(nama.nilai)"
          />
        </UFormField>
        <template #footer>
          <UButton
            label="Simpan"
            :loading="sibuk"
            @click="nama.aksi(nama.nilai)"
          />
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            @click="nama.buka = false"
          />
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="salin.buka"
        title="Salin dari Kategori Lain"
        :description="`Tujuan: ${salin.target}`"
      >
        <UFormField
          label="Salin dari"
          required
        >
          <USelect
            v-model="salin.sumber"
            :items="sumberSalin.map(f => ({ value: f, label: `${f} (${templateDivMkt(tpl, f).length} item)` }))"
            class="w-full"
          />
        </UFormField>
        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          class="mt-4"
          :description="`Item & sub kategori dari sumber ditambahkan ke ${salin.target}, bukan menggantinya. Item yang namanya sudah ada di sub kategori yang sama dilewati, jadi menyalin dua kali tidak menggandakan daftar. Progres event tidak ikut tersalin — yang disalin standarnya, bukan pekerjaan yang sudah berjalan.`"
        />
        <template #footer>
          <UButton
            label="Salin"
            :loading="sibuk"
            @click="doSalin"
          />
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            @click="salin.buka = false"
          />
        </template>
      </ResponsiveSheet>
    </MarketingGerbang>
  </AppPage>
</template>
