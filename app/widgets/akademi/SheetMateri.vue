<!--
  The material viewer (old openMaterial, deploy/akademi/index.html:984-1062) for
  every type except quiz: Modul (text), Video (YouTube embed or link), SOP
  (checklist + commitment) and Menu Baru (hero + composition/allergens/script).

  Mode Baca: a material outside the crew's division can be studied, but the
  completion button is hidden and it does not count (banner, `:999`, `:1043-1047`).
-->
<script setup lang="ts">
import type { DivisiAkademi, MateriAkademi } from '~/composables/useAkademi'
import { namaDivisi, ytId } from '~/utils/akademi-hitung'
import { statusTipe } from '~/utils/status-akademi'

const props = defineProps<{
  materi: MateriAkademi | null
  dalamLingkup: boolean
  selesai: boolean
  dariProgram: boolean
  divisions: DivisiAkademi[]
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ selesai: [] }>()

const tipe = computed(() => (props.materi ? statusTipe(props.materi.type) : null))
const videoId = computed(() => ytId(props.materi?.videoUrl))

/** SOP steps must all be ticked before the commitment button unlocks (`sopCheck`, :1048-1052). */
const sopCek = ref<boolean[]>([])
const semuaCek = computed(() => sopCek.value.length > 0 && sopCek.value.every(Boolean))

watch(() => props.materi?.id, () => {
  const n = props.materi?.steps?.length ?? 0
  sopCek.value = Array.from({ length: n }, () => false)
}, { immediate: true })

const untuk = computed(() => (props.materi?.division ?? []).map(d => namaDivisi(props.divisions, d)).join(', '))

const judul = computed(() => props.materi?.title ?? 'Materi')
const deskripsi = computed(() => (props.materi ? `Untuk: ${untuk.value}` : undefined))
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="judul"
    :description="deskripsi"
  >
    <div
      v-if="materi && tipe"
      class="space-y-3"
    >
      <div class="flex flex-wrap items-center gap-1.5">
        <AppStatus
          :color="tipe.tone"
          :icon="tipe.icon"
        >
          {{ tipe.label }}
        </AppStatus>
        <AppStatus
          v-if="materi.mandatory"
          color="error"
          icon="i-lucide-flag"
        >
          Wajib
        </AppStatus>
        <AppStatus
          v-if="dariProgram"
          color="info"
          icon="i-lucide-calendar-days"
        >
          Program Bulanan
        </AppStatus>
      </div>

      <div
        v-if="!dalamLingkup"
        class="flex items-start gap-2 rounded-field bg-info/10 p-3 text-[13px] font-semibold text-info"
      >
        <UIcon
          name="i-lucide-glasses"
          class="mt-0.5 size-4 shrink-0"
        />
        <span>Mode Baca, materi ini milik divisi lain. Kamu bebas mempelajarinya, tapi tidak masuk hitungan progress/sertifikasimu.</span>
      </div>

      <!-- Modul -->
      <div
        v-if="materi.type === 'modul'"
        class="whitespace-pre-line text-sm leading-relaxed text-default"
      >
        {{ materi.body }}
      </div>

      <!-- Video -->
      <template v-else-if="materi.type === 'video'">
        <div
          v-if="videoId"
          class="aspect-video w-full overflow-hidden rounded-field bg-black"
        >
          <iframe
            :src="`https://www.youtube.com/embed/${videoId}`"
            class="h-full w-full"
            allowfullscreen
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          />
        </div>
        <div
          v-else-if="materi.videoUrl"
          class="rounded-field border border-default p-3 text-sm"
        >
          Link video:
          <a
            :href="materi.videoUrl"
            target="_blank"
            rel="noopener"
            class="font-semibold text-primary-700 underline-offset-4 hover:underline"
          >{{ materi.videoUrl }}</a>
        </div>
        <p
          v-if="materi.desc"
          class="text-[13.5px] text-muted"
        >
          {{ materi.desc }}
        </p>
      </template>

      <!-- SOP -->
      <template v-else-if="materi.type === 'sop'">
        <p class="text-[13px] text-muted">
          Baca & centang setiap langkah. Setelah semua dicentang, konfirmasi komitmenmu di bawah.
        </p>
        <label
          v-for="(s, i) in materi.steps ?? []"
          :key="i"
          class="flex cursor-pointer items-start gap-2.5 rounded-field border border-default p-3"
        >
          <input
            v-model="sopCek[i]"
            type="checkbox"
            :disabled="selesai || !dalamLingkup"
            class="mt-0.5 size-4 shrink-0 accent-primary-600"
          >
          <span class="text-sm"><b>{{ i + 1 }}.</b> {{ s }}</span>
        </label>
        <AppStatus
          v-if="selesai"
          color="success"
          icon="i-lucide-circle-check"
        >
          Dikonfirmasi
        </AppStatus>
      </template>

      <!-- Menu Baru -->
      <template v-else-if="materi.type === 'menu'">
        <div class="rounded-field border border-default bg-muted p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-muted">
            {{ materi.menu?.category || 'Menu' }}
          </p>
          <p class="mt-1 font-display text-xl font-bold text-highlighted">
            {{ materi.menu?.name || materi.title }}
          </p>
          <p class="font-semibold text-primary-700">
            {{ materi.menu?.price || '' }}
          </p>
          <p class="mt-2 text-[13.5px] leading-relaxed">
            {{ materi.menu?.desc || '' }}
          </p>
        </div>
        <div class="rounded-field border border-default p-4">
          <div class="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
            <div class="text-[11px] font-bold uppercase tracking-wider text-muted">
              Komposisi
            </div>
            <div>{{ materi.menu?.ingredients || '-' }}</div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-muted">
              Alergen
            </div>
            <div class="font-semibold">
              {{ materi.menu?.allergens || '-' }}
            </div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-muted">
              Catatan ops
            </div>
            <div>{{ materi.menu?.notes || '-' }}</div>
          </div>
        </div>
        <div>
          <p class="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-700">
            Selling script (hafalkan gayanya, bukan kata per kata)
          </p>
          <div class="rounded-field bg-muted p-3 text-sm italic">
            {{ materi.menu?.selling || '-' }}
          </div>
        </div>
      </template>

      <!-- Completion -->
      <div
        v-if="dalamLingkup"
        class="pt-1"
      >
        <AppStatus
          v-if="selesai"
          color="success"
          icon="i-lucide-circle-check"
        >
          Sudah diselesaikan
        </AppStatus>
        <UButton
          v-else-if="materi.type === 'sop'"
          label="Saya sudah membaca, paham, dan berkomitmen menjalankan SOP ini"
          icon="i-lucide-circle-check"
          block
          :disabled="!semuaCek"
          @click="emit('selesai')"
        />
        <UButton
          v-else
          :label="materi.type === 'video'
            ? 'Saya sudah menonton video ini sampai selesai'
            : materi.type === 'menu'
              ? 'Saya sudah mempelajari produk ini (komposisi, alergen, script)'
              : 'Tandai selesai'"
          icon="i-lucide-circle-check"
          block
          @click="emit('selesai')"
        />
      </div>
      <p
        v-else
        class="text-[13px] text-muted"
      >
        Mode Baca tidak punya tombol selesai.
      </p>
    </div>
  </ResponsiveSheet>
</template>
