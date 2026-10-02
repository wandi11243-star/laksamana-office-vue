<!--
  The material form (old editMaterial/saveMaterial, deploy/akademi/index.html
  :1272-1364): title, category, mandatory, target divisions (all overrides the
  rest), then the fields of that type. A quiz has its own question builder. A new
  material defaults to published (`:1339`); there is no publish control here.
-->
<script setup lang="ts">
import type { DivisiAkademi, MateriAkademi, MenuMateri, SoalKuis, TipeMateri } from '~/composables/useAkademi'
import { ikonDivisi, KATEGORI_MATERI } from '~/utils/akademi-konstanta'
import { statusTipe } from '~/utils/status-akademi'

const props = defineProps<{
  materi: MateriAkademi | null
  tipeBaru: TipeMateri | null
  divisions: DivisiAkademi[]
  passingDefault: number
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ simpan: [body: Record<string, unknown>] }>()
const toast = useToast()

const tipe = computed<TipeMateri>(() => props.materi?.type ?? props.tipeBaru ?? 'modul')
const tipeInfo = computed(() => statusTipe(tipe.value))

const judul = ref('')
const kategori = ref('sop')
const mandatory = ref(false)
const division = ref<string[]>(['all'])
const isiModul = ref('')
const videoUrl = ref('')
const videoDesc = ref('')
const langkah = ref('')
const menu = ref<MenuMateri>({})
const passing = ref(80)
const pertanyaan = ref<SoalKuis[]>([])

const opsiKategori = KATEGORI_MATERI.map(c => ({ value: c.id, label: c.name }))
const opsiSifat = [
  { value: '0', label: 'Opsional' },
  { value: '1', label: 'Wajib (masuk sertifikasi)' },
]
const sifat = computed({
  get: () => (mandatory.value ? '1' : '0'),
  set: (v: string) => { mandatory.value = v === '1' },
})

function reset() {
  const m = props.materi
  judul.value = m?.title ?? ''
  kategori.value = m?.cat ?? 'sop'
  mandatory.value = m?.mandatory ?? false
  division.value = m?.division?.length ? [...m.division] : ['all']
  isiModul.value = m?.body ?? ''
  videoUrl.value = m?.videoUrl ?? ''
  videoDesc.value = m?.desc ?? ''
  langkah.value = (m?.steps ?? []).join('\n')
  menu.value = m?.menu ? { ...m.menu } : {}
  passing.value = Number(m?.passing) || props.passingDefault
  pertanyaan.value = (m?.questions ?? []).map(q => ({ q: q.q, opts: [...q.opts], a: q.a }))
}

watch(open, (v) => {
  if (v) reset()
})
watch(() => props.materi?.id, () => {
  if (open.value) reset()
})

function toggleDiv(id: string) {
  if (id === 'all') {
    division.value = division.value.includes('all') ? [] : ['all']
    return
  }
  const s = new Set(division.value.filter(d => d !== 'all'))
  if (s.has(id)) {
    s.delete(id)
  }
  else {
    s.add(id)
  }
  division.value = [...s]
}

function tambahSoal() {
  pertanyaan.value.push({ q: '', opts: ['', '', '', ''], a: 0 })
}
function hapusSoal(i: number) {
  pertanyaan.value.splice(i, 1)
}

function simpan() {
  const title = judul.value.trim()
  if (!title) {
    toast.add({ title: 'Judul wajib diisi', color: 'error' })
    return
  }
  if (!division.value.length) {
    toast.add({ title: 'Pilih minimal satu divisi', color: 'error' })
    return
  }
  const divs = division.value.includes('all') ? ['all'] : [...division.value]

  const body: Record<string, unknown> = {
    type: tipe.value,
    title,
    cat: kategori.value,
    mandatory: mandatory.value,
    division: divs,
    published: props.materi?.published ?? true,
  }

  if (tipe.value === 'modul') {
    body.body = isiModul.value
  }
  else if (tipe.value === 'video') {
    body.videoUrl = videoUrl.value.trim()
    body.desc = videoDesc.value
  }
  else if (tipe.value === 'sop') {
    const steps = langkah.value.split('\n').map(s => s.trim()).filter(Boolean)
    if (!steps.length) {
      toast.add({ title: 'SOP butuh minimal satu langkah', color: 'error' })
      return
    }
    body.steps = steps
  }
  else if (tipe.value === 'menu') {
    body.menu = { ...menu.value }
  }
  else if (tipe.value === 'quiz') {
    const qs = pertanyaan.value
      .filter(q => q.q.trim() && q.opts.filter(o => o.trim()).length >= 2)
      .map((q) => {
        const opts = q.opts.map(o => o.trim()).filter(Boolean)
        return { q: q.q.trim(), opts, a: Math.min(q.a, opts.length - 1) }
      })
    if (!qs.length) {
      toast.add({ title: 'Kuis butuh minimal satu soal lengkap', color: 'error' })
      return
    }
    body.questions = qs
    body.passing = Number(passing.value) || props.passingDefault
  }

  emit('simpan', body)
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`${materi ? 'Edit' : 'Tambah'} ${tipeInfo.label}`"
  >
    <div class="space-y-3">
      <div class="flex items-center gap-1.5">
        <AppStatus
          :color="tipeInfo.tone"
          :icon="tipeInfo.icon"
        >
          {{ tipeInfo.label }}
        </AppStatus>
        <AppStatus
          v-if="mandatory"
          color="error"
          icon="i-lucide-flag"
        >
          Wajib
        </AppStatus>
      </div>

      <UFormField label="Judul Materi">
        <UInput
          v-model="judul"
          placeholder="cth: SOP Handling Komplain Tamu"
          class="w-full"
        />
      </UFormField>

      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="Kategori">
          <USelect
            v-model="kategori"
            :items="opsiKategori"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Sifat">
          <USelect
            v-model="sifat"
            :items="opsiSifat"
            class="w-full"
          />
        </UFormField>
      </div>

      <div>
        <p class="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
          Untuk Divisi (bisa lebih dari satu)
        </p>
        <div class="flex flex-wrap gap-1.5">
          <label
            class="flex cursor-pointer items-center gap-1.5 rounded-field border px-3 py-1.5 text-[13px] font-semibold"
            :class="division.includes('all') ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
          >
            <input
              type="checkbox"
              class="size-4 accent-primary-600"
              :checked="division.includes('all')"
              @change="toggleDiv('all')"
            >
            <UIcon
              name="i-lucide-globe"
              class="size-4"
            />
            Semua
          </label>
          <label
            v-for="d in divisions"
            :key="d.id"
            class="flex cursor-pointer items-center gap-1.5 rounded-field border px-3 py-1.5 text-[13px] font-semibold"
            :class="division.includes(d.id) ? 'border-primary-400 bg-primary-100 text-primary-800' : 'border-default text-muted'"
          >
            <input
              type="checkbox"
              class="size-4 accent-primary-600"
              :checked="division.includes(d.id)"
              @change="toggleDiv(d.id)"
            >
            <UIcon
              :name="ikonDivisi(divisions, d.id)"
              class="size-4"
            />
            {{ d.name }}
          </label>
        </div>
        <p class="mt-1 text-[11.5px] text-muted">
          Mengecek "Semua" mengalahkan pilihan divisi lain.
        </p>
      </div>

      <!-- Modul -->
      <UFormField
        v-if="tipe === 'modul'"
        label="Isi Modul (teks bebas, enter untuk paragraf baru)"
      >
        <UTextarea
          v-model="isiModul"
          :rows="12"
          class="w-full"
        />
      </UFormField>

      <!-- Video -->
      <template v-if="tipe === 'video'">
        <UFormField label="URL Video (YouTube, pakai unlisted untuk video internal)">
          <UInput
            v-model="videoUrl"
            placeholder="https://www.youtube.com/watch?v=..."
            class="w-full"
          />
        </UFormField>
        <UFormField label="Deskripsi Singkat">
          <UTextarea
            v-model="videoDesc"
            :rows="3"
            class="w-full"
          />
        </UFormField>
      </template>

      <!-- SOP -->
      <UFormField
        v-if="tipe === 'sop'"
        label="Langkah-langkah SOP (satu langkah per baris)"
      >
        <UTextarea
          v-model="langkah"
          :rows="12"
          placeholder="Langkah 1&#10;Langkah 2&#10;..."
          class="w-full"
        />
      </UFormField>

      <!-- Menu -->
      <template v-if="tipe === 'menu'">
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Nama Menu">
            <UInput
              v-model="menu.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Harga">
            <UInput
              v-model="menu.price"
              placeholder="Rp 48.000"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Kategori Menu">
          <UInput
            v-model="menu.category"
            placeholder="Signature Main Course"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Deskripsi">
          <UTextarea
            v-model="menu.desc"
            :rows="3"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Komposisi / Bahan">
          <UTextarea
            v-model="menu.ingredients"
            :rows="2"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Alergen">
          <UInput
            v-model="menu.allergens"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Selling Script">
          <UTextarea
            v-model="menu.selling"
            :rows="3"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Catatan Operasional">
          <UTextarea
            v-model="menu.notes"
            :rows="2"
            class="w-full"
          />
        </UFormField>
      </template>

      <!-- Quiz -->
      <template v-if="tipe === 'quiz'">
        <UFormField label="Nilai Lulus (%)">
          <UInput
            v-model.number="passing"
            type="number"
            min="1"
            max="100"
            class="w-full"
          />
        </UFormField>
        <div class="space-y-3">
          <div
            v-for="(q, qi) in pertanyaan"
            :key="qi"
            class="rounded-field border border-default p-3"
          >
            <div class="mb-2 flex items-center justify-between gap-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-muted">Soal {{ qi + 1 }}</span>
              <UButton
                label="Hapus"
                color="error"
                variant="ghost"
                size="xs"
                @click="hapusSoal(qi)"
              />
            </div>
            <UInput
              v-model="q.q"
              placeholder="Tulis pertanyaan..."
              class="mb-2 w-full"
            />
            <div
              v-for="(o, oi) in q.opts"
              :key="oi"
              class="mb-1.5 flex items-center gap-2"
            >
              <input
                v-model.number="q.a"
                type="radio"
                :name="`benar-${qi}`"
                :value="oi"
                class="size-4 accent-primary-600"
                aria-label="Jawaban benar"
              >
              <UInput
                v-model="q.opts[oi]"
                :placeholder="`Opsi ${String.fromCharCode(65 + oi)}`"
                class="w-full"
              />
            </div>
            <p class="text-[11px] text-muted">
              Tandai radio di kiri untuk jawaban benar.
            </p>
          </div>
          <p
            v-if="!pertanyaan.length"
            class="rounded-field border border-dashed border-default p-4 text-sm text-muted"
          >
            Belum ada soal. Klik "Tambah Soal".
          </p>
          <UButton
            label="Tambah Soal"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            @click="tambahSoal"
          />
        </div>
      </template>
    </div>

    <template #footer>
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        label="Simpan Materi"
        icon="i-lucide-save"
        @click="simpan"
      />
    </template>
  </ResponsiveSheet>
</template>
