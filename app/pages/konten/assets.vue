<!--
  Konten › Asset Management (old VIEWS.assets, deploy/konten/index.html:4267-4288;
  konten.md D.8). Header "<n> asset tersimpan" (all assets), category chips
  ("Semua" + the categories in use), a card grid: icon per category, name,
  category - version, brand + up to 3 tags, uploader + time. A card opens its
  link in a new tab; "Edit" needs edit on `assets`.
-->
<script setup lang="ts">
import type { AssetKonten } from '~/utils/konten'
import { lamaKonten } from '~/utils/konten'

definePageMeta({ access: ['konten'] })

const { data: st, error } = useStateKonten()
const { can } = useAksesKonten()
const brand = useBrandKonten()
const kat = useState('konten-asset-kat', () => '')

const IKON: Record<string, string> = {
  'Photo': 'i-lucide-image', 'Video': 'i-lucide-clapperboard', 'RAW': 'i-lucide-video', 'Edited': 'i-lucide-sparkles',
  'Logo': 'i-lucide-target', 'Font': 'i-lucide-type', 'Music': 'i-lucide-music', 'Motion Template': 'i-lucide-film',
  'PSD': 'i-lucide-brush', 'AI': 'i-lucide-pen-tool', 'Canva': 'i-lucide-palette',
}
const kategori = computed(() => [...new Set(st.value.assets.map(a => a.category).filter((c): c is string => !!c))])
const opsiKat = computed(() => [{ value: '', label: 'Semua' }, ...kategori.value.map(c => ({ value: c, label: c }))])
const list = computed(() => saringBrand(st.value.assets, brand.value).filter(a => !kat.value || a.category === kat.value))
const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? ''
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? ''

const formBuka = ref(false)
const asset = ref<AssetKonten | null>(null)
function tambah() {
  asset.value = null
  formBuka.value = true
}
function edit(a: AssetKonten) {
  asset.value = a
  formBuka.value = true
}
function buka(a: AssetKonten) {
  if (a.link) window.open(a.link, '_blank', 'noopener')
}
</script>

<template>
  <KontenGerbang lihat="assets">
    <AppPage
      title="Asset Management"
      :description="`${st.assets.length} asset tersimpan - foto, video, desain, template`"
    >
      <template
        v-if="can('assets')"
        #actions
      >
        <UButton
          label="Tambah Asset"
          icon="i-lucide-plus"
          @click="tambah"
        />
      </template>

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`Gagal memuat data Konten: ${apiErrorMessage(error)}`"
      />
      <KontenBrandBar :brands="st.brands" />

      <AppChips
        v-model="kat"
        :options="opsiKat"
        class="mb-4"
      />

      <div
        v-if="list.length"
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="a in list"
          :key="a.id"
          role="link"
          tabindex="0"
          class="cursor-pointer rounded-panel border border-default bg-default p-4 shadow-panel hover:border-accented"
          :title="a.link || 'Belum ada link'"
          @click="buka(a)"
          @keydown.enter="buka(a)"
        >
          <div class="mb-2.5 flex items-center gap-2.5">
            <span class="flex size-11 shrink-0 items-center justify-center rounded-field bg-muted">
              <UIcon
                :name="IKON[a.category ?? ''] ?? 'i-lucide-folder'"
                class="size-5 text-primary-700"
              />
            </span>
            <span class="min-w-0">
              <b class="block truncate text-sm text-highlighted">{{ a.name }}</b>
              <span class="text-xs text-muted">{{ a.category }} - {{ a.version || 'v1' }}</span>
            </span>
          </div>
          <div class="mb-2.5 flex flex-wrap items-center gap-1">
            <span class="text-xs text-muted">{{ namaBrand(a.brand) }}</span>
            <UBadge
              v-for="t in (a.tags ?? []).slice(0, 3)"
              :key="t"
              :label="`#${t}`"
              color="neutral"
              variant="soft"
              size="sm"
            />
          </div>
          <div class="flex items-center justify-between text-xs text-muted">
            <span>{{ namaUser(a.by).split(' ')[0] }}</span>
            <span>{{ lamaKonten(a.at) }}</span>
          </div>
          <UButton
            v-if="can('assets')"
            label="Edit"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="sm"
            block
            class="mt-2.5"
            @click.stop="edit(a)"
          />
        </div>
      </div>
      <AppPanel v-else>
        <p class="py-6 text-center text-sm text-muted">
          <UIcon
            name="i-lucide-folder"
            class="mb-1 size-7"
          />
          <b class="block text-base text-highlighted">Belum ada asset</b>
        </p>
      </AppPanel>

      <KontenAssetForm
        v-model:open="formBuka"
        :asset="asset"
      />
    </AppPage>
  </KontenGerbang>
</template>
