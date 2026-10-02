<!--
  The quiz sheet (old renderQuizIntro/startQuiz/submitQuiz,
  deploy/akademi/index.html:1066-1131): intro, answering, then the result with a
  full answer review. A program item that was already passed is still a
  "Refresher" and must be redone (`:1069`). In Mode Baca the quiz runs as
  practice and the score is never stored (`:1074-1075`).
-->
<script setup lang="ts">
import type { JawabanKuis, MateriAkademi, ProgresEntry } from '~/composables/useAkademi'

const props = defineProps<{
  materi: MateriAkademi | null
  dalamLingkup: boolean
  selesai: boolean
  dariProgram: boolean
  entry: ProgresEntry | null
  passingDefault: number
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ simpan: [jawaban: JawabanKuis] }>()
const toast = useToast()

const mode = ref<'intro' | 'kerja' | 'hasil'>('intro')
const jawaban = ref<(number | null)[]>([])
const hasil = ref<{ skor: number, benar: number, total: number, lulus: boolean, latihan: boolean } | null>(null)

const soal = computed(() => props.materi?.questions ?? [])
const passing = computed(() => Number(props.materi?.passing) || props.passingDefault)
const percobaan = computed(() => Number(props.entry?.attempts) || 0)
const skorTerakhir = computed(() => (typeof props.entry?.score === 'number' ? props.entry.score : null))
const pernahLulus = computed(() => props.entry?.passed === true)
/** In a program context the item's own cell decides; the refresher badge needs both. */
const perluRefresher = computed(() => props.dariProgram && !props.selesai && pernahLulus.value)

watch(() => props.materi?.id, () => {
  mode.value = 'intro'
  hasil.value = null
  jawaban.value = []
})

watch(open, (v) => {
  if (v) {
    mode.value = 'intro'
    hasil.value = null
  }
})

const latihanRef = ref(false)

function mulai(latihan: boolean) {
  jawaban.value = new Array(soal.value.length).fill(null)
  hasil.value = null
  mode.value = 'kerja'
  latihanRef.value = latihan
}

function kumpulkan() {
  if (jawaban.value.some(a => a === null)) {
    toast.add({ title: 'Masih ada soal yang belum dijawab', color: 'error' })
    return
  }
  const total = soal.value.length
  let benar = 0
  soal.value.forEach((q, i) => {
    if (jawaban.value[i] === q.a) benar++
  })
  const skor = total ? Math.round(benar / total * 100) : 0
  const lulus = skor >= passing.value
  const latihan = latihanRef.value || !props.dalamLingkup
  hasil.value = { skor, benar, total, lulus, latihan }

  if (!latihan) {
    const prev = props.entry ?? {}
    const entry: ProgresEntry = {
      attempts: percobaan.value + 1,
      score: skor,
      // Once passed, always passed (old `passed || p.passed===true`, :1113).
      passed: lulus || prev.passed === true,
      lastAt: Date.now(),
      completedAt: lulus ? Date.now() : (prev.completedAt ?? null),
    }
    emit('simpan', { entry, lulus, latihan: false, skor })
  }
  mode.value = 'hasil'
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="materi?.title ?? 'Kuis'"
  >
    <div
      v-if="materi"
      class="space-y-3"
    >
      <AppStatus
        v-if="perluRefresher"
        color="info"
        icon="i-lucide-repeat"
      >
        Refresher program bulan ini, kerjakan ulang meski dulu sudah lulus
      </AppStatus>

      <!-- Intro -->
      <template v-if="mode === 'intro'">
        <div class="rounded-field border border-default p-4">
          <div class="grid grid-cols-[130px_1fr] gap-y-2 text-sm">
            <div class="text-[11px] font-bold uppercase tracking-wider text-muted">
              Jumlah soal
            </div>
            <div>{{ soal.length }} pertanyaan pilihan ganda</div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-muted">
              Nilai lulus
            </div>
            <div>{{ passing }}%</div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-muted">
              Percobaan
            </div>
            <div>
              {{ percobaan }}x
              <span v-if="skorTerakhir != null">· skor terakhir <b>{{ skorTerakhir }}%</b> {{ pernahLulus ? 'LULUS' : 'belum lulus' }}</span>
            </div>
          </div>
        </div>
        <UButton
          v-if="!dalamLingkup"
          label="Coba Kuis (Mode Latihan, skor tidak disimpan)"
          icon="i-lucide-target"
          color="neutral"
          variant="outline"
          block
          @click="mulai(true)"
        />
        <UButton
          v-else
          :label="percobaan ? 'Ulangi Kuis' : 'Mulai Kuis'"
          :icon="percobaan ? 'i-lucide-repeat' : 'i-lucide-play'"
          block
          @click="mulai(false)"
        />
      </template>

      <!-- Answering -->
      <template v-else-if="mode === 'kerja'">
        <div
          v-for="(q, qi) in soal"
          :key="qi"
          class="rounded-field border border-default p-3"
        >
          <p class="mb-2 font-semibold text-highlighted">
            {{ qi + 1 }}. {{ q.q }}
          </p>
          <label
            v-for="(o, oi) in q.opts"
            :key="oi"
            class="mb-1.5 flex cursor-pointer items-center gap-2 rounded-field border p-2.5 text-sm"
            :class="jawaban[qi] === oi ? 'border-primary-400 bg-primary-100' : 'border-default'"
          >
            <input
              v-model="jawaban[qi]"
              type="radio"
              :name="`kuis-${materi.id}-${qi}`"
              :value="oi"
              class="size-4 accent-primary-600"
            >
            {{ o }}
          </label>
        </div>
        <UButton
          label="Kumpulkan Jawaban"
          icon="i-lucide-send"
          block
          @click="kumpulkan"
        />
      </template>

      <!-- Result -->
      <template v-else-if="hasil">
        <div class="rounded-field border border-default bg-muted p-4 text-center">
          <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
            {{ hasil.latihan ? 'Hasil Latihan' : (hasil.lulus ? 'Lulus' : 'Belum lulus') }}
          </p>
          <p class="font-display text-4xl font-bold text-highlighted num">
            {{ hasil.skor }}%
          </p>
          <p class="text-[13px] text-muted">
            {{ hasil.benar }} dari {{ hasil.total }} benar, nilai lulus {{ passing }}%
          </p>
          <div class="mt-2 flex justify-center">
            <AppStatus
              v-if="hasil.latihan"
              color="info"
              icon="i-lucide-flask-conical"
            >
              Mode Latihan, skor tidak disimpan
            </AppStatus>
            <AppStatus
              v-else-if="hasil.lulus"
              color="success"
              icon="i-lucide-circle-check"
            >
              LULUS, standar tercapai
            </AppStatus>
            <AppStatus
              v-else
              color="warning"
              icon="i-lucide-brain"
            >
              Pelajari lagi materinya, lalu ulangi. Kamu pasti bisa.
            </AppStatus>
          </div>
        </div>
        <div>
          <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            Review jawaban
          </p>
          <div
            v-for="(q, qi) in soal"
            :key="qi"
            class="mb-2 rounded-field border border-default p-3"
          >
            <p class="mb-1.5 flex items-start gap-2 font-semibold text-highlighted">
              <span class="flex-1">{{ qi + 1 }}. {{ q.q }}</span>
              <UIcon
                :name="jawaban[qi] === q.a ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
                :class="jawaban[qi] === q.a ? 'text-success' : 'text-error'"
                class="mt-0.5 size-4 shrink-0"
              />
            </p>
            <div
              v-for="(o, oi) in q.opts"
              :key="oi"
              class="rounded-field px-2 py-1 text-sm"
              :class="oi === q.a ? 'bg-success/10 text-success' : (oi === jawaban[qi] ? 'bg-error/10 text-error' : 'text-muted')"
            >
              {{ o }}
              <b
                v-if="oi === q.a"
                class="ms-1 text-[11px]"
              >JAWABAN BENAR</b>
            </div>
          </div>
        </div>
        <UButton
          label="Selesai"
          color="neutral"
          block
          @click="open = false"
        />
      </template>
    </div>
  </ResponsiveSheet>
</template>
