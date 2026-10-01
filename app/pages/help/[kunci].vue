<!--
  Help Center › one chapter (old gambarArtikel(), help/index.html:519-578).
  The article is a single column: title, "dipakai oleh", table of contents and
  the sections rendered as structured blocks (PanduanBlok). A chapter whose data
  file is not written yet says so — it is never a broken page.
-->
<script setup lang="ts">
import { nextTick, onMounted, watch } from 'vue'
import { HELP_BAB } from '~/utils/help/registry'

definePageMeta({ access: ['help'], middleware: 'help-bab' })

const route = useRoute()
const { isi, status, muat, adaBerkas, ringkasBab } = useHelp()

const kunci = computed(() => String(route.params.kunci ?? ''))
const bab = computed(() => HELP_BAB.find(b => b.key === kunci.value) ?? null)
const panduan = computed(() => isi.value[kunci.value])
const statusBab = computed(() => status.value[kunci.value] ?? 'belum')
const gagal = computed(() => statusBab.value === 'kosong' && adaBerkas(kunci.value))

watch(kunci, k => muat(k), { immediate: true })

function gulirBagian() {
  const h = route.hash
  if (!h.startsWith('#bagian-')) return
  nextTick(() => {
    document.getElementById(h.slice(1))?.scrollIntoView({ block: 'start' })
  })
}
watch([() => route.hash, panduan], gulirBagian)
onMounted(gulirBagian)
</script>

<template>
  <AppPage
    :title="bab?.label ?? 'Panduan'"
    :description="bab ? ringkasBab(bab) : undefined"
    :back="{ label: 'Help Center', to: '/help' }"
  >
    <div class="mx-auto w-full max-w-[860px]">
      <p
        v-if="statusBab === 'belum' && !panduan"
        class="text-sm text-muted"
      >
        Memuat…
      </p>

      <template v-else-if="panduan">
        <span
          v-if="panduan.untuk"
          class="mb-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted"
        >
          <span class="size-1.5 rounded-full bg-primary-500" />
          Dipakai oleh {{ panduan.untuk }}
        </span>

        <nav
          v-if="panduan.bagian.length > 1"
          class="rounded-panel border border-default bg-default p-4 shadow-panel"
        >
          <p class="mb-2 text-[11px] font-bold uppercase tracking-wide text-dimmed">
            Isi panduan
          </p>
          <ol class="ms-5 list-decimal space-y-1 text-sm text-default">
            <li
              v-for="s in panduan.bagian"
              :key="s.id"
            >
              <NuxtLink
                :to="{ path: `/help/${kunci}`, hash: `#bagian-${s.id}` }"
                class="hover:text-primary-700 dark:hover:text-primary-300"
              >
                {{ s.judul }}
              </NuxtLink>
            </li>
          </ol>
        </nav>

        <section
          v-for="s in panduan.bagian"
          :id="`bagian-${s.id}`"
          :key="s.id"
          class="scroll-mt-20 pt-7"
        >
          <h2 class="mb-2 border-b border-default pb-2 font-display text-lg font-semibold text-highlighted">
            {{ s.judul }}
          </h2>
          <PanduanBlok
            v-for="(b, i) in s.isi"
            :key="i"
            :blok="b"
          />
        </section>
      </template>

      <div
        v-else
        class="rounded-field border-s-4 px-4 py-3 text-sm leading-relaxed"
        :class="gagal ? 'border-error bg-error/10' : 'border-info bg-info/10'"
      >
        <strong class="mb-1 block text-highlighted">{{ gagal ? 'Panduan gagal dimuat' : 'Sedang disusun' }}</strong>
        <template v-if="gagal">
          Berkas panduannya ada, tapi isinya tidak terbaca. Biasanya karena kunci yang didaftarkan
          di dalam berkas tidak sama dengan nama berkasnya.
        </template>
        <template v-else>
          Panduan untuk modul ini belum ditulis. Modulnya sendiri tetap bisa dipakai seperti biasa,
          ini cuma dokumentasinya yang belum ada.
        </template>
      </div>
    </div>
  </AppPage>
</template>
