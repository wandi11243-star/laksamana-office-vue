<!--
  BD global search (old `APP.cari` + `#cariHasil`, deploy/bd/index.html).
  Typing used to OPEN the first match past 3 letters — typing "design" opened
  one random task while its namesakes stayed unreachable. Now it draws a
  RESULT LIST under the box, and click / Enter opens.

  Searched: task name & description, sub-task text, tags, PIC / sub-task
  assignee names, project names, PO items. Only rows the reader may see
  (the caller passes the visible scope) — search is never a door into
  someone else's tasks. The list draws into its own box, never through a
  page render, so the box being typed in keeps focus.
-->
<script setup lang="ts">
import type { BdPo, BdProject, BdTask } from '~/composables/useBd'
import { pelaksana, selesai, subs, tagsOf } from '~/utils/bd-rumus'
import { fTglP } from '~/utils/format'

export interface HasilPilih {
  jenis: 'task' | 'project' | 'po'
  id: string
}

interface HasilCari extends HasilPilih {
  grup: string
  nama: string
  selesai: boolean
  ket: string
}

const props = defineProps<{
  tasks: BdTask[]
  projects: BdProject[]
  po: BdPo[]
  people: { id: string, name: string }[]
}>()
const emit = defineEmits<{ pilih: [r: HasilPilih] }>()

const q = ref('')
const idx = ref(-1)
const wrap = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const MAKS = 40

const namaOrang = (id: string) => props.people.find(p => p.id === id)?.name || ''
const namaProject = (id?: string | null) => props.projects.find(p => p.id === id)?.name || ''

function hitung(query: string): HasilCari[] {
  const hasil: HasilCari[] = []
  const cocok = (v: unknown) => String(v || '').toLowerCase().includes(query)
  for (const p of props.projects) {
    if (cocok(p.name)) {
      hasil.push({
        jenis: 'project', grup: 'Project', id: p.id, nama: p.name, selesai: p.stage === 'Completed',
        ket: (p.stage || '') + (p.stage === 'Completed' ? ' · selesai' : ''),
      })
    }
  }
  for (const t of props.tasks) {
    let sebab = ''
    if (cocok(t.name)) sebab = ''
    else if (cocok(t.desc)) sebab = 'deskripsi'
    else if (subs(t).some(x => cocok(x.t))) sebab = `sub-task: ${subs(t).find(x => cocok(x.t))?.t || ''}`
    else if (tagsOf(t).some(cocok)) sebab = `tag #${tagsOf(t).find(cocok) || ''}`
    else if (pelaksana(t).some(id => cocok(namaOrang(id)))) {
      const id = pelaksana(t).find(pid => cocok(namaOrang(pid)))
      sebab = `assign: ${namaOrang(id || '')}`
    }
    else continue
    const pr = t.project ? namaProject(t.project) : ''
    const daily = (t as { daily?: boolean }).daily ? ' · Daily' : ''
    hasil.push({
      jenis: 'task', grup: 'Task', id: t.id, nama: t.name, selesai: selesai(t),
      ket: `${t.status || 'To Do'}${daily}${pr ? ` · ${pr}` : ''}${t.deadline ? ` · ${fTglP(t.deadline)}` : ''}${sebab ? ` · ${sebab}` : ''}`,
    })
  }
  for (const o of props.po) {
    if (cocok(o.item)) {
      hasil.push({ jenis: 'po', grup: 'PO', id: o.id, nama: o.item, selesai: false, ket: o.status || '' })
    }
  }
  // Work in progress first: what is looked for is almost always unfinished.
  return hasil.sort((a, b) => Number(a.selesai) - Number(b.selesai))
}

const bersih = computed(() => q.value.trim().toLowerCase())
const daftar = computed(() => (bersih.value.length >= 2 ? hitung(bersih.value) : []))
const tampil = computed(() => daftar.value.slice(0, MAKS))
const sisa = computed(() => Math.max(0, daftar.value.length - MAKS))
const buka = ref(false)
const lihat = computed(() => buka.value && bersih.value.length >= 2)

watch(daftar, (d) => {
  idx.value = d.length ? 0 : -1
})

/** Highlight the match (`cariSorot`): escape first, then wrap — never raw HTML. */
function sorot(teks: string, query: string): string {
  const t = String(teks || '')
  const i = t.toLowerCase().indexOf(query)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  if (!query || i < 0) return esc(t)
  return `${esc(t.slice(0, i))}<mark>${esc(t.slice(i, i + query.length))}</mark>${esc(t.slice(i + query.length))}`
}

function pilih(i: number) {
  const r = daftar.value[i]
  if (!r) return
  buka.value = false
  q.value = ''
  inputEl.value?.blur()
  emit('pilih', { jenis: r.jenis, id: r.id })
}

function tombol(e: KeyboardEvent) {
  if (!lihat.value) return
  const n = Math.min(daftar.value.length, MAKS)
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!n) return
    e.preventDefault()
    idx.value = (idx.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
    wrap.value?.querySelectorAll('.ch-i')[idx.value]?.scrollIntoView({ block: 'nearest' })
  }
  else if (e.key === 'Enter') {
    if (idx.value > -1) {
      e.preventDefault()
      pilih(idx.value)
    }
  }
  else if (e.key === 'Escape') {
    buka.value = false
  }
}

function klikLuar(e: MouseEvent) {
  if (wrap.value && !wrap.value.contains(e.target as Node)) buka.value = false
}
onMounted(() => document.addEventListener('click', klikLuar))
onUnmounted(() => document.removeEventListener('click', klikLuar))
</script>

<template>
  <div
    id="cariWrap"
    ref="wrap"
    class="relative w-full sm:max-w-md"
  >
    <UInput
      ref="inputEl"
      v-model="q"
      icon="i-lucide-search"
      placeholder="Cari task, sub-task, project, PO…"
      autocomplete="off"
      class="w-full"
      @focus="buka = true"
      @input="buka = true"
      @keydown="tombol"
    />
    <div
      v-if="lihat"
      id="cariHasil"
      class="absolute start-0 top-[calc(100%+6px)] z-[60] max-h-[420px] w-[min(480px,92vw)] overflow-auto rounded-panel border border-default bg-default p-1.5 shadow-panel"
    >
      <template v-if="tampil.length">
        <template
          v-for="(r, i) in tampil"
          :key="`${r.jenis}-${r.id}`"
        >
          <p
            v-if="i === 0 || tampil[i - 1]!.grup !== r.grup"
            class="px-2 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-widest text-muted"
          >
            {{ r.grup }}
          </p>
          <button
            type="button"
            class="ch-i block w-full rounded-field px-2 py-1.5 text-start text-[13px] hover:bg-elevated"
            :class="i === idx ? 'bg-elevated' : ''"
            @mousedown.prevent
            @click="pilih(i)"
            @mousemove="idx = i"
          >
            <!-- eslint-disable vue/no-v-html — sorot() escapes both sides before wrapping the match in <mark> -->
            <span
              :class="r.selesai ? 'text-muted line-through' : 'text-highlighted'"
              v-html="sorot(r.nama, bersih)"
            />
            <span
              v-if="r.ket"
              class="mt-0.5 block text-[11.5px] text-muted"
              v-html="sorot(r.ket, bersih)"
            />
            <!-- eslint-enable vue/no-v-html -->
          </button>
        </template>
        <p
          v-if="sisa"
          class="px-2 py-3 text-xs text-muted"
        >
          {{ sisa }} hasil lain tidak ditampilkan — ketik lebih spesifik.
        </p>
      </template>
      <p
        v-else
        class="px-2 py-3 text-xs text-muted"
      >
        Tidak ada task, project, atau PO yang cocok dengan "{{ q.trim() }}".
      </p>
    </div>
  </div>
</template>
