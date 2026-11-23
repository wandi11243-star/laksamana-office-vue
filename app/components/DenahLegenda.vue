<!--
  What the Denah's colours mean, in the old Reservasi plan's words and colours
  (owner request, Nov 2026 — deploy/reservasi seat-viewlegend :5964-5972).
  'tampil' is the day-of map's full legend; 'pilih' (booking form, Marketing's
  VIP / Event table lock) names only what can be seen while picking. Emoji of
  the old legend became Lucide icons.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  mode?: 'tampil' | 'pilih'
  /** Hide the free-table row when a screen only ever picks. */
  zona?: boolean
}>(), { mode: 'tampil', zona: true })

interface Baris {
  /** Swatch classes (fill + edge). */
  kotak: string
  ikon?: string
  /** Label; <b> parts are listed separately to keep the markup out of strings. */
  teks: string
  tebal?: string
  sisa?: string
}

const TAMPIL: Baris[] = [
  { kotak: 'bg-meja-pending', teks: 'Pending (bisa diedit)' },
  { kotak: 'bg-meja-confirmed', teks: 'Confirmed' },
  { kotak: 'bg-meja-datang', teks: 'Sudah Datang, kursi penuh' },
  { kotak: 'bg-meja-sisa', teks: 'Sudah Datang, kursi', tebal: 'masih sisa', sisa: '(mis. meja 4-5 pax baru diisi 2 → tertulis 2/4-5)' },
  { kotak: 'bg-meja-datang shadow-[inset_0_0_0_2px_var(--color-meja-pending)]', teks: 'Rombongan belum lengkap (masih ditunggu)' },
  { kotak: 'bg-meja-sharing', ikon: 'i-lucide-handshake', teks: 'Sharing (bisa gabung)' },
  { kotak: 'bg-meja-kosong ring-1 ring-inset ring-meja-kosong-line', teks: 'Kosong (available) → klik utk walk-in' },
  { kotak: 'bg-meja-dipesan border-2 border-dashed border-meja-dipesan-line', ikon: 'i-lucide-lock-open', teks: 'Dipesan nanti —', tebal: 'bisa dipakai', sisa: ', tapi ditanya dulu' },
  { kotak: 'bg-meja-confirmed border-2 border-meja-confirmed-line', ikon: 'i-lucide-lock', teks: 'Dipesan ≤1 jam lagi —', tebal: 'TERKUNCI', sisa: 'untuk walk-in (kuning bila masih Pending) — klik untuk ubah status pemesannya' },
  { kotak: 'bg-meja-telat animate-pulse', ikon: 'i-lucide-alarm-clock', teks: 'Pemesan', tebal: 'telat', sisa: '(lewat jamnya, belum datang) — berkedip; ≤10 menit lagi berdenyut emas, follow up' },
]

const PILIH: Baris[] = [
  { kotak: 'bg-meja-kosong ring-1 ring-inset ring-meja-kosong-line', teks: 'Kosong — klik untuk memilih' },
  { kotak: 'bg-meja-kosong outline-2 outline-offset-1 outline-gold', teks: 'Terpilih' },
  { kotak: 'bg-meja-pending', teks: 'Pending' },
  { kotak: 'bg-meja-confirmed', teks: 'Confirmed' },
  { kotak: 'bg-meja-datang', teks: 'Sudah Datang' },
  { kotak: 'bg-meja-sharing', ikon: 'i-lucide-handshake', teks: 'Sharing (bisa gabung)' },
  { kotak: 'bg-meja-confirmed opacity-90', ikon: 'i-lucide-lock-open', teks: 'Dipesan tamu lain —', tebal: 'bisa dipakai', sisa: ', tapi ditanya dulu' },
  { kotak: 'bg-meja-confirmed opacity-60 grayscale', ikon: 'i-lucide-lock', teks: 'Terkunci — tamunya sedang duduk / jamnya terlalu dekat' },
]

const baris = computed(() => props.mode === 'pilih' ? PILIH.slice(props.zona ? 0 : 1) : TAMPIL)
</script>

<template>
  <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
    <span
      v-for="b in baris"
      :key="b.teks"
      class="inline-flex flex-wrap items-center gap-1.5"
    >
      <i
        class="inline-block size-3 shrink-0 rounded-[3px]"
        :class="b.kotak"
        aria-hidden="true"
      />
      <UIcon
        v-if="b.ikon"
        :name="b.ikon"
        class="size-3.5 shrink-0"
      />
      {{ b.teks }}
      <b
        v-if="b.tebal"
        class="text-highlighted"
      >{{ b.tebal }}</b>
      <template v-if="b.sisa">{{ b.sisa }}</template>
    </span>
    <!-- What the line under each table means (old "📝 Tulisan di bawah tiap meja"). -->
    <p class="basis-full">
      <UIcon
        name="i-lucide-notebook-pen"
        class="me-1 inline-block size-3.5 align-[-2px]"
      />
      <b class="text-highlighted">Tulisan di bawah tiap meja = kursi yang masih bisa diisi.</b>{{ " " }}
      <b class="text-meja-note-sisa">sisa 2-4 pax</b> (dipesan/diduduki sebagian, masih muat),
      <b class="text-meja-note-penuh">kursi penuh</b>, atau <b>4 - 5 pax</b> (meja kosong).
      Kursi dihitung terpakai begitu <b>dipesan</b>, walau tamunya belum datang.
    </p>
  </div>
</template>
