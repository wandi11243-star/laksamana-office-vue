<!--
  HR › Engagement (deploy/hr/index.html RENDER.engage :2310-2358).

  Mood check per day (one per person) and the suggestion box, which may be
  anonymous (`empId: null`, D.20). The 14-day trend HIDES days with fewer than
  MOOD_MIN_N check-ins — an average of one person is that person (F.18).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { HrSuggestion } from '~/utils/hr'
import { canHr, MOOD_MIN_N } from '~/utils/hr'
import { rataRata } from '~/utils/people-score'
import { hrCreate, hrPostAudit, hrUpdate, useHrDasar } from '~/composables/useHr'
import { fTglP, hariIni, tambahHari } from '~/utils/format'

definePageMeta({ access: ['hr'] })

const toast = useToast()
const { s, cu, officeAdmin, error, refresh } = useHrDasar()
const bisaLihatSemua = computed(() => canHr('seeAll', cu.value, officeAdmin.value))

const hariIniStr = hariIni()
const myMood = computed(() => s.value.moods.find(m => m.empId === cu.value?.id && m.date === hariIniStr))
const MOOD_IKON: Record<number, string> = { 1: 'i-lucide-angry', 2: 'i-lucide-frown', 3: 'i-lucide-meh', 4: 'i-lucide-smile', 5: 'i-lucide-laugh' }
const MOOD_LABEL: Record<number, string> = { 1: 'Sangat tidak nyaman', 2: 'Kurang nyaman', 3: 'Biasa saja', 4: 'Nyaman', 5: 'Sangat nyaman' }

async function setMood(v: number) {
  if (!cu.value) return
  try {
    const ada = myMood.value
    if (ada) await hrUpdate('moods', ada.id, { ...ada, mood: v })
    else await hrCreate('moods', { empId: cu.value.id, date: hariIniStr, mood: v })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan mood: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

const tren = computed(() => Array.from({ length: 14 }, (_, i) => {
  const d = tambahHari(hariIniStr, i - 13)
  const ms = s.value.moods.filter(m => m.date === d)
  return ms.length >= MOOD_MIN_N ? rataRata(ms.map(m => Number(m.mood)).filter(Number.isFinite)) : null
}))
const moodBulan = computed(() => s.value.moods.filter(m => m.date.slice(0, 7) === hariIniStr.slice(0, 7)))
const rataBulan = computed(() => (moodBulan.value.length >= MOOD_MIN_N
  ? rataRata(moodBulan.value.map(m => Number(m.mood)).filter(Number.isFinite))
  : null))

// Suggestion box
const teks = ref('')
const anon = ref(false)
const kirim = ref(false)
async function kirimSaran() {
  const txt = teks.value.trim()
  if (!txt) return toast.add({ title: 'Tulis dulu sarannya.', color: 'error' })
  if (!cu.value) return
  try {
    await hrCreate('suggestions', {
      empId: anon.value ? null : cu.value.id,
      date: hariIniStr,
      text: txt,
      status: 'Baru',
      response: '',
    })
    try {
      await hrPostAudit('SUGGESTION', '')
    }
    catch {
      // Audit is a bonus.
    }
    teks.value = ''
    anon.value = false
    toast.add({ title: 'Saran terkirim. Terima kasih!', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal mengirim: ${apiErrorMessage(e)}`, color: 'error' })
  }
}

const saran = computed(() => s.value.suggestions.slice().sort((a, b) => b.date.localeCompare(a.date)))
const nama = (id: string | null) => (id ? s.value.employees.find(e => e.id === id)?.name ?? '-' : null)
const kolom: TableColumn<HrSuggestion>[] = [
  { id: 'tgl', header: 'Tanggal' },
  { id: 'dari', header: 'Dari' },
  { id: 'saran', header: 'Saran' },
  { id: 'status', header: 'Status' },
  { id: 'respon', header: 'Respon' },
  { id: 'aksi', header: () => h('span', { class: 'block text-end' }, '') },
]
const responOpen = ref(false)
const pilihSg = ref<HrSuggestion | null>(null)
function bukaRespon(x: HrSuggestion) {
  pilihSg.value = x
  responOpen.value = true
}
async function sesudah() {
  await refresh()
}
const nadaStatus = (x: string): 'success' | 'info' | 'neutral' => (x === 'Diterapkan' ? 'success' : x === 'Ditinjau' ? 'info' : 'neutral')
</script>

<template>
  <AppPage
    title="Engagement"
    description="Mood tim & kotak saran."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <div class="grid gap-0 lg:grid-cols-2 lg:gap-5">
      <AppPanel
        title="Mood check hari ini"
        icon="i-lucide-smile"
      >
        <p class="mb-3 text-sm text-muted">
          Bagaimana perasaanmu hari ini? Jawaban ini tercatat atas nama Anda dan bisa dilihat HRD. Sesama kru tidak
          bisa melihatnya. Kalau ingin menyampaikan sesuatu tanpa nama, pakai Kotak Saran di bawah dengan centang
          anonim.
        </p>
        <div class="flex flex-wrap justify-center gap-2">
          <button
            v-for="m in [1, 2, 3, 4, 5]"
            :key="m"
            type="button"
            class="flex min-h-12 min-w-12 flex-col items-center justify-center rounded-field border-2 px-2 py-1"
            :class="myMood?.mood === m ? 'border-primary-400 bg-primary-100 text-primary-700' : 'border-default bg-muted text-muted hover:border-accented'"
            :title="MOOD_LABEL[m]"
            @click="setMood(m)"
          >
            <UIcon
              :name="MOOD_IKON[m] ?? 'i-lucide-meh'"
              class="size-5"
            />
          </button>
        </div>
        <p
          v-if="myMood"
          class="mt-3 text-center text-sm text-success"
        >
          Tercatat. Terima kasih!
        </p>
      </AppPanel>

      <AppPanel
        title="Tren mood tim (14 hari)"
        icon="i-lucide-activity"
      >
        <HrTren
          :values="tren"
          :width="300"
          :height="60"
        />
        <p class="mt-2 text-sm text-muted">
          {{ moodBulan.length }} check-in bulan ini<template v-if="rataBulan != null">
            , rata-rata
            {{ Math.round(rataBulan * 10) / 10 }} / 5
          </template>.<br>
          Hari dengan kurang dari {{ MOOD_MIN_N }} check-in tidak ditampilkan, supaya mood satu orang tidak terbaca
          dari grafik.
        </p>
      </AppPanel>
    </div>

    <AppPanel
      title="Kotak saran"
      icon="i-lucide-message-square-plus"
      description="Boleh anonim. Budaya hidup kalau suara kru didengar."
    >
      <div class="space-y-2">
        <UTextarea
          v-model="teks"
          :rows="2"
          placeholder="Tulis saran / ide / keluhan…"
          class="w-full"
        />
        <div class="flex flex-wrap items-center justify-between gap-2">
          <UCheckbox
            v-model="anon"
            label="Kirim anonim"
          />
          <UButton
            label="Kirim"
            :loading="kirim"
            @click="kirimSaran"
          />
        </div>
      </div>
    </AppPanel>

    <AppPanel
      title="Saran masuk"
      icon="i-lucide-inbox"
      :count="saran.length"
      flush
    >
      <UTable
        class="hidden lg:block"
        :data="saran"
        :columns="kolom"
        empty="Belum ada saran masuk."
      >
        <template #tgl-cell="{ row }">
          <span class="text-muted num">{{ fTglP(row.original.date) }}</span>
        </template>
        <template #dari-cell="{ row }">
          <span
            v-if="nama(row.original.empId)"
            class="text-sm"
          >{{ nama(row.original.empId) }}</span>
          <i
            v-else
            class="text-sm text-muted"
          >Anonim</i>
        </template>
        <template #saran-cell="{ row }">
          <span class="line-clamp-3 max-w-96 whitespace-normal">{{ row.original.text }}</span>
        </template>
        <template #status-cell="{ row }">
          <AppStatus
            :color="nadaStatus(row.original.status || 'Baru')"
            size="sm"
          >
            {{ row.original.status || 'Baru' }}
          </AppStatus>
        </template>
        <template #respon-cell="{ row }">
          <span class="text-sm text-muted">{{ row.original.response || '' }}</span>
        </template>
        <template #aksi-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              v-if="bisaLihatSemua"
              label="Respon"
              color="neutral"
              variant="outline"
              size="xs"
              @click="bukaRespon(row.original)"
            />
          </div>
        </template>
      </UTable>

      <div class="divide-y divide-default lg:hidden">
        <article
          v-for="x in saran"
          :key="x.id"
          class="space-y-2 px-4 py-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-highlighted">
                {{ nama(x.empId) ?? 'Anonim' }}
              </p>
              <p class="text-sm text-muted num">
                {{ fTglP(x.date) }}
              </p>
            </div>
            <AppStatus
              :color="nadaStatus(x.status || 'Baru')"
              size="sm"
            >
              {{ x.status || 'Baru' }}
            </AppStatus>
          </div>
          <p class="rounded-field bg-muted px-3 py-2 text-sm">
            {{ x.text }}
          </p>
          <p
            v-if="x.response"
            class="text-sm text-muted"
          >
            Respon: {{ x.response }}
          </p>
          <UButton
            v-if="bisaLihatSemua"
            label="Respon"
            color="neutral"
            variant="outline"
            size="xs"
            @click="bukaRespon(x)"
          />
        </article>
        <p
          v-if="!saran.length"
          class="px-4 py-8 text-center text-muted"
        >
          Belum ada saran masuk.
        </p>
      </div>
    </AppPanel>

    <HrSaranRespon
      v-model:open="responOpen"
      :sg="pilihSg"
      @saved="sesudah"
    />
  </AppPage>
</template>
