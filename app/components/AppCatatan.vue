<!--
  A notes textarea with bullet and numbering (owner request, Nov 2026: Marketing
  notes "bisa di setting kaya ada bullet point dan numbering", with paragraphs).
  The text stays plain — "• item", "1. item", a blank line between
  paragraphs — so it reads the same in WhatsApp, in Reservasi notes and in
  every place that already shows the note with its line breaks.

    <AppCatatan v-model="f.catatan" size="lg" autoresize class="w-full" />

  The toolbar turns the selected lines into a list (again: back to plain
  lines). Enter inside a list starts the next item; Enter on an empty item
  ends the list. Every other attribute goes to the UTextarea.
-->
<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = defineProps<{ disabled?: boolean }>()
const model = defineModel<string>({ default: '' })

const attrs = useAttrs()
const kelas = computed(() => attrs.class)
const sisa = computed(() => {
  const { class: _c, ...lain } = attrs
  return lain
})

const wrap = ref<HTMLElement | null>(null)
const ta = () => wrap.value?.querySelector('textarea') ?? null

const POLA_BULLET = /^(\s*)[•\-*]\s+/
const POLA_NOMOR = /^(\s*)\d+[.)]\s+/
const tanpaAwalan = (baris: string) => baris.replace(POLA_BULLET, '$1').replace(POLA_NOMOR, '$1')

/** Write the new text, then put the cursor back once the textarea has it. */
function tulis(teks: string, mulai: number, akhir = mulai) {
  model.value = teks
  nextTick(() => {
    const el = ta()
    if (!el) return
    el.value = teks
    el.focus()
    el.setSelectionRange(mulai, akhir)
  })
}

function jadikan(jenis: 'bullet' | 'nomor') {
  const el = ta()
  if (!el || props.disabled) return
  const teks = model.value ?? ''
  const a = teks.lastIndexOf('\n', el.selectionStart - 1) + 1
  const bEnd = teks.indexOf('\n', el.selectionEnd)
  const b = bEnd < 0 ? teks.length : bEnd
  const baris = teks.slice(a, b).split('\n')
  const pola = jenis === 'bullet' ? POLA_BULLET : POLA_NOMOR
  const isi = baris.filter(x => x.trim())
  const sudah = isi.length > 0 && isi.every(x => pola.test(x))
  let n = 0
  const baru = baris.map((x) => {
    if (!x.trim()) return x
    const polos = tanpaAwalan(x)
    if (sudah) return polos
    const indent = polos.match(/^\s*/)?.[0] ?? ''
    return `${indent}${jenis === 'bullet' ? '•' : `${++n}.`} ${polos.trimStart()}`
  }).join('\n')
  // An empty line becomes one empty item, ready to type into.
  const hasil = baris.length === 1 && !baris[0]!.trim() && !sudah ? (jenis === 'bullet' ? '• ' : '1. ') : baru
  tulis(teks.slice(0, a) + hasil + teks.slice(b), a + hasil.length)
}

function tekan(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
  const el = ta()
  if (!el || el.selectionStart !== el.selectionEnd) return
  const teks = model.value ?? ''
  const pos = el.selectionStart
  const awalBaris = teks.lastIndexOf('\n', pos - 1) + 1
  const baris = teks.slice(awalBaris, pos)
  const b = baris.match(/^(\s*)([•\-*])\s+(.*)$/)
  const n = baris.match(/^(\s*)(\d+)([.)])\s+(.*)$/)
  if (!b && !n) return
  e.preventDefault()
  const isi = (b ? b[3] : n![4]) ?? ''
  if (!isi.trim()) {
    // Enter on an empty item ends the list: the marker goes, the line stays.
    tulis(teks.slice(0, awalBaris) + teks.slice(pos), awalBaris)
    return
  }
  const awalan = b ? `${b[1]}${b[2]} ` : `${n![1]}${Number(n![2]) + 1}${n![3]} `
  const sisip = `\n${awalan}`
  tulis(teks.slice(0, pos) + sisip + teks.slice(pos), pos + sisip.length)
}
</script>

<template>
  <div
    ref="wrap"
    :class="kelas"
  >
    <div
      v-if="!disabled"
      class="mb-1 flex flex-wrap items-center gap-1"
    >
      <UButton
        icon="i-lucide-list"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Bullet point"
        title="Bullet point (pilih beberapa baris untuk sekaligus)"
        @mousedown.prevent
        @click="jadikan('bullet')"
      />
      <UButton
        icon="i-lucide-list-ordered"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Penomoran"
        title="Penomoran 1. 2. 3."
        @mousedown.prevent
        @click="jadikan('nomor')"
      />
      <span class="text-xs text-dimmed">Enter lanjut ke poin berikutnya · baris kosong = paragraf baru</span>
    </div>
    <UTextarea
      v-bind="sisa"
      v-model="model"
      :disabled="disabled"
      class="w-full"
      @keydown="tekan"
    />
  </div>
</template>
