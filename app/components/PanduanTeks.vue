<!--
  Chapter text, rendered safely. Vue escapes every interpolation, so a chapter
  can never inject markup; `*kata*` is turned into a real <strong> element
  AFTER escaping (the old `teks()` order — reverse it and a chapter that writes
  "<b>" would inject a tag). No `v-html` anywhere in the Help module.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{ text?: string, tebal?: boolean }>(), { tebal: false })

interface Seg { teks: string, tebal: boolean }

const segmen = computed<Seg[]>(() => {
  const s = props.text ?? ''
  if (!props.tebal) return [{ teks: s, tebal: false }]
  const out: Seg[] = []
  const re = /\*([^*]+)\*/g
  let akhir = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > akhir) out.push({ teks: s.slice(akhir, m.index), tebal: false })
    out.push({ teks: m[1]!, tebal: true })
    akhir = m.index + m[0].length
  }
  if (akhir < s.length) out.push({ teks: s.slice(akhir), tebal: false })
  return out
})
</script>

<template>
  <template
    v-for="(seg, i) in segmen"
    :key="i"
  >
    <strong
      v-if="seg.tebal"
      class="font-semibold text-highlighted"
    >{{ seg.teks }}</strong>
    <template v-else>
      {{ seg.teks }}
    </template>
  </template>
</template>
