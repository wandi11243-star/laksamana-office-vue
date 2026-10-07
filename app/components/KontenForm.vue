<!--
  Konten › form Konten Baru / Edit Konten (old openContentForm + saveContent,
  deploy/konten/index.html:1982-2240; konten.md D.21 "Form Konten").

  Same fields and order as the old drawer. Rules kept:
  - title, at least one platform and at least one content type are required;
  - a NEW item ticks no content type (the old <select> silently saved "Reel");
  - the old single fields platform/contentType/printType are written too
    (first choice), because calendar, queues and CSV still read them (F.27);
  - keyword/caption/hashtags/script are NOT written: they live on as archive,
    contentDetail() reads them while `detail` is empty (F.28);
  - production needs keep their todo/done state when edited;
  - saving drops old auto-made `shootings` linked to this item (syncProdTasks):
    shooting now lives in prod.shoot, so they would show twice.
  An edit is a whole-record PUT built on the stored row, with its version.
-->
<script setup lang="ts">
import type { KontenItem, ProdKind, RefKonten } from '~/utils/konten'
import {
  CONTENT_TYPES, PILLARS, PLATFORM_KONTEN, PRINT_TYPES, PRIORITY_KONTEN, PROD_KINDS, PROD_TYPES, ROLES_KONTEN, STATUS_KONTEN,
  catatanCetak, contentDetail, contentPlatforms, contentRefs, contentTypes, geserTanggal, printTypes, prodSimpan, rapikanLink,
  rekomTglProduksi,
} from '~/utils/konten'
import { hariIni } from '~/utils/format'

const props = defineProps<{ item?: KontenItem | null }>()
const emit = defineEmits<{ simpan: [id: string], batal: [] }>()

const toast = useToast()
const { data: st } = useStateKonten()
const { saya } = useAksesKonten()
const brandAktif = useBrandKonten()
const c = props.item ?? null
const hari = hariIni()

const f = reactive({
  title: c?.title ?? '',
  brand: c?.brand ?? (brandAktif.value !== 'all' ? brandAktif.value : (st.value.brands[0]?.id ?? '')),
  platforms: c ? contentPlatforms(c) : ['IG'],
  pillar: (c?.pillar ?? PILLARS[0]) as string,
  contentTypes: c ? contentTypes(c) : [] as string[],
  printTypes: c ? printTypes(c) : [] as string[],
  detail: contentDetail(c),
  pic: c?.pic ?? '',
  priority: c?.priority ?? 'medium',
  status: (c?.status ?? 'Idea') as string,
  deadline: c?.deadline ?? '',
  publishDate: c?.publishDate ?? '',
  publishTime: c?.publishTime ?? '20:00',
})
const refs = ref<RefKonten[]>(contentRefs(c).map(r => ({ ...r })))
/** Ticked production needs → their date. A key that is absent = not needed. */
const prod = ref<Partial<Record<ProdKind, string>>>(Object.fromEntries(
  PROD_KINDS.filter(k => c?.prod?.[k]).map(k => [k, c!.prod![k]!.date ?? '']),
))

const SEMUA = '__none__'
const opsiBrand = computed(() => st.value.brands.map(b => ({ value: b.id, label: b.name })))
const opsiPic = computed(() => [{ value: SEMUA, label: '- Belum ditentukan -' }, ...st.value.users.map(u => ({
  value: u.id,
  label: `${u.name} (${(u.roles ?? []).map(r => (ROLES_KONTEN as Record<string, { short: string }>)[r]?.short ?? r).join(' + ')})`,
}))])
const picPilih = computed({ get: () => f.pic || SEMUA, set: (v: string) => {
  f.pic = v === SEMUA ? '' : v
} })
const opsiPrio = Object.entries(PRIORITY_KONTEN).map(([value, p]) => ({ value, label: p.label }))
const opsiStatus = STATUS_KONTEN.map(s => ({ value: s as string, label: s as string }))
const opsiPillar = PILLARS.map(p => p as string)

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

function centangProd(k: ProdKind, on: boolean) {
  if (on) {
    prod.value = { ...prod.value, [k]: prod.value[k] || rekomTglProduksi(k, f.publishDate, hari) }
    return
  }
  prod.value = Object.fromEntries(Object.entries(prod.value).filter(([x]) => x !== k))
}
// A new publish date re-recommends every ticked need, and fills the main
// deadline with H-1 when it is still empty (onPublishDateChange, :2191-2198).
watch(() => f.publishDate, (pub) => {
  const p = { ...prod.value }
  for (const k of PROD_KINDS) if (p[k] !== undefined) p[k] = rekomTglProduksi(k, pub, hari)
  prod.value = p
  if (pub && !f.deadline) f.deadline = geserTanggal(pub, -1)
})

// ---- references: links & photos, one list in the order they were added ----
const linkBaru = ref('')
function tambahLink() {
  const v = rapikanLink(linkBaru.value)
  if (!v) return toast.add({ title: 'Tempel dulu linknya', color: 'error' })
  if (refs.value.some(r => r.t === 'link' && r.v === v)) {
    linkBaru.value = ''
    return toast.add({ title: 'Link itu sudah ada di daftar', color: 'error' })
  }
  refs.value.push({ t: 'link', v, n: v.replace(/^https?:\/\//i, '').slice(0, 60) })
  linkBaru.value = ''
}
async function tambahFoto(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  const terpakai = () => refs.value.filter(r => r.t === 'img').reduce((s, r) => s + r.v.length, 0)
  let ditolak = 0
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      ditolak++
      continue
    }
    if (file.size > REF_IMG_MB * 1024 * 1024) {
      toast.add({ title: `"${file.name}" lebih dari ${REF_IMG_MB} MB - dilewati`, color: 'error' })
      continue
    }
    try {
      const data = await kecilkanGambarKonten(file)
      // The TOTAL is checked, not just each file: ten photos that pass one by
      // one would make the next save fail, far from where they were added.
      if (terpakai() + data.length > REF_TOTAL_MB * 1024 * 1024 * 1.37) {
        toast.add({ title: `Total foto referensi sudah mendekati ${REF_TOTAL_MB} MB - "${file.name}" tidak ditambahkan`, color: 'error' })
        continue
      }
      refs.value.push({ t: 'img', v: data, n: file.name })
    }
    catch (err) {
      toast.add({ title: `"${file.name}": ${(err as Error).message}`, color: 'error' })
    }
  }
  if (ditolak) toast.add({ title: `${ditolak} berkas dilewati karena bukan gambar`, color: 'error' })
}

const menyimpan = ref(false)
async function simpan() {
  const title = f.title.trim()
  if (!title) return toast.add({ title: 'Judul wajib diisi', color: 'error' })
  if (!f.platforms.length) return toast.add({ title: 'Pilih minimal satu platform', color: 'error' })
  if (!f.contentTypes.length) return toast.add({ title: 'Pilih minimal satu Content Type', color: 'error' })
  const data: Partial<KontenItem> = {
    brand: f.brand, platforms: f.platforms, platform: f.platforms[0], pillar: f.pillar,
    contentTypes: f.contentTypes, contentType: f.contentTypes[0], printTypes: f.printTypes, printType: f.printTypes[0] ?? '',
    title, detail: f.detail, refs: [...refs.value], pic: f.pic, priority: f.priority, status: f.status,
    deadline: f.deadline, publishDate: f.publishDate, publishTime: f.publishTime,
    prod: prodSimpan(prod.value, c?.prod),
  }
  menyimpan.value = true
  let id = c?.id ?? ''
  const ok = await kontenSimpan(async () => {
    if (c) {
      await ubahKonten<KontenItem>('content', c.id, { ...c, ...data }, c.updatedAt)
    }
    else {
      const res = await buatKonten<KontenItem>('content', {
        // the old mkContent defaults that still matter (:1357-1378)
        campaign: '', checklist: [], comments: [], revisions: [], approvals: [],
        ...data, createdBy: saya.value?.user.id ?? '', createdAt: Date.now(),
      })
      id = res.data.id
      notifKonten('publish', `Konten baru dibuat: ${title}`)
    }
    // syncProdTasks (:2240): drop old auto-made shootings linked to this item.
    for (const s of st.value.shootings.filter(x => x.contentId && x.contentId === id)) {
      await hapusKonten('shootings', s.id, s.updatedAt)
    }
  }, c ? 'Konten diperbarui' : 'Konten dibuat', { action: c ? 'mengubah konten' : 'membuat konten', target: title })
  menyimpan.value = false
  if (ok) emit('simpan', id)
}
</script>

<template>
  <AppPanel :title="c ? 'Edit konten' : 'Konten baru'">
    <div class="grid gap-4 lg:grid-cols-2">
      <UFormField
        label="Judul / hook"
        required
        class="lg:col-span-2"
      >
        <UInput
          v-model="f.title"
          placeholder="Judul kerja konten"
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
      <UFormField label="Content pillar">
        <USelect
          v-model="f.pillar"
          :items="opsiPillar"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Platform"
        description="Bisa pilih lebih dari satu"
        required
        class="lg:col-span-2"
      >
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="p in PLATFORM_KONTEN"
            :key="p"
            :label="p"
            size="sm"
            :color="f.platforms.includes(p) ? 'primary' : 'neutral'"
            :variant="f.platforms.includes(p) ? 'soft' : 'outline'"
            :icon="f.platforms.includes(p) ? 'i-lucide-check' : undefined"
            @click="f.platforms = toggle(f.platforms, p)"
          />
        </div>
      </UFormField>
      <UFormField
        label="Content type"
        description="Bisa pilih lebih dari satu"
        required
        class="lg:col-span-2"
      >
        <div class="flex flex-wrap gap-2">
          <UCheckbox
            v-for="t in CONTENT_TYPES"
            :key="t"
            :model-value="f.contentTypes.includes(t)"
            :label="t"
            class="rounded-field border border-default px-2.5 py-1.5"
            @update:model-value="f.contentTypes = toggle(f.contentTypes, t)"
          />
        </div>
      </UFormField>
      <UFormField
        label="Print type"
        description="Bisa pilih lebih dari satu, kosongkan bila tidak dicetak"
        :help="catatanCetak(f.printTypes)"
        class="lg:col-span-2"
      >
        <div class="flex flex-wrap gap-2">
          <UCheckbox
            v-for="(ukuran, r) in PRINT_TYPES"
            :key="r"
            :model-value="f.printTypes.includes(String(r))"
            :label="String(r)"
            :title="ukuran"
            class="rounded-field border border-default px-2.5 py-1.5"
            @update:model-value="f.printTypes = toggle(f.printTypes, String(r))"
          />
        </div>
      </UFormField>

      <UFormField
        label="Detailing"
        description="Satu kolom untuk seluruh isi konten - caption, hashtag, keyword, sampai script / storyboard."
        class="lg:col-span-2"
      >
        <UTextarea
          v-model="f.detail"
          :rows="10"
          autoresize
          placeholder="Caption…&#10;&#10;#hashtag #laksamanamuda&#10;&#10;Script / storyboard:&#10;1. …"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Referensi"
        :description="`Tautan (Drive, IG, TikTok, Pinterest) & foto contoh. Foto ikut tersimpan di dalam data modul - maks ${REF_IMG_MB} MB per foto.`"
        class="lg:col-span-2"
      >
        <div class="flex flex-wrap items-center gap-2">
          <UInput
            v-model="linkBaru"
            placeholder="Tempel link lalu Enter"
            class="min-w-48 flex-1"
            @keydown.enter.prevent="tambahLink"
          />
          <UButton
            label="Tambah link"
            icon="i-lucide-link"
            color="neutral"
            variant="outline"
            size="sm"
            @click="tambahLink"
          />
          <label class="cursor-pointer">
            <span class="inline-flex items-center gap-1.5 rounded-field border border-default px-2.5 py-1.5 text-sm font-medium hover:bg-muted">
              <UIcon
                name="i-lucide-image-plus"
                class="size-4"
              /> Tambah foto
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="tambahFoto"
            >
          </label>
        </div>
        <p
          v-if="!refs.length"
          class="mt-2 text-xs text-muted"
        >
          Belum ada referensi.
        </p>
        <div
          v-else
          class="mt-3 flex flex-wrap gap-2.5"
        >
          <div
            v-for="(r, i) in refs"
            :key="i"
            class="relative"
          >
            <img
              v-if="r.t === 'img'"
              :src="r.v"
              :alt="r.n || 'Referensi'"
              class="size-22 rounded-field border border-default object-cover"
            >
            <a
              v-else
              :href="r.v"
              target="_blank"
              rel="noopener"
              class="inline-block max-w-60 truncate rounded-field border border-default px-2.5 py-1.5 text-xs text-info"
            >{{ r.n || r.v }}</a>
            <UButton
              icon="i-lucide-x"
              color="error"
              size="xs"
              class="absolute -top-2 -right-2 rounded-full"
              aria-label="Hapus referensi"
              @click="refs.splice(i, 1)"
            />
          </div>
        </div>
      </UFormField>

      <UFormField label="PIC">
        <USelect
          v-model="picPilih"
          :items="opsiPic"
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
      <UFormField label="Status">
        <USelect
          v-model="f.status"
          :items="opsiStatus"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Deadline produksi">
        <UInput
          v-model="f.deadline"
          type="date"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Tanggal tayang">
        <UInput
          v-model="f.publishDate"
          type="date"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Jam tayang">
        <UInput
          v-model="f.publishTime"
          type="time"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Kebutuhan produksi"
        description="Centang pekerjaan yang diperlukan - tanggal deadline langsung terisi rekomendasi (bisa diubah). Setiap kebutuhan otomatis muncul di queue & kalender."
        class="lg:col-span-2"
      >
        <div class="space-y-2">
          <div
            v-for="k in PROD_KINDS"
            :key="k"
            class="rounded-field border border-default p-3"
            :class="prod[k] !== undefined ? 'bg-primary-50' : ''"
          >
            <UCheckbox
              :model-value="prod[k] !== undefined"
              :label="PROD_TYPES[k].label"
              @update:model-value="v => centangProd(k, !!v)"
            />
            <div
              v-if="prod[k] !== undefined"
              class="mt-2 flex flex-wrap items-end gap-2 pl-6"
            >
              <UFormField
                :label="`Deadline ${PROD_TYPES[k].short}`"
                class="min-w-36 flex-1"
              >
                <UInput
                  :model-value="prod[k]"
                  type="date"
                  class="w-full"
                  @update:model-value="v => prod = { ...prod, [k]: String(v) }"
                />
              </UFormField>
              <UButton
                label="Rekomendasi"
                icon="i-lucide-rotate-ccw"
                color="neutral"
                variant="outline"
                size="sm"
                @click="prod = { ...prod, [k]: rekomTglProduksi(k, f.publishDate, hari) }"
              />
            </div>
          </div>
        </div>
      </UFormField>
    </div>

    <div class="mt-5 flex flex-wrap gap-2">
      <UButton
        :label="c ? 'Simpan perubahan' : 'Buat konten'"
        :icon="c ? 'i-lucide-save' : 'i-lucide-plus'"
        :loading="menyimpan"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="emit('batal')"
      />
    </div>
  </AppPanel>
</template>
