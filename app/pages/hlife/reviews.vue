<!--
  Evaluasi Diri — the old viewReviews (howandi_life/index.html:705-713).
  Weekly scores + month recap. Saving the same week OVERWRITES, it does not add
  a row (F.7, old saveReview `:929`).
-->
<script setup lang="ts">
import type { HlifeReview } from '~/composables/useHlife'
import {
  createHlifeRecord, deleteHlifeRecord, updateHlifeRecord,
  useHlifeResource,
} from '~/composables/useHlife'
import { bulanMinggu, fmtMinggu, kunciMinggu } from '~/utils/hlife'
import { angka } from '~/utils/format'

definePageMeta({ access: ['howandi_life'] })

const toast = useToast()

const { data: reviewData, status, refresh: refreshReview } = useHlifeResource<HlifeReview>('reviews')
const review = computed(() => reviewData.value.rows.slice().sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)))

const tampilan = ref<'weekly' | 'recap'>('weekly')
const TAMPILAN: { value: 'weekly' | 'recap', label: string }[] = [
  { value: 'weekly', label: 'Mingguan' },
  { value: 'recap', label: 'Recap bulanan' },
]

const SKOR: { key: keyof Pick<HlifeReview, 'sContent' | 'sBusiness' | 'sProject' | 'sPersonal'>, label: string }[] = [
  { key: 'sContent', label: 'Konten' },
  { key: 'sBusiness', label: 'Bisnis' },
  { key: 'sProject', label: 'Project' },
  { key: 'sPersonal', label: 'Personal' },
]

/** `recapHtml()` (`:713`): average per month, one decimal. */
const recap = computed(() => {
  const peta = new Map<string, HlifeReview[]>()
  review.value.forEach((r) => {
    const mk = bulanMinggu(r.weekStart)
    peta.set(mk, [...(peta.get(mk) ?? []), r])
  })
  const avg = (a: HlifeReview[], k: keyof Pick<HlifeReview, 'sContent' | 'sBusiness' | 'sProject' | 'sPersonal'>) =>
    Math.round((a.reduce((s, x) => s + ((x[k] as number) || 0), 0) / a.length) * 10) / 10
  return [...peta].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([mk, items]) => ({
    mk,
    items,
    label: new Date(`${mk}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
    avg: (k: typeof SKOR[number]['key']) => avg(items, k),
    wins: items.map(i => i.wins).filter(Boolean),
    improve: items.map(i => i.improve).filter(Boolean),
  }))
})

// --- review sheet (`:925-930`) ----------------------------------------------

const sheet = ref(false)
const sibuk = ref(false)
const hapusSheet = ref(false)
const form = reactive({ id: '', weekStart: '', sContent: 3, sBusiness: 3, sProject: 3, sPersonal: 3, wins: '', improve: '' })

const clamp5 = (v: unknown) => Math.max(1, Math.min(5, Number(v) || 3))

function buka(r?: HlifeReview) {
  if (r) {
    Object.assign(form, { id: r.id, weekStart: r.weekStart, sContent: r.sContent, sBusiness: r.sBusiness, sProject: r.sProject, sPersonal: r.sPersonal, wins: r.wins || '', improve: r.improve || '' })
  }
  else {
    const wk = kunciMinggu(new Date())
    const ada = review.value.find(x => x.weekStart === wk)
    Object.assign(form, ada
      ? { id: ada.id, weekStart: ada.weekStart, sContent: ada.sContent, sBusiness: ada.sBusiness, sProject: ada.sProject, sPersonal: ada.sPersonal, wins: ada.wins || '', improve: ada.improve || '' }
      : { id: '', weekStart: wk, sContent: 3, sBusiness: 3, sProject: 3, sPersonal: 3, wins: '', improve: '' })
  }
  sheet.value = true
}

function muatUlang() {
  return refreshReview()
}

async function simpan() {
  if (!form.weekStart) {
    toast.add({ title: 'Pilih minggu dulu.', color: 'error' })
    return
  }
  const weekStart = kunciMinggu(form.weekStart)
  const body = {
    weekStart,
    sContent: clamp5(form.sContent),
    sBusiness: clamp5(form.sBusiness),
    sProject: clamp5(form.sProject),
    sPersonal: clamp5(form.sPersonal),
    wins: form.wins,
    improve: form.improve,
  }
  // Same week overwrites: edit the existing row when there is one (`:929`).
  const targetId = form.id || review.value.find(r => r.weekStart === weekStart)?.id || ''
  sibuk.value = true
  try {
    if (targetId) {
      const versi = reviewData.value.versions[targetId]
      if (versi === undefined) {
        toast.add({ title: 'Versi evaluasi belum terbaca. Muat ulang halaman.', color: 'error' })
        return
      }
      await updateHlifeRecord('reviews', targetId, { ...body, id: targetId }, versi)
    }
    else {
      await createHlifeRecord<HlifeReview>('reviews', body)
    }
    await refreshReview()
    sheet.value = false
    toast.add({ title: 'Evaluasi tersimpan.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

async function hapus() {
  if (!form.id) return
  const versi = reviewData.value.versions[form.id]
  hapusSheet.value = false
  if (versi === undefined) {
    toast.add({ title: 'Versi evaluasi belum terbaca. Muat ulang halaman.', color: 'error' })
    return
  }
  sibuk.value = true
  try {
    await deleteHlifeRecord('reviews', form.id, versi)
    await refreshReview()
    sheet.value = false
    toast.add({ title: 'Evaluasi dihapus.', color: 'success' })
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

function tanyaHapus(r: HlifeReview) {
  form.id = r.id
  form.weekStart = r.weekStart
  hapusSheet.value = true
}
</script>

<template>
  <AppPage
    title="Evaluasi Diri"
    description="Review tiap minggu — recap otomatis per bulan."
  >
    <template #actions>
      <div class="flex flex-wrap items-center gap-2">
        <AppSeg
          v-model="tampilan"
          :options="TAMPILAN"
          size="sm"
        />
        <UButton
          label="Evaluasi minggu ini"
          icon="i-lucide-plus"
          @click="buka()"
        />
      </div>
    </template>

    <div
      v-if="status === 'pending' && !review.length"
      class="mb-4 space-y-2"
    >
      <!-- Loading cards mirror the review panels below. -->
      <div class="grid gap-5 lg:grid-cols-2">
        <USkeleton
          v-for="i in 2"
          :key="i"
          class="h-28 rounded-panel"
        />
      </div>
      <p class="pt-1 text-sm text-muted">
        Memuat evaluasi…
      </p>
    </div>

    <!-- Weekly -->
    <div
      v-if="tampilan === 'weekly'"
      class="grid gap-5 lg:grid-cols-2"
    >
      <AppPanel
        v-for="r in review"
        :key="r.id"
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="font-display text-base font-semibold text-highlighted">
            Minggu {{ fmtMinggu(r.weekStart) }}
          </h3>
          <div class="flex shrink-0 gap-1">
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Edit evaluasi"
              @click="buka(r)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Hapus evaluasi"
              @click="tanyaHapus(r)"
            />
          </div>
        </div>
        <div class="mt-3">
          <AppBar
            v-for="s in SKOR"
            :key="s.key"
            :label="s.label"
            :value="`${r[s.key]}/5`"
            :persen="(r[s.key] / 5) * 100"
            :tone="r[s.key] >= 4 ? 'success' : 'gold'"
          />
        </div>
        <div
          v-if="r.wins"
          class="mt-2"
        >
          <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
            Yang berhasil
          </p>
          <p class="text-sm text-muted">
            {{ r.wins }}
          </p>
        </div>
        <div
          v-if="r.improve"
          class="mt-2"
        >
          <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
            Perbaiki
          </p>
          <p class="text-sm text-muted">
            {{ r.improve }}
          </p>
        </div>
      </AppPanel>
    </div>

    <!-- Recap -->
    <div
      v-else
      class="grid gap-5 lg:grid-cols-2"
    >
      <AppPanel
        v-for="m in recap"
        :key="m.mk"
        :count="`${m.items.length} minggu`"
        :title="m.label"
      >
        <AppBar
          v-for="s in SKOR"
          :key="s.key"
          :label="s.label"
          :value="`${m.avg(s.key)}/5`"
          :persen="(m.avg(s.key) / 5) * 100"
          :tone="m.avg(s.key) >= 4 ? 'success' : 'gold'"
        />
        <div class="mt-2">
          <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
            Highlight bulan
          </p>
          <ul class="text-sm text-muted">
            <li
              v-for="(w, i) in m.wins"
              :key="`w-${i}`"
            >
              • {{ w }}
            </li>
            <li v-if="!m.wins.length">
              —
            </li>
          </ul>
        </div>
        <div class="mt-2">
          <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
            Fokus perbaikan
          </p>
          <ul class="text-sm text-muted">
            <li
              v-for="(w, i) in m.improve"
              :key="`i-${i}`"
            >
              • {{ w }}
            </li>
            <li v-if="!m.improve.length">
              —
            </li>
          </ul>
        </div>
      </AppPanel>
    </div>

    <p
      v-if="!review.length && status !== 'pending'"
      class="rounded-panel border border-dashed border-default bg-default px-6 py-10 text-center text-muted shadow-panel"
    >
      Belum ada evaluasi mingguan. Mulai review minggu ini untuk membangun track record.
    </p>

    <p
      v-if="tampilan === 'recap' && recap.length"
      class="text-xs text-muted"
    >
      {{ angka(review.length) }} minggu dalam {{ recap.length }} bulan.
    </p>

    <!-- Review form -->
    <ResponsiveSheet
      v-model:open="sheet"
      :title="form.id ? 'Edit evaluasi' : 'Evaluasi mingguan'"
    >
      <div class="space-y-4">
        <UFormField
          label="Minggu (pilih tanggal mana saja di minggu itu)"
          help="Otomatis dikelompokkan per minggu (Senin–Minggu) dan di-recap per bulan."
        >
          <UInput
            v-model="form.weekStart"
            type="date"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Skor konten (1–5)">
            <UInput
              v-model.number="form.sContent"
              type="number"
              min="1"
              max="5"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Skor bisnis (1–5)">
            <UInput
              v-model.number="form.sBusiness"
              type="number"
              min="1"
              max="5"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Skor project (1–5)">
            <UInput
              v-model.number="form.sProject"
              type="number"
              min="1"
              max="5"
              size="xl"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Skor personal (1–5)">
            <UInput
              v-model.number="form.sPersonal"
              type="number"
              min="1"
              max="5"
              size="xl"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Yang berhasil minggu ini">
          <UTextarea
            v-model="form.wins"
            :rows="3"
            placeholder="Pencapaian, hal yang jalan…"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Yang perlu diperbaiki">
          <UTextarea
            v-model="form.improve"
            :rows="3"
            placeholder="Perbaikan untuk minggu depan…"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          :label="form.id ? 'Simpan' : 'Tambah'"
          size="xl"
          :loading="sibuk"
          @click="simpan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="sheet = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="hapusSheet"
      title="Hapus evaluasi?"
      :description="form.weekStart ? `Minggu ${fmtMinggu(form.weekStart)}` : undefined"
    >
      <p class="text-sm text-muted">
        Evaluasi minggu ini akan dihapus permanen.
      </p>
      <template #footer>
        <UButton
          label="Hapus"
          color="error"
          size="xl"
          :loading="sibuk"
          @click="hapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          size="xl"
          @click="hapusSheet = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
