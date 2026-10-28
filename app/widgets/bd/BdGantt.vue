<!--
  BD Timeline Gantt (old `ganttHtml`, deploy/bd/index.html:2337-2471). Geometry
  comes from `app/utils/bd-gantt.ts` (pure); this widget only draws it: bars
  for dated work, diamonds for dateless deadlines, ink arrows for `dependsOn`
  (only when both rows show), a red today line. SVG/CSS only, no new
  dependencies. On phones the chart scrolls horizontally INSIDE its panel; the
  page itself never does.

  One deliberate deviation: colours map to the app tokens (no hex, no
  gradients) — the old violet lock stripe is now a solid lilac bar, said in the legend.
-->
<script setup lang="ts">
import type { BdPerson, BdProject, BdTask } from '~/composables/useBd'
import { ganttModel, G_HH, G_LW, G_RH, type GZoom } from '~/utils/bd-gantt'
import { inisial, pics, todayISO } from '~/utils/bd-rumus'
import { divTone } from '~/utils/status-bd'

const props = withDefaults(defineProps<{
  projects: BdProject[]
  tasks: BdTask[]
  people: BdPerson[]
  scoped?: boolean
  zoom?: GZoom
}>(), { scoped: false, zoom: 'week' })
const emit = defineEmits<{
  bukaProject: [id: string]
  bukaTask: [t: BdTask]
  subToggle: [t: BdTask, ix: number, on: boolean]
}>()

/** Open projects (`GX`) and collapsed sub-task lists (`TX`): open by default. */
const bukaProj = ref<Record<string, boolean>>({})
const tutupSub = ref<Record<string, boolean>>({})

const model = computed(() => ganttModel({
  projects: props.projects,
  tasks: props.tasks,
  scoped: props.scoped,
  bukaProj: bukaProj.value,
  tutupSub: tutupSub.value,
  zoom: props.zoom,
  hariIni: todayISO(),
}))

const BAR_BG: Record<string, string> = {
  todo: 'bg-ink-300',
  doing: 'bg-info',
  done: 'bg-success opacity-75',
  over: 'bg-error',
  lock: 'bg-lilac-light',
}
const DIV_BG: Record<string, string> = {
  gold: 'bg-ink-900',
  vip: 'bg-lilac-light',
  info: 'bg-info',
  error: 'bg-error',
  success: 'bg-success',
  neutral: 'bg-ink-300',
}

// ---- scroll: the DOM node survives re-renders, so the position holds by
// itself; only a new key (zoom/project) jumps back to today (old `render()`).
const gulir = ref<HTMLElement | null>(null)
function keHariIni() {
  const el = gulir.value
  if (el) el.scrollLeft = Math.max(0, model.value.hariIniX - 200)
}
onMounted(() => nextTick(keHariIni))
watch(() => model.value.kunci, () => nextTick(keHariIni))

function bukaSemua() {
  for (const p of props.projects) bukaProj.value[p.id] = true
}
function tutupSemua() {
  for (const p of props.projects) bukaProj.value[p.id] = false
}
defineExpose({ bukaSemua, tutupSemua, keHariIni })
</script>

<template>
  <div class="overflow-hidden rounded-panel border border-default bg-default p-0">
    <div
      v-if="model.kosong"
      class="px-4 py-6 text-center text-sm text-muted"
    >
      <b class="block text-highlighted">{{ model.kosong.judul }}</b>
      {{ model.kosong.sub }}
    </div>
    <div
      v-else
      ref="gulir"
      class="overflow-auto"
      style="max-height: calc(100vh - 250px); min-height: 180px;"
    >
      <div
        class="relative"
        :style="{ width: `${G_LW + model.W}px` }"
      >
        <div
          class="sticky top-0 z-[6] flex border-b border-default bg-default"
          :style="{ height: `${G_HH}px` }"
        >
          <div
            class="sticky left-0 z-[7] flex shrink-0 items-end border-r border-default bg-default px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted"
            :style="{ width: `${G_LW}px` }"
          >
            {{ scoped ? 'Task' : 'Project' }}
          </div>
          <div
            class="relative shrink-0"
            :style="{ width: `${model.W}px`, height: `${G_HH}px` }"
          >
            <span
              v-for="(c, i) in model.atas"
              :key="`a${i}`"
              class="absolute top-0 h-[22px] overflow-hidden whitespace-nowrap border-l border-default px-1.5 pt-1 text-[11px] font-bold text-muted"
              :style="{ left: `${c.x}px`, width: `${c.w}px` }"
            >{{ c.teks }}</span>
            <span
              v-for="(c, i) in model.bawah"
              :key="`b${i}`"
              class="absolute top-[22px] h-6 overflow-hidden whitespace-nowrap border-l border-default pt-1 text-center text-[10px] text-muted"
              :class="{ 'bg-muted/60': c.cls.includes('we'), 'font-bold text-error': c.cls.includes('td'), 'text-left ps-1': c.cls.includes('kiri') }"
              :style="{ left: `${c.x}px`, width: `${c.w}px` }"
            >{{ c.teks }}</span>
          </div>
        </div>

        <div
          class="pointer-events-none absolute"
          :style="{ left: `${G_LW}px`, top: `${G_HH}px`, height: `${model.H}px`, width: `${model.W}px` }"
        >
          <div
            v-for="(w, i) in model.akhirPekan"
            :key="`w${i}`"
            class="absolute inset-y-0 bg-ink-200/50"
            :style="{ left: `${w.x}px`, width: `${w.w}px` }"
          />
        </div>

        <div
          v-for="r in model.baris"
          :key="`${r.k}${r.k === 'p' ? r.p.id : r.k === 't' ? r.t.id : `${r.t.id}s${r.ix}`}`"
          class="flex border-b border-default"
          :class="r.k === 'p' ? 'bg-muted/60' : ''"
          :style="{ height: `${G_RH}px` }"
        >
          <div
            class="sticky left-0 z-[4] flex shrink-0 items-center gap-1.5 overflow-hidden border-r border-default bg-default px-2.5 text-[12px]"
            :class="r.k === 'p' ? 'bg-muted font-bold' : ''"
            :style="{ width: `${G_LW}px`, paddingLeft: `${10 + (r.k === 'p' ? 0 : r.dalam * 16)}px` }"
          >
            <template v-if="r.k === 'p'">
              <button
                v-if="r.adaTask"
                type="button"
                class="flex size-5 shrink-0 items-center justify-center rounded text-muted hover:bg-elevated"
                :title="r.buka ? 'Tutup task' : 'Buka task'"
                @click.stop="bukaProj[r.p.id] = !r.buka"
              >
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-3.5 transition-transform"
                  :class="r.buka ? 'rotate-90' : ''"
                />
              </button>
              <span
                v-else
                class="w-5 shrink-0"
              />
              <span
                class="size-2 shrink-0 rounded-[3px]"
                :class="DIV_BG[divTone(r.p.div)] || 'bg-ink-300'"
              />
              <button
                type="button"
                class="min-w-0 flex-1 truncate text-start"
                @click="emit('bukaProject', r.p.id)"
              >
                {{ r.p.name }}
              </button>
              <span class="ms-auto shrink-0 text-[11px] font-semibold text-muted num">{{ r.persen }}%</span>
            </template>
            <template v-else-if="r.k === 't'">
              <button
                v-if="r.adaSub"
                type="button"
                class="flex size-5 shrink-0 items-center justify-center rounded text-muted hover:bg-elevated"
                title="Sub-task"
                @click.stop="tutupSub[r.t.id] = !r.subTutup"
              >
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-3.5 transition-transform"
                  :class="r.subTutup ? '' : 'rotate-90'"
                />
              </button>
              <span
                v-else
                class="w-5 shrink-0"
              />
              <span
                v-for="pid in pics(r.t).slice(0, 1)"
                :key="pid"
                class="flex size-5 shrink-0 items-center justify-center rounded-full bg-yellow-light text-[8px] font-bold text-yellow-dark"
                :title="(people.find(p => p.id === pid)?.name) || ''"
              >{{ inisial(people.find(p => p.id === pid)?.name) }}</span>
              <button
                type="button"
                class="min-w-0 flex-1 truncate text-start font-semibold"
                :class="r.t.status === 'Done' ? 'text-muted line-through' : ''"
                @click="emit('bukaTask', r.t)"
              >
                {{ r.t.name }}
              </button>
            </template>
            <template v-else>
              <UCheckbox
                :model-value="!!r.s.done"
                class="shrink-0"
                @update:model-value="(v: boolean | 'indeterminate') => emit('subToggle', r.t, r.ix, v === true)"
              />
              <span
                class="min-w-0 flex-1 truncate"
                :class="r.s.done ? 'text-muted line-through' : 'text-muted'"
              >{{ r.s.t }}</span>
            </template>
          </div>
          <div
            class="relative shrink-0"
            :style="{ width: `${model.W}px` }"
          >
            <template v-if="r.k === 'p'">
              <div
                v-if="r.batang"
                class="absolute flex cursor-pointer items-center overflow-hidden rounded"
                :class="DIV_BG[divTone(r.p.div)] || 'bg-ink-300'"
                :style="{ left: `${r.batang.x}px`, width: `${r.batang.w}px`, top: '10px', height: '16px', opacity: r.p.stage === 'Done' ? 0.45 : 0.9 }"
                :title="r.batang.judul"
                @click="emit('bukaProject', r.p.id)"
              >
                <span
                  class="absolute inset-y-0 left-0 bg-black/15"
                  :style="{ width: `${r.batang.maju}%` }"
                />
              </div>
              <div
                v-if="r.ketupat"
                class="absolute z-[3] size-[13px] rotate-45 border-2 border-white"
                :class="r.ketupat.kls === 'done' ? 'bg-success' : r.ketupat.kls === 'over' ? 'bg-error' : 'bg-ink-300'"
                :style="{ left: `${r.ketupat.x}px`, top: '11px' }"
                :title="r.ketupat.judul"
              />
            </template>
            <template v-else-if="r.k === 't'">
              <div
                v-if="r.fig.kind === 'bar'"
                class="absolute top-2 z-[2] flex h-5 cursor-pointer items-center overflow-hidden rounded-md"
                :class="r.fig.kls === 'proj' ? '' : BAR_BG[r.fig.kls]"
                :style="{ left: `${r.fig.x}px`, width: `${r.fig.w}px` }"
                :title="r.fig.judul"
                @click="emit('bukaTask', r.t)"
              >
                <span
                  v-if="r.fig.maju !== undefined"
                  class="absolute inset-y-0 left-0 bg-black/15"
                  :style="{ width: `${r.fig.maju}%` }"
                />
                <span
                  v-if="r.fig.namaDalam"
                  class="relative whitespace-nowrap px-1.5 text-[10px] font-bold"
                  :class="r.fig.kls === 'todo' ? 'text-ink-800' : 'text-white'"
                >{{ r.t.name }}</span>
              </div>
              <div
                v-else-if="r.fig.kind === 'dia'"
                class="absolute z-[3] size-[13px] rotate-45 border-2 border-white"
                :class="r.fig.kls === 'done' ? 'bg-success' : r.fig.kls === 'over' ? 'bg-error' : 'bg-ink-300'"
                :style="{ left: `${r.fig.x}px`, top: '11px' }"
                :title="r.fig.judul"
                @click="emit('bukaTask', r.t)"
              />
              <span
                v-else
                class="absolute left-2.5 top-2.5 text-[10px] text-muted italic"
              >belum ada tanggal</span>
            </template>
            <template v-else>
              <div
                v-if="r.fig"
                class="absolute z-[3] size-[10px] rotate-45 border-2 border-white"
                :class="r.fig.kls === 'done' ? 'bg-success' : r.fig.kls === 'over' ? 'bg-error' : 'bg-ink-400'"
                :style="{ left: `${r.fig.x}px`, top: '13px' }"
                :title="r.fig.judul"
              />
            </template>
          </div>
        </div>

        <svg
          class="pointer-events-none absolute z-[2] text-ink-900"
          :style="{ left: `${G_LW}px`, top: `${G_HH}px` }"
          :width="model.W"
          :height="model.H"
        >
          <defs>
            <marker
              id="gah"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path
                d="M0,0 L7,3.5 L0,7 z"
                fill="currentColor"
                stroke="none"
              />
            </marker>
          </defs>
          <path
            v-for="(d, i) in model.panah"
            :key="`p${i}`"
            :d="d"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            opacity="0.75"
            marker-end="url(#gah)"
          />
        </svg>
        <div
          class="pointer-events-none absolute z-[3] w-0.5 bg-error/70"
          :style="{ left: `${G_LW + model.hariIniX}px`, top: `${G_HH}px`, height: `${model.H}px` }"
        />
      </div>
    </div>
    <div class="flex flex-wrap gap-x-3.5 gap-y-1 border-t border-default px-4 py-2.5 text-[11px] text-muted">
      <span><i class="mb-0.5 me-1 inline-block h-2 w-3.5 rounded-[3px] bg-ink-300" />To Do</span>
      <span><i class="mb-0.5 me-1 inline-block h-2 w-3.5 rounded-[3px] bg-info" />Doing / Review</span>
      <span><i class="mb-0.5 me-1 inline-block h-2 w-3.5 rounded-[3px] bg-success" />Done</span>
      <span><i class="mb-0.5 me-1 inline-block h-2 w-3.5 rounded-[3px] bg-error" />Lewat deadline</span>
      <span><i class="mb-0.5 me-1 inline-block h-2 w-3.5 rounded-[3px] bg-lilac-light" />Menunggu task lain</span>
      <span>◆ deadline (task tanpa tanggal mulai, sub-task)</span>
      <span class="text-ink-900">Panah: urutan task</span>
      <span class="text-error">Garis merah: hari ini</span>
    </div>
  </div>
</template>
