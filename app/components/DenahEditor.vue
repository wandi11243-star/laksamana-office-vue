<!--
  Layout editor: move, add, resize and rename tables, then hand the finished
  plan back through `simpan`. It writes nothing itself — the caller owns the
  write (PUT /master/layouts, /master/layoutTanggal, …) with the section's
  version, so the same editor serves the plan, a template and a single date.

  Two rules that are not negotiable, from the old editor (`:6288-6310`,
  `:6262-6280`):
    - "Save for this date only" is offered SEPARATELY from "save to template".
      Saving a date into its template is what used to shift the plan of every
      weekday at once.
    - A plan stored for one date is not a template: it must not appear in the
      template picker, and cannot be deleted as one.

  On a phone the canvas cannot be dragged precisely, so the editor is read-only
  there and says so (recorded in reservasi.md bagian J): a plan moved by
  accident from a fingertip is worse than no edit at all.
-->
<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { LayoutDenah, MejaDenah, ZonaMeja } from '~/utils/venue-layouts'
import { LABEL_ZONA, SEAT_W, SEAT_H, ZONA_MEJA, kapasitasLayout } from '~/utils/venue-layouts'

const props = withDefaults(defineProps<{
  /** The plan being edited. Cloned inside; the caller's object is never touched. */
  layout: LayoutDenah
  /** "Plan for 12 Aug · F2" — set when the editor edits one date. */
  konteks?: string
  /** The plan is stored for ONE date: "save to template" points at its template. */
  tanggal?: { date: string, lt: 1 | 2 } | null
  /** The template that would cover this date, shown next to the date. */
  templateTanggal?: string | null
  /** Allow dragging & editing. Off on phones. */
  bisaUbah?: boolean
  /** Who last edited this plan, and when — shown ABOVE the plan, not below (`:6222-6229`). */
  jejak?: string
}>(), { bisaUbah: true, tanggal: null, templateTanggal: null, jejak: '' })

/** `simpanTemplat` = save into the covering template (every date that uses it). `simpanTanggal` = this date only. */
const emit = defineEmits<{
  simpanTemplat: [data: LayoutDenah]
  simpanTanggal: [data: LayoutDenah]
}>()

const lebar = useMediaQuery('(min-width: 1024px)')
const bolehUbah = computed(() => props.bisaUbah && lebar.value)

const data = ref<LayoutDenah>(structuredClone(toRaw(props.layout)))
watch(() => props.layout, l => (data.value = structuredClone(toRaw(l))))

const sel = ref<number | null>(null)
const kotor = ref(false)
const pita = ref<HTMLDivElement | null>(null)

const meja = computed<MejaDenah[]>(() => data.value.tables ?? [])
const total = computed(() => kapasitasLayout(data.value))
const mepet = computed(() => {
  const n = meja.value.length
  return new Set(meja.value.map(t => String(t.id))).size !== n
})

const pc = (v: number, totalPx: number) => `${((v / totalPx) * 100).toFixed(3)}%`
const kotak = (o: { x: number, y: number, w: number, h: number }) => ({
  left: pc(o.x, SEAT_W),
  top: pc(o.y, SEAT_H),
  width: pc(o.w, SEAT_W),
  height: pc(o.h, SEAT_H),
})

// --- dragging ----------------------------------------------------------------
// Pointer events only, no drag library: one table, one pointer, and the canvas
// box is all the maths needs (`leDragStart`/`leDragMove`, `:6288-6305`).

let seret: { i: number, sx: number, sy: number, ox: number, oy: number, rw: number, rh: number, geser: boolean } | null = null

function mulai(e: PointerEvent, i: number) {
  if (!bolehUbah.value) return
  sel.value = i
  const kotakPita = pita.value?.getBoundingClientRect()
  if (!kotakPita) return
  const t = meja.value[i]!
  seret = { i, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y, rw: kotakPita.width, rh: kotakPita.height, geser: false }
  window.addEventListener('pointermove', geserMeja)
  window.addEventListener('pointerup', lepasMeja, { once: true })
}

function geserMeja(e: PointerEvent) {
  if (!seret) return
  const t = meja.value[seret.i]
  if (!t) return
  let nx = seret.ox + (e.clientX - seret.sx) / seret.rw * SEAT_W
  let ny = seret.oy + (e.clientY - seret.sy) / seret.rh * SEAT_H
  nx = Math.max(0, Math.min(SEAT_W - t.w, nx))
  ny = Math.max(0, Math.min(SEAT_H - t.h, ny))
  if (Math.abs(nx - seret.ox) > 2 || Math.abs(ny - seret.oy) > 2) seret.geser = true
  t.x = Math.round(nx)
  t.y = Math.round(ny)
}

function lepasMeja() {
  window.removeEventListener('pointermove', geserMeja)
  if (seret?.geser) kotor.value = true
  seret = null
}

onBeforeUnmount(() => window.removeEventListener('pointermove', geserMeja))

// --- the inspector -----------------------------------------------------------

const terpilih = computed(() => (sel.value === null ? null : meja.value[sel.value] ?? null))

function set(prop: 'id' | 'cap' | 'zone' | 'w' | 'h', v: string) {
  const t = terpilih.value
  if (!t) return
  if (prop === 'w' || prop === 'h') v = String(Math.max(20, Math.min(prop === 'w' ? SEAT_W : SEAT_H, Number(v) || 20)))
  // Assigning through the selected object keeps its identity, so the table on
  // the plan moves with the number typed into the inspector.
  ;(t as unknown as Record<string, string>)[prop] = v
  kotor.value = true
}

/** Next free "T<n>" id, so a new table never silently takes an existing number. */
/**
 * Background blocks (stage, DJ, entrance…) are switched off per plan, not
 * deleted: `hidden` keeps the coordinates so the block can come back next week
 * (old app, 23 Oct 2026). Saved with the same Save button as the tables.
 */
function latar(i: number, tampil: boolean) {
  const f = data.value.fixed?.[i]
  if (!f) return
  if (tampil) delete f.hidden
  else f.hidden = true
  kotor.value = true
}

function idBerikut() {
  const pakai = new Set(meja.value.map(t => String(t.id)))
  let n = 1
  while (pakai.has(`T${n}`)) n++
  return `T${n}`
}

function tambah() {
  data.value.tables = [...meja.value, { id: idBerikut(), x: Math.round(SEAT_W / 2 - 45), y: Math.round(SEAT_H / 2 - 40), w: 90, h: 80, cap: '4', zone: 'green' }]
  sel.value = data.value.tables.length - 1
  kotor.value = true
}

function hapus() {
  if (sel.value === null) return
  data.value.tables = meja.value.filter((_, i) => i !== sel.value)
  sel.value = null
  kotor.value = true
}

const gantiZona = (v: ZonaMeja) => set('zone', v)
</script>

<template>
  <div>
    <p
      v-if="!bolehUbah"
      class="mb-3 text-sm text-muted"
    >
      <UIcon
        name="i-lucide-info"
        class="mr-1 inline size-4 align-text-bottom"
      />Buka di layar lebar untuk mengubah denah. Di HP denah hanya bisa dilihat.
    </p>
    <p
      v-else-if="!lebar"
      class="mb-3 text-sm text-muted"
    >
      <UIcon
        name="i-lucide-info"
        class="mr-1 inline size-4 align-text-bottom"
      />Di layar sempit denah hanya bisa dilihat.
    </p>

    <!-- Who changed the plan last, ABOVE the plan: the question "who moved this"
         comes before the edit, not after it. -->
    <p
      v-if="jejak"
      class="mb-2 text-sm text-muted"
    >
      {{ jejak }}
    </p>

    <div
      ref="pita"
      class="denah"
      :class="{ 'denah-mati': !bolehUbah }"
    >
      <div class="denah-in">
        <div
          v-for="(f, i) in data.fixed ?? []"
          :key="`f${i}`"
          class="fix"
          :class="[`fix-${f.t}`, { 'fix-mati': f.hidden }]"
          :style="kotak(f)"
          :title="f.hidden ? 'Disembunyikan — nyalakan lagi di panel Latar denah' : undefined"
        >
          {{ f.label }}
        </div>
        <div
          v-for="(t, i) in meja"
          :key="`${t.id}-${i}`"
          class="seat"
          :class="[`seat-${t.zone}`, { sel: sel === i }]"
          :style="kotak(t)"
          @pointerdown="mulai($event, i)"
        >
          <span class="sn">{{ t.id }}</span>
          <span class="sp">{{ t.cap }} pax</span>
        </div>
      </div>
    </div>

    <p class="mt-2 text-sm text-muted">
      <template v-if="bolehUbah">
        Seret meja untuk memindah, klik untuk mengubah.
      </template>
      <template v-else>
        Denah hanya bisa dilihat di layar ini.
      </template>
      <b>{{ meja.length }}</b> meja · total <b>{{ total }}</b> pax
      <span
        v-if="mepet"
        class="text-error"
      >· ada nomor meja kembar</span>
    </p>

    <div
      v-if="bolehUbah"
      class="mt-4 grid gap-4 lg:grid-cols-2"
    >
      <div
        v-if="!terpilih"
        class="rounded-xl bg-default p-4"
      >
        <p class="font-semibold text-highlighted">
          Belum ada meja dipilih
        </p>
        <p class="mt-1 text-sm text-muted">
          Klik salah satu meja di denah untuk mengatur nama, kapasitas, zona & ukuran.
        </p>
        <UButton
          class="mt-3"
          label="Tambah meja"
          size="xl"
          @click="tambah"
        />
      </div>

      <div
        v-else
        class="rounded-xl bg-default p-4"
      >
        <p class="mb-3 font-semibold text-highlighted">
          Meja {{ terpilih.id }}
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Nama / id">
            <UInput
              :model-value="terpilih.id"
              size="xl"
              class="w-full"
              @update:model-value="set('id', String($event))"
            />
          </UFormField>
          <UFormField
            label="Kapasitas (pax)"
            help="mis. 4 atau 10-12"
          >
            <UInput
              :model-value="terpilih.cap"
              size="xl"
              class="w-full"
              @update:model-value="set('cap', String($event))"
            />
          </UFormField>
          <UFormField label="Zona / warna">
            <USelect
              :model-value="terpilih.zone"
              :items="ZONA_MEJA.map(z => ({ value: z, label: LABEL_ZONA[z] }))"
              size="xl"
              class="w-full"
              @update:model-value="gantiZona($event as ZonaMeja)"
            />
          </UFormField>
          <UFormField label="Lebar">
            <UInput
              type="number"
              :model-value="terpilih.w"
              size="xl"
              class="w-full"
              @update:model-value="set('w', String($event))"
            />
          </UFormField>
          <UFormField label="Tinggi">
            <UInput
              type="number"
              :model-value="terpilih.h"
              size="xl"
              class="w-full"
              @update:model-value="set('h', String($event))"
            />
          </UFormField>
        </div>
        <div class="mt-3 flex gap-2">
          <UButton
            label="Hapus meja"
            color="error"
            variant="soft"
            size="xl"
            @click="hapus"
          />
          <UButton
            label="Tambah meja lain"
            color="neutral"
            variant="soft"
            size="xl"
            @click="tambah"
          />
        </div>
      </div>

      <div class="rounded-xl bg-default p-4">
        <p class="font-semibold text-highlighted">
          Latar denah
        </p>
        <template v-if="data.fixed?.length">
          <p class="mt-1 mb-2 text-sm text-muted">
            Centang yang ditampilkan. Yang dimatikan tetap tersimpan dan bisa dinyalakan lagi.
          </p>
          <div class="grid gap-2 sm:grid-cols-2">
            <UCheckbox
              v-for="(f, i) in data.fixed"
              :key="`l${i}`"
              :model-value="!f.hidden"
              :label="f.label || f.t || 'Latar'"
              @update:model-value="(v) => latar(i, !!v)"
            />
          </div>
        </template>
        <p
          v-else
          class="mt-1 text-sm text-muted"
        >
          Denah ini tidak punya latar (stage, meja DJ, dsb).
        </p>
      </div>

      <div class="rounded-xl bg-default p-4">
        <p class="mb-2 font-semibold text-highlighted">
          Nama denah
        </p>
        <UFormField
          label="Nama"
          help="Sebut “Lantai 2” kalau denah ini untuk lantai atas — dari situlah lantainya dikenali."
        >
          <UInput
            v-model="data.name"
            size="xl"
            class="w-full"
            @update:model-value="kotor = true"
          />
        </UFormField>

        <p
          v-if="konteks"
          class="mt-3 text-sm text-muted"
        >
          Denah untuk tanggal {{ konteks }}. Menyimpan ke template
          <b>{{ templateTanggal ?? '-' }}</b> berlaku untuk semua tanggal yang memakainya.
        </p>

        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            v-if="konteks"
            label="Simpan ke template"
            color="neutral"
            variant="soft"
            size="xl"
            @click="emit('simpanTemplat', data)"
          />
          <UButton
            :label="konteks ? 'Simpan untuk tanggal ini saja' : 'Simpan'"
            :disabled="!kotor && !konteks"
            size="xl"
            @click="konteks ? emit('simpanTanggal', data) : emit('simpanTemplat', data)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Geometry and type only; every colour is a token (DESIGN.md). */
.denah {
  position: relative;
  width: 100%;
  aspect-ratio: 1600 / 1160;
  max-height: 78vh;
  overflow: auto;
  background: var(--color-seat-floor);
  border: 1px solid var(--color-seat-line);
  border-radius: 0.75rem;
  user-select: none;
  touch-action: pan-y;
}

/* On a phone the editor is read-only, so the plan gets a scroll window of its own. */
@media (width < 64rem) {
  .denah {
    height: 55vh;
    aspect-ratio: auto;
  }
}

.denah-in {
  position: relative;
  width: 100%;
  min-width: 42rem;
  aspect-ratio: 1600 / 1160;
}

.denah-mati .seat {
  cursor: default;
}

.fix {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  text-align: center;
  font-weight: 700;
  color: var(--color-seat-ink);
  border-radius: 0.375rem;
  pointer-events: none;
}

/* Switched off: still drawn in the editor, faded and dashed, so it can be found again. */
.fix.fix-mati {
  opacity: 0.22;
  border: 1px dashed var(--color-seat-line);
}

.fix-stage {
  background: var(--color-seat-line);
  color: var(--color-seat-ink);
  font-size: clamp(0.7rem, 2.1vw, 1.6rem);
  letter-spacing: 0.06em;
}

.fix-floor2 {
  border: 1px solid var(--color-seat-line);
  font-size: clamp(0.7rem, 1.9vw, 1.4rem);
}

.fix-foh {
  background: var(--color-seat-dark);
  color: var(--color-seat-ink);
  font-size: clamp(0.6rem, 1.3vw, 0.95rem);
}

.fix-dj,
.fix-tangga {
  background: var(--color-laksamana-200);
  color: var(--color-laksamana-950);
  font-size: clamp(0.5rem, 1vw, 0.8rem);
}

.fix-viproom {
  border: 1px dashed var(--color-seat-line);
  color: var(--color-seat-ink);
  font-size: clamp(0.5rem, 1vw, 0.8rem);
}

/* See DenahPeta: the 44-unit-wide entrance label is written along its height. */
.fix-entrance {
  border: 1px dashed var(--color-seat-line);
  background: var(--color-seat-ext);
  color: var(--color-seat-ink);
  font-size: clamp(0.45rem, 0.8vw, 0.7rem);
  letter-spacing: 0.08em;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

.seat {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0.125rem;
  overflow: hidden;
  line-height: 1.05;
  color: var(--color-seat-ink);
  border: 1.5px solid var(--color-seat-line);
  border-radius: 0.375rem;
  cursor: grab;
  touch-action: none;
}

.seat-green {
  background: var(--color-seat-green);
  border-radius: 9999px;
}

.seat-blue { background: var(--color-seat-blue); }
.seat-wood { background: var(--color-seat-wood); }
.seat-vip { background: var(--color-seat-vip); }
.seat-dark { background: var(--color-seat-dark); }
.seat-diamond { background: var(--color-seat-diamond); }
.seat-ext { background: var(--color-seat-ext); }

.seat.sel {
  box-shadow: 0 0 0 3px var(--ui-primary);
  z-index: 6;
}

.sn {
  font-weight: 700;
  font-size: clamp(0.5rem, 1.4vw, 0.95rem);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp {
  font-size: clamp(0.4rem, 0.85vw, 0.65rem);
  font-weight: 600;
  opacity: 0.8;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
