<!--
  Help Center › home (old deploy/help beranda(), help/index.html:492-517).
  Chapter cards grouped like the old portal, plus the search results when the
  top bar has a `q`. A chapter with no data file is a valid state and says so
  ("Sedang disusun"); it is never hidden.
-->
<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { HELP_BAB, HELP_GRUP } from '~/utils/help/registry'

definePageMeta({ access: ['help'] })

const me = useMe()
const route = useRoute()
const { babSaya, pesan, siapkan, adaBerkas, ringkasBab, cari } = useHelp()

siapkan()

const q = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
const mencari = computed(() => q.value.trim().length > 0)
const hasil = computed(() => cari(q.value))

const nama = computed(() => me.value?.name ?? me.value?.username ?? '')

const grups = computed(() =>
  // Groups come from the registry order; a group with no readable chapter is
  // not drawn at all (old beranda()).
  [...new Set(HELP_BAB.map(b => b.grup))].map((key) => {
    const meta = HELP_GRUP.find(g => g.key === key)
    return { key, label: meta?.label ?? key, items: babSaya.value.filter(b => b.grup === key) }
  }).filter(g => g.items.length))

onMounted(() => {
  // Only show the "not available" notice once; it belongs to the previous route.
  if (!pesan.value) return
  setTimeout(() => {
    pesan.value = null
  }, 6000)
})
onBeforeUnmount(() => {
  if (pesan.value) pesan.value = null
})
</script>

<template>
  <AppPage
    title="Help Center"
    :description="`Panduan pemakaian Office Laksamana Muda${nama ? ', ' + nama : ''}. Yang tampil di sini hanya modul yang memang bisa kamu buka, jadi daftarnya bisa berbeda dari daftar milik rekan kerjamu.`"
  >
    <div class="mx-auto w-full max-w-[860px]">
      <p
        v-if="pesan"
        class="mb-5 rounded-field border border-info/30 bg-info/10 px-4 py-3 text-sm text-default"
      >
        <UIcon
          name="i-lucide-info"
          class="me-1 inline size-4 align-text-bottom text-info"
        />
        {{ pesan }}
      </p>

      <!-- Search results -->
      <template v-if="mencari">
        <div
          v-if="q.trim().length < 2"
          class="rounded-panel border border-default bg-default p-8 text-center text-muted shadow-panel"
        >
          <UIcon
            name="i-lucide-search"
            class="mx-auto mb-2 size-7 text-dimmed"
          />
          Ketik minimal dua huruf untuk mencari.
        </div>

        <div
          v-else-if="!hasil.length"
          class="rounded-panel border border-default bg-default p-8 text-center shadow-panel"
        >
          <UIcon
            name="i-lucide-search-x"
            class="mx-auto mb-2 size-7 text-dimmed"
          />
          <p class="text-default">
            Tidak ada panduan yang memuat <b class="text-highlighted">{{ q }}</b>.
          </p>
          <p class="mt-1 text-sm text-muted">
            Pencarian hanya menyisir modul yang bisa kamu buka.
          </p>
        </div>

        <AppPanel
          v-else
          title="Hasil pencarian"
          icon="i-lucide-search"
          :count="hasil.length"
        >
          <div class="grid grid-cols-1 gap-2.5">
            <NuxtLink
              v-for="h in hasil"
              :key="`${h.kunci}-${h.bagian.id}`"
              :to="{ path: `/help/${h.kunci}`, hash: `#bagian-${h.bagian.id}` }"
              class="block rounded-panel border border-default bg-default p-3.5 transition-colors hover:border-primary-400"
            >
              <div class="text-xs font-semibold text-primary-700 dark:text-primary-300">
                {{ h.label }}
              </div>
              <div class="font-semibold text-highlighted">
                {{ h.bagian.judul }}
              </div>
              <p class="mt-1 text-sm leading-relaxed text-muted">
                <template v-if="h.petikan.cocok">
                  {{ h.petikan.sebelum }}<mark class="rounded bg-primary-100 px-0.5 text-highlighted dark:bg-primary-950">{{ h.petikan.cocok }}</mark>{{ h.petikan.sesudah }}
                </template>
                <template v-else>
                  {{ h.petikan.sebelum }}
                </template>
              </p>
            </NuxtLink>
          </div>
        </AppPanel>
      </template>

      <!-- Chapter cards -->
      <template v-else>
        <section
          v-for="g in grups"
          :key="g.key"
          class="mb-6"
        >
          <h2 class="mb-3 text-[11px] font-bold uppercase tracking-wider text-dimmed">
            {{ g.label }}
          </h2>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NuxtLink
              v-for="b in g.items"
              :key="b.key"
              :to="`/help/${b.key}`"
              class="flex flex-col rounded-panel border border-default bg-default p-4 shadow-panel transition-colors hover:border-primary-400"
            >
              <span class="font-display font-bold text-highlighted">{{ b.label }}</span>
              <span class="mt-1 text-sm leading-relaxed text-muted">{{ ringkasBab(b) }}</span>
              <span
                v-if="!adaBerkas(b.key)"
                class="mt-3 self-start rounded-full border border-default px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-dimmed"
              >
                Sedang disusun
              </span>
            </NuxtLink>
          </div>
        </section>

        <div
          v-if="!grups.length"
          class="rounded-panel border border-default bg-default p-8 text-center text-muted shadow-panel"
        >
          Belum ada panduan yang bisa kamu buka.
        </div>
      </template>
    </div>
  </AppPage>
</template>
