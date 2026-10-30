<!--
  One block of a Help chapter. Every block is STRUCTURED DATA drawn with real
  Vue elements — never `v-html`. Ported from the old engine's BLOK renderer
  (laksamana-office/deploy/help/index.html:347-410):
    teks · langkah · daftar · tabel · catatan · tanya · gambar
  An unknown block type is SHOWN, not skipped: skipping it would delete a
  paragraph on a single typo with no sign at all.
-->
<script setup lang="ts">
// A loose view of the block so the template can branch on `t`. The data itself
// is typed in app/utils/help/tipe.ts and every chapter file is `satisfies
// Panduan`, so an unknown type is a type error, not a silent white box.
interface BlokData {
  t: string
  judul?: string
  isi?: string | string[] | { t: string, j: string }[]
  kepala?: string[]
  baris?: string[][]
  nada?: string
  berkas?: string
  teks?: string
  tandai?: string[]
}

const props = defineProps<{ blok: BlokData }>()

const isiTeks = computed(() => (typeof props.blok.isi === 'string' ? props.blok.isi : ''))
const isiBaris = computed<string[]>(() => Array.isArray(props.blok.isi)
  ? props.blok.isi.filter((x): x is string => typeof x === 'string')
  : [])
const isiTanya = computed(() => Array.isArray(props.blok.isi)
  ? props.blok.isi.filter((x): x is { t: string, j: string } => typeof x === 'object' && x !== null && 't' in x)
  : [])

const nada = computed(() => (props.blok.nada === 'awas' || props.blok.nada === 'ok' ? props.blok.nada : 'info'))
const nadaKelas: Record<string, string> = {
  info: 'border-info bg-info/10',
  awas: 'border-error bg-error/10',
  ok: 'border-success bg-success/10',
}

// The image is a <figure><img>, never a slice of the module UI. A file that is
// not there yet is a valid state that NAMES the path it expects — whoever can
// drop the file in has no other way to guess where it goes.
const gambarGagal = ref(false)
const gambarSrc = computed(() => `/help/gambar/${props.blok.berkas ?? ''}`)
const gambarPath = computed(() => `public/help/gambar/${props.blok.berkas ?? ''}`)
</script>

<template>
  <div class="my-3">
    <!-- Paragraph -->
    <p
      v-if="blok.t === 'teks'"
      class="text-[15px] leading-relaxed text-default"
    >
      <PanduanTeks
        :text="isiTeks"
        tebal
      />
    </p>

    <!-- Numbered steps -->
    <div v-else-if="blok.t === 'langkah'">
      <p
        v-if="blok.judul"
        class="mb-2 text-[15px] font-semibold text-highlighted"
      >
        {{ blok.judul }}
      </p>
      <ol class="space-y-3">
        <li
          v-for="(x, i) in isiBaris"
          :key="i"
          class="flex gap-3"
        >
          <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700 dark:bg-primary-950 dark:text-primary-300 num">
            {{ i + 1 }}
          </span>
          <span class="min-w-0 text-[15px] leading-relaxed text-default">
            <PanduanTeks
              :text="x"
              tebal
            />
          </span>
        </li>
      </ol>
    </div>

    <!-- Bullet list -->
    <ul
      v-else-if="blok.t === 'daftar'"
      class="ms-5 list-disc space-y-1.5 text-[15px] leading-relaxed text-default"
    >
      <li
        v-for="(x, i) in isiBaris"
        :key="i"
      >
        <PanduanTeks
          :text="x"
          tebal
        />
      </li>
    </ul>

    <!-- Term table -->
    <div
      v-else-if="blok.t === 'tabel'"
      class="overflow-x-auto rounded-panel border border-default"
    >
      <table class="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th
              v-for="(h, i) in blok.kepala"
              :key="i"
              class="border-b border-default bg-muted px-3 py-2.5 text-start text-xs font-semibold text-highlighted"
            >
              {{ h }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, ri) in blok.baris"
            :key="ri"
            class="border-b border-default last:border-b-0"
          >
            <td
              v-for="(c, ci) in r"
              :key="ci"
              class="px-3 py-2.5 align-top leading-relaxed text-default"
              :class="ci === 0 && 'font-semibold text-highlighted'"
            >
              <PanduanTeks
                :text="c"
                tebal
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Note -->
    <div
      v-else-if="blok.t === 'catatan'"
      class="rounded-panel border-s-4 px-4 py-3 text-sm leading-relaxed text-default"
      :class="nadaKelas[nada]"
    >
      <span
        v-if="blok.judul"
        class="mb-1 block font-bold text-highlighted"
      >{{ blok.judul }}</span>
      <PanduanTeks
        :text="isiTeks"
        tebal
      />
    </div>

    <!-- FAQ -->
    <div
      v-else-if="blok.t === 'tanya'"
      class="divide-y divide-default overflow-hidden rounded-panel border border-default bg-default shadow-panel"
    >
      <details
        v-for="(q, i) in isiTanya"
        :key="i"
        class="group"
      >
        <summary class="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-sm font-semibold text-highlighted">
          <UIcon
            name="i-lucide-plus"
            class="size-4 shrink-0 text-primary-600 transition-transform group-open:rotate-45 dark:text-primary-300"
          />
          <span class="min-w-0"><PanduanTeks
            :text="q.t"
            tebal
          /></span>
        </summary>
        <div class="px-4 pb-3.5 ps-11 text-sm leading-relaxed text-default">
          <PanduanTeks
            :text="q.j"
            tebal
          />
        </div>
      </details>
    </div>

    <!-- Screenshot -->
    <div v-else-if="blok.t === 'gambar'">
      <figure
        v-if="!gambarGagal"
        class="overflow-hidden rounded-panel border border-default bg-default shadow-panel"
      >
        <img
          :src="gambarSrc"
          :alt="blok.teks || 'Tangkapan layar'"
          loading="lazy"
          class="block h-auto w-full"
          @error="gambarGagal = true"
        >
        <figcaption
          v-if="blok.teks"
          class="border-t border-default bg-muted px-3.5 py-2.5 text-xs text-muted"
        >
          <PanduanTeks
            :text="blok.teks"
            tebal
          />
        </figcaption>
      </figure>
      <div
        v-else
        class="rounded-panel border border-dashed border-default bg-muted px-4 py-6 text-center text-sm text-dimmed"
      >
        Tangkapan layar belum dipasang.
        <code class="mt-2 inline-block rounded-field border border-default bg-default px-2 py-1 text-xs text-muted">{{ gambarPath }}</code>
      </div>
      <ul
        v-if="blok.tandai?.length"
        class="mt-2.5 grid gap-1.5"
      >
        <li
          v-for="(t, i) in blok.tandai"
          :key="i"
          class="flex gap-2.5 text-sm leading-snug"
        >
          <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-table-head text-[11px] font-bold text-table-head-text num">{{ i + 1 }}</span>
          <span class="min-w-0"><PanduanTeks
            :text="t"
            tebal
          /></span>
        </li>
      </ul>
    </div>

    <!-- Unknown block: named, never skipped -->
    <div
      v-else
      class="rounded-panel border-s-4 border-error bg-error/10 px-4 py-3 text-sm text-default"
    >
      Blok panduan tidak dikenal: <strong class="text-highlighted">{{ blok.t }}</strong>
    </div>
  </div>
</template>
