<!--
  Konten › Brand Management (old VIEWS.brands, deploy/konten/index.html:
  2693-2720; konten.md D.17). One card per brand: name, description, four
  figures (Konten, Tayang, Followers, Ke target = Σfollowers ÷ Σtarget of its
  platform accounts), the platform accounts, pillars, PIC and tone. All
  brands — this page has no brand bar, like the old one.
-->
<script setup lang="ts">
import type { BrandKonten } from '~/utils/konten'
import type { PlatformBrand } from '~/utils/sistem-konten'
import { statBrand } from '~/utils/sistem-konten'
import { angka } from '~/utils/format'

definePageMeta({ access: ['konten'] })

const { data: st, error, status } = useStateKonten()
const { can } = useAksesKonten()

const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? ''
const inisial = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const plats = (b: BrandKonten) => (b.platforms ?? []) as PlatformBrand[]

// Card accents: the brand's own colour when valid (#rrggbb from "Warna
// (kalender)"), else a pastel rotation using the AppStat Miro tokens.
const latarPutar = ['bg-sand-light', 'bg-teal-light', 'bg-yellow-light', 'bg-coral-light', 'bg-sky-light', 'bg-lilac-light']
const tintaPutar = ['text-ink-900', 'text-moss-dark', 'text-yellow-dark', 'text-coral-dark', 'text-blue-pressed', 'text-vip']
const warnaSah = (c?: string) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim())
const warnaBrand = (b: BrandKonten) => {
  const c = (b.color ?? '').trim()
  return warnaSah(c) ? c : ''
}
// Soft Nuxt UI badge colours cycled across pillar badges.
const pilarPutar = ['primary', 'success', 'info', 'warning', 'secondary'] as const

const buka = ref(false)
const brandId = ref('')
const brandItem = computed(() => st.value.brands.find(b => b.id === brandId.value) ?? null)
function bukaForm(b?: BrandKonten) {
  brandId.value = b?.id ?? ''
  buka.value = true
}
</script>

<template>
  <KontenGerbang lihat="brands">
    <AppPage
      title="Brand Management"
      :description="`${st.brands.length} brand dikelola`"
    >
      <template
        v-if="can('brands')"
        #actions
      >
        <UButton
          label="Brand baru"
          icon="i-lucide-plus"
          @click="bukaForm()"
        />
      </template>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />
      <div
        v-else-if="status === 'pending' && !st.brands.length"
        class="space-y-2 p-6"
      >
        <!-- Loading cards mirror the brand panels below. -->
        <USkeleton
          v-for="i in 2"
          :key="i"
          class="h-24 rounded-panel"
        />
        <p class="pt-1 text-center text-sm text-muted">
          Memuat…
        </p>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <AppPanel
          v-for="(b, i) in st.brands"
          :key="b.id"
        >
          <!-- Brand colour strip (solid = data colour, pastel = rotation fallback). -->
          <span
            aria-hidden="true"
            class="mb-3 block h-1.5 rounded-full"
            :class="warnaBrand(b) ? '' : latarPutar[i % latarPutar.length]"
            :style="warnaBrand(b) ? { backgroundColor: warnaBrand(b) } : {}"
          />
          <div class="flex items-start gap-3">
            <span
              class="flex size-12 shrink-0 items-center justify-center rounded-xl border font-display text-lg font-bold"
              :class="warnaBrand(b) ? 'text-ink-900' : [latarPutar[i % latarPutar.length], tintaPutar[i % tintaPutar.length]]"
              :style="warnaBrand(b) ? { backgroundColor: `${warnaBrand(b)}1f`, borderColor: `${warnaBrand(b)}66` } : { borderColor: 'transparent' }"
            >
              {{ inisial(b.name) }}
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="text-lg font-semibold text-highlighted">
                {{ b.name }}
              </h3>
              <p class="text-xs text-muted">
                {{ b.desc }}
              </p>
            </div>
            <UButton
              v-if="can('brands')"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Ubah brand"
              @click="bukaForm(b)"
            />
          </div>
          <div class="mt-4 grid grid-cols-4 gap-2 text-center">
            <!-- Fixed pastel per stat so each tile reads as its own measure. -->
            <div class="rounded-lg bg-sky-light p-2">
              <p class="num font-bold">
                {{ statBrand(b, st.content).konten }}
              </p>
              <p class="text-[10px] text-muted">
                Konten
              </p>
            </div>
            <div class="rounded-lg bg-teal-light p-2">
              <p class="num font-bold">
                {{ statBrand(b, st.content).tayang }}
              </p>
              <p class="text-[10px] text-muted">
                Tayang
              </p>
            </div>
            <div class="rounded-lg bg-lilac-light p-2">
              <p class="num font-bold">
                {{ angka(statBrand(b, st.content).followers) }}
              </p>
              <p class="text-[10px] text-muted">
                Followers
              </p>
            </div>
            <div class="rounded-lg bg-sand-light p-2">
              <p class="num font-bold text-primary-700">
                {{ statBrand(b, st.content).keTarget }}%
              </p>
              <p class="text-[10px] text-muted">
                Ke target
              </p>
            </div>
          </div>
          <p class="mt-4 mb-2 text-xs font-semibold text-muted">
            Platform
          </p>
          <p
            v-if="!plats(b).length"
            class="text-xs text-dimmed"
          >
            Belum ada akun platform tercatat.
          </p>
          <ul class="space-y-1.5">
            <li
              v-for="(p, i) in plats(b)"
              :key="i"
              class="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs"
            >
              <UBadge
                :label="p.p || '-'"
                color="neutral"
                variant="soft"
                size="sm"
              />
              <span class="min-w-0 truncate text-muted">{{ p.user }}</span>
              <span class="num ms-auto font-semibold">{{ angka(p.followers ?? 0) }}</span>
              <span class="num text-muted">/ {{ angka(p.target ?? 0) }}</span>
            </li>
          </ul>
          <div
            v-if="b.pillars?.length"
            class="mt-3 flex flex-wrap gap-1"
          >
            <UBadge
              v-for="(p, j) in b.pillars"
              :key="p"
              :label="p"
              :color="pilarPutar[j % pilarPutar.length]"
              variant="soft"
              size="sm"
            />
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-default pt-3 text-xs text-muted">
            <span>PIC: {{ namaUser(b.pic).split(' ')[0] || '-' }}</span>
            <span
              v-if="b.tone"
              class="ms-auto flex items-center gap-1"
            ><UIcon
              name="i-lucide-target"
              class="size-3.5"
            />{{ b.tone }}</span>
          </div>
        </AppPanel>
      </div>

      <KontenBrandForm
        v-model:open="buka"
        :brand="brandItem"
      />
    </AppPage>
  </KontenGerbang>
</template>
