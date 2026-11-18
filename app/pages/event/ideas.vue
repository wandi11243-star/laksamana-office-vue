<!--
  Event Idea Bank — hidden route (`#/ideas` kept, not in the menu): idea grid
  with ROI, evaluations and "make event" prefill (`event/index.html:11119-11189`).
-->
<script setup lang="ts">
import type { EvaluasiIde, Ide } from '~/composables/useEvent'
import { createEvent, patchEvent, removeEvent, useDaftarEvent } from '~/composables/useEvent'
import { FREQS, IDEA_CATS, roiIde } from '~/utils/event-hitung'
import { apiErrorMessage } from '~/composables/useApi'
import { bolehUbahEvent, peranEvent } from '~/utils/layar/event'
import { hariIni, rupiah } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['event'] })

const toast = useToast()
const me = useMe()
const bolehUbah = computed(() => bolehUbahEvent('ideas', peranEvent(me.value)))

const fKategori = ref('semua')
const fFrekuensi = ref('semua')
const { data: daftar, status, refresh } = useDaftarEvent<Ide>('ideas', {}, 'event-ideas')

const list = computed(() => daftar.value.rows.filter((i) => {
  if (fKategori.value !== 'semua' && i.category !== fKategori.value) return false
  if (fFrekuensi.value !== 'semua' && i.frequency !== fFrekuensi.value) return false
  return true
}))

// --- idea form (`ideaForm :11137`) ---
const sheet = ref(false)
const ideId = ref('')
const fi = ref({ name: '', category: IDEA_CATS[0] as string, target_market: '', frequency: FREQS[0] as string, budget: 10000000, potential_revenue: 20000000, difficulty: 'Medium', description: '' })
function bukaBaru() {
  ideId.value = ''
  fi.value = { name: '', category: IDEA_CATS[0]!, target_market: '', frequency: FREQS[0]!, budget: 10000000, potential_revenue: 20000000, difficulty: 'Medium', description: '' }
  sheet.value = true
}
async function simpan() {
  if (!fi.value.name.trim()) {
    toast.add({ title: 'Nama wajib.', color: 'error' })
    return
  }
  sheet.value = false
  try {
    if (ideId.value) {
      const lama = daftar.value.rows.find(i => i.id === ideId.value)
      await patchEvent('ideas', ideId.value, { ...fi.value, name: fi.value.name.trim(), updatedAt: Date.now() }, daftar.value.versions[ideId.value])
      void lama
    }
    else {
      await createEvent('ideas', { ...fi.value, name: fi.value.name.trim(), ever_executed: false, evaluations: [], createdAt: Date.now(), updatedAt: Date.now() })
    }
    toast.add({ title: 'Ide disimpan', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
const hapusId = ref('')
const sheetHapus = computed({ get: () => hapusId.value !== '', set: v => (hapusId.value = v ? hapusId.value : '') })
async function hapus() {
  const id = hapusId.value
  sheetHapus.value = false
  if (!id) return
  try {
    await removeEvent('ideas', id, daftar.value.versions[id])
    toast.add({ title: 'Ide dihapus', color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}

// --- spawn event (`spawnEvent :11189`, prefill) ---
const dariIde = useState<Record<string, unknown> | null>('event-dari-ide', () => null)
async function buatEvent(ide: Ide) {
  dariIde.value = {
    idea_id: ide.id,
    title: ide.name,
    category: ide.category === 'Music' ? 'Music' : ide.category === 'Festival' ? 'Festival' : 'Community',
    capacity: 100,
    theme: '',
    venue: '',
    description: String(ide.description ?? ''),
  }
  toast.add({ title: 'Lengkapi tanggal & venue-nya, lalu Simpan.', color: 'info' })
  await navigateTo('/event/planning?baru=1')
}

// --- evaluation (`evalIdea :11155`, `simpanEval :11171`) ---
const evalId = ref('')
const sheetEval = computed({ get: () => evalId.value !== '', set: v => (evalId.value = v ? evalId.value : '') })
const ideEval = computed(() => daftar.value.rows.find(i => i.id === evalId.value) ?? null)
const fe = ref({ date: hariIni(), omzet: 0, hadir: 0, biaya: 0, skor: 7, ulang: 'Ya', baik: '', perbaiki: '' })
function bukaEval(ide: Ide) {
  fe.value = { date: hariIni(), omzet: 0, hadir: 0, biaya: Number(ide.budget) || 0, skor: 7, ulang: 'Ya', baik: '', perbaiki: '' }
  evalId.value = ide.id
}
async function simpanEval() {
  const ide = ideEval.value
  if (!ide) return
  if (Number(fe.value.skor) < 1 || Number(fe.value.skor) > 10) {
    toast.add({ title: 'Skor harus 1–10.', color: 'error' })
    return
  }
  const omzet = Number(fe.value.omzet) || 0
  const biaya = Number(fe.value.biaya) || 0
  const plus = fe.value.baik.trim()
  const minus = fe.value.perbaiki.trim()
  const ev: EvaluasiIde = {
    executed: 'Ya',
    tanggal: fe.value.date,
    omzet,
    biaya,
    profit: omzet - biaya,
    attendance: Number(fe.value.hadir) || 0,
    score: Number(fe.value.skor),
    ulang: fe.value.ulang,
    plus,
    minus,
    feedback: [plus, minus].filter(Boolean).join(' | '),
    at: new Date().toISOString(),
  }
  sheetEval.value = false
  try {
    await patchEvent('ideas', ide.id, { evaluations: [...(ide.evaluations ?? []), ev], ever_executed: true, updatedAt: Date.now() }, daftar.value.versions[ide.id])
    toast.add({ title: `✓ Evaluasi tersimpan — profit ${rupiah(ev.profit)}.`, color: 'success' })
    await refresh()
  }
  catch (e) {
    if (!(await tanganiKonflik(e, refresh))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <EventGerbang lihat="planning">
    <AppPage
      title="Event idea bank"
      description="Database ide event + evaluasi"
      :back="{ label: 'Perencanaan', to: '/event/planning' }"
    >
      <template #actions>
        <UButton
          v-if="bolehUbah"
          color="primary"
          icon="i-lucide-plus"
          @click="bukaBaru()"
        >
          Ide baru
        </UButton>
      </template>

      <AppPanel class="mb-4">
        <AppFilterGrid>
          <UFormField label="Kategori">
            <USelect
              v-model="fKategori"
              :items="[{ value: 'semua', label: 'Semua kategori' }, ...IDEA_CATS.map(c => ({ value: c, label: c }))]"
            />
          </UFormField>
          <UFormField label="Frekuensi">
            <USelect
              v-model="fFrekuensi"
              :items="[{ value: 'semua', label: 'Semua frekuensi' }, ...FREQS.map(f => ({ value: f, label: f }))]"
            />
          </UFormField>
        </AppFilterGrid>
      </AppPanel>

      <div
        v-if="status === 'pending'"
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <USkeleton
          v-for="i in 3"
          :key="i"
          class="h-44"
        />
      </div>
      <div
        v-else
        class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <AppPanel
          v-for="i in list"
          :key="i.id"
        >
          <div class="flex items-start justify-between gap-2">
            <b class="text-base text-highlighted">{{ i.name }}</b>
            <AppStatus
              color="info"
              size="sm"
            >
              {{ i.category }}
            </AppStatus>
          </div>
          <p class="my-1.5 text-xs text-muted">
            {{ i.description }}
          </p>
          <dl class="grid grid-cols-[7rem_1fr] gap-x-2 gap-y-0.5 text-xs">
            <dt class="text-muted">
              Target
            </dt>
            <dd>{{ i.target_market || '—' }}</dd>
            <dt class="text-muted">
              Budget
            </dt>
            <dd class="num">
              {{ rupiah(Number(i.budget) || 0) }}
            </dd>
            <dt class="text-muted">
              Potensi
            </dt>
            <dd class="num">
              {{ rupiah(Number(i.potential_revenue) || 0) }} <span class="text-muted">(ROI ~{{ roiIde(Number(i.budget) || 0, Number(i.potential_revenue) || 0) }}%)</span>
            </dd>
            <dt class="text-muted">
              Frekuensi
            </dt>
            <dd>{{ i.frequency }}</dd>
            <dt class="text-muted">
              Tingkat kesulitan
            </dt>
            <dd>
              <AppStatus
                :color="i.difficulty === 'Easy' ? 'success' : i.difficulty === 'Hard' ? 'error' : 'warning'"
                size="sm"
              >
                {{ i.difficulty }}
              </AppStatus>
            </dd>
          </dl>
          <p
            v-if="(i.evaluations ?? [])[0]"
            class="mt-1.5 text-xs text-success"
          >
            ✓ Pernah dibuat — omzet {{ rupiah(Number(i.evaluations[0]!.omzet) || 0) }}, {{ i.evaluations[0]!.attendance }} hadir, skor {{ i.evaluations[0]!.score }}/10
          </p>
          <p
            v-else
            class="mt-1.5 text-xs text-muted"
          >
            Belum pernah dieksekusi
          </p>
          <div
            v-if="bolehUbah"
            class="mt-2.5 flex flex-wrap gap-1.5"
          >
            <UButton
              color="primary"
              variant="outline"
              size="sm"
              icon="i-lucide-arrow-right"
              loading-auto
              @click="buatEvent(i)"
            >
              Buat event
            </UButton>
            <UButton
              v-if="!(i.evaluations ?? []).length"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-plus"
              @click="bukaEval(i)"
            >
              Evaluasi
            </UButton>
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-trash-2"
              @click="hapusId = i.id"
            />
          </div>
        </AppPanel>
      </div>
      <p
        v-if="!list.length && status !== 'pending'"
        class="py-10 text-center text-sm text-dimmed"
      >
        Tidak ada ide.
      </p>

      <ResponsiveSheet
        v-model:open="sheet"
        :title="ideId ? 'Edit ide' : 'Ide baru'"
      >
        <div class="grid gap-3 lg:grid-cols-2">
          <UFormField
            label="Nama"
            required
            class="lg:col-span-2"
          >
            <UInput
              v-model="fi.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Kategori">
            <USelect
              v-model="fi.category"
              :items="IDEA_CATS.map(c => ({ value: c, label: c }))"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Frekuensi">
            <USelect
              v-model="fi.frequency"
              :items="FREQS.map(f => ({ value: f, label: f }))"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Target market">
            <UInput
              v-model="fi.target_market"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Difficulty">
            <USelect
              v-model="fi.difficulty"
              :items="['Easy', 'Medium', 'Hard'].map(d => ({ value: d, label: d }))"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Budget">
            <UInput
              v-model.number="fi.budget"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Potensi uang masuk">
            <UInput
              v-model.number="fi.potential_revenue"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Deskripsi"
            class="lg:col-span-2"
          >
            <UTextarea
              v-model="fi.description"
              class="w-full"
            />
          </UFormField>
        </div>
        <template #footer>
          <UButton
            color="primary"
            loading-auto
            @click="simpan()"
          >
            Simpan ide
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheet = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetEval"
        :title="`Evaluasi ${ideEval?.name ?? ''}`"
      >
        <div class="grid gap-3 lg:grid-cols-2">
          <UFormField label="Tanggal pelaksanaan">
            <AppTanggal
              v-model="fe.date"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Omzet">
            <UInput
              v-model.number="fe.omzet"
              type="number"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Jumlah hadir">
            <UInput
              v-model.number="fe.hadir"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Biaya aktual">
            <UInput
              v-model.number="fe.biaya"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Skor keseluruhan (1–10)">
            <UInput
              v-model.number="fe.skor"
              type="number"
              min="1"
              max="10"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Layak diulang?">
            <USelect
              v-model="fe.ulang"
              :items="['Ya', 'Perlu perbaikan', 'Tidak'].map(u => ({ value: u, label: u }))"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Yang berjalan baik">
            <UTextarea
              v-model="fe.baik"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Yang perlu diperbaiki">
            <UTextarea
              v-model="fe.perbaiki"
              class="w-full"
            />
          </UFormField>
        </div>
        <p class="mt-2 text-sm text-muted num">
          Profit: {{ rupiah(fe.omzet - fe.biaya) }}
        </p>
        <template #footer>
          <UButton
            color="primary"
            loading-auto
            @click="simpanEval()"
          >
            Simpan evaluasi
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetEval = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>

      <ResponsiveSheet
        v-model:open="sheetHapus"
        title="Hapus ide?"
      >
        <p class="text-sm text-muted">
          Ide ini dihapus permanen.
        </p>
        <template #footer>
          <UButton
            color="error"
            loading-auto
            @click="hapus()"
          >
            Ya, hapus
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            @click="sheetHapus = false"
          >
            Batal
          </UButton>
        </template>
      </ResponsiveSheet>
    </AppPage>
  </EventGerbang>
</template>
