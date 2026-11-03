<!--
  Homepage › Ringkasan — reimagine (B): Perlu dicek dulu.

  Dulu halaman ini meniru susunan situs (slot menu, slot berita, catatan di
  samping). Versi ini membalik urutannya mengikuti pertanyaan yang dijawab:
  "apa yang perlu saya bereskan sebelum situs tampil bagus" dulu (antrean
  Perlu dicek), baru cerminan slot situsnya. Referensi: dasbor editorial
  (OLGA/Capell) yang menaruh antrean kerja di atas pratinjau terbit; panduan
  CMS (Bevy/Promolayer) yang menampilkan status tayang sekilas.
-->
<script setup lang="ts">
import type { MenuItem } from '~/composables/useHomepage'

definePageMeta({ access: ['menu', 'news', 'homepage'] })

const me = useMe()
const bolehMenu = computed(() => !!me.value?.modules.includes('menu'))
const bolehBerita = computed(() => !!me.value?.modules.includes('news'))
const bolehHomepage = computed(() => !!me.value?.modules.includes('homepage'))

const menu = bolehMenu.value ? useMenuState() : null
const berita = bolehBerita.value ? useBeritaState() : null
const eventWeb = bolehHomepage.value ? useEventWeb() : null
const promoWeb = bolehHomepage.value ? usePromoWeb() : null

// The public feed rule: switched on AND eligible. `alasan`/`version` are for the
// Event screen; the count only needs to match what the website shows.
const eventTampil = computed(() => (eventWeb?.data.value ?? []).filter(e => e.tampil && e.eligible).length)

// The promo slider: stored rows plus BD candidates, counted like the public feed.
const promoItems = computed(() => promoWeb?.data.value?.items ?? [])
const promoTampil = computed(() => promoItems.value.filter(p => p.tampil && p.eligible).length)

// The public GET /menu/unggulan order: shown items in active categories,
// by category order, then item order, then name.
const unggulan = computed<MenuItem[]>(() => {
  const d = menu?.data.value
  if (!d) return []
  const kat = new Map(d.kategori.map(k => [k.id, k]))
  return d.item
    .filter(i => i.unggulan && i.tampil && kat.get(i.kategori_id)?.aktif)
    .sort((a, b) => (kat.get(a.kategori_id)!.urutan - kat.get(b.kategori_id)!.urutan)
      || a.urutan - b.urutan || a.nama.localeCompare(b.nama))
})
const slotMenu = computed(() => Array.from({ length: SLOT_UNGGULAN }, (_, i) => unggulan.value[i] ?? null))

const beritaBeranda = computed(() => {
  const d = berita?.data.value
  if (!d) return []
  const ids = beritaDiBeranda(d)
  return d.artikel.filter(a => ids.has(a.id))
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
})
const slotBerita = computed(() => Array.from({ length: SLOT_BERANDA_BERITA }, (_, i) => beritaBeranda.value[i] ?? null))

interface Cek { icon: string, tone: string, teks: string, to: string }
const cek = computed<Cek[]>(() => {
  const out: Cek[] = []
  const items = menu?.data.value?.item ?? []
  const habis = items.filter(i => !i.tersedia).length
  if (habis) out.push({ icon: 'i-lucide-circle-slash', tone: 'text-error', teks: `${habis} menu ditandai habis`, to: '/homepage/menu?status=habis' })
  const tanpaFoto = items.filter(i => i.tampil && !i.foto_url).length
  if (tanpaFoto) out.push({ icon: 'i-lucide-image-off', tone: 'text-warning', teks: `${tanpaFoto} menu tampil tanpa foto`, to: '/homepage/menu?status=tanpa-foto' })
  const tanpaHarga = items.filter(i => i.tampil && !i.varian.length).length
  if (tanpaHarga) out.push({ icon: 'i-lucide-tag', tone: 'text-warning', teks: `${tanpaHarga} menu tampil tanpa harga`, to: '/homepage/menu?status=tampil' })
  if (menu && unggulan.value.length < SLOT_UNGGULAN) {
    out.push({ icon: 'i-lucide-star', tone: 'text-ink-900', teks: `${SLOT_UNGGULAN - unggulan.value.length} slot unggulan beranda masih kosong`, to: '/homepage/menu?status=tampil' })
  }
  if (unggulan.value.length > SLOT_UNGGULAN) {
    out.push({ icon: 'i-lucide-star', tone: 'text-muted', teks: `${unggulan.value.length - SLOT_UNGGULAN} unggulan tidak muat di beranda`, to: '/homepage/menu?status=unggulan' })
  }
  const draf = (berita?.data.value?.artikel ?? []).filter(a => !a.tampil).length
  if (draf) out.push({ icon: 'i-lucide-file-pen-line', tone: 'text-info', teks: `${draf} berita masih draf`, to: '/homepage/berita?tab=draf' })
  return out
})

const memuat = computed(() => menu?.status.value === 'pending' || berita?.status.value === 'pending'
  || eventWeb?.status.value === 'pending' || promoWeb?.status.value === 'pending')

/** First-load skeleton for the two publish-status cards below: skeleton cells
 *  stand in until the first website answers land. Refetch keeps old numbers,
 *  so the cards never blank. */
const statMemuat = computed(() => (!eventWeb?.data.value || !promoWeb?.data.value)
  && [eventWeb?.status.value, promoWeb?.status.value].some(s => s === 'pending' || s === 'idle'))
</script>

<template>
  <AppPage
    title="Homepage"
    description="Yang sedang tampil di website Laksamana Muda."
  >
    <template #actions>
      <UButton
        label="Buka website"
        icon="i-lucide-external-link"
        color="neutral"
        variant="outline"
        :to="websiteUrl('/')"
        target="_blank"
      />
    </template>

    <AppPanel
      v-if="menu || berita"
      title="Perlu dicek"
      icon="i-lucide-list-checks"
      description="Bereskan ini dulu, baru slot situs di bawahnya tampil bagus."
    >
      <ul
        v-if="cek.length"
        class="grid gap-1 sm:grid-cols-2"
      >
        <li
          v-for="c in cek"
          :key="c.teks"
        >
          <NuxtLink
            :to="c.to"
            class="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <UIcon
              :name="c.icon"
              class="size-[18px] shrink-0"
              :class="c.tone"
            />
            <span class="flex-1 text-default">{{ c.teks }}</span>
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 text-dimmed"
            />
          </NuxtLink>
        </li>
      </ul>
      <p
        v-else-if="!memuat"
        class="flex items-center gap-2 px-2 py-1 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-circle-check"
          class="size-[18px] text-success"
        />
        Semua beres.
      </p>
    </AppPanel>

    <AppStatGrid
      v-if="eventWeb || promoWeb"
      :loading="statMemuat"
      :count="2"
    >
      <NuxtLink
        v-if="eventWeb"
        to="/homepage/event"
        class="block"
      >
        <AppStat
          label="Event di website"
          icon="i-lucide-mic-vocal"
          :value="eventWeb.status.value === 'pending' ? '—' : eventTampil"
          :sub="`dari ${eventWeb.data.value?.length ?? 0} kandidat event`"
        />
      </NuxtLink>
      <NuxtLink
        v-if="promoWeb"
        to="/homepage/promo"
        class="block"
      >
        <AppStat
          label="Promo di website"
          icon="i-lucide-images"
          :value="promoWeb.status.value === 'pending' ? '—' : promoTampil"
          :sub="`dari ${promoItems.length} promo & banner`"
        />
      </NuxtLink>
    </AppStatGrid>

    <div
      v-if="menu || berita"
      class="min-w-0 space-y-6"
    >
      <!-- Our Best Menu -->
      <section
        v-if="menu"
        class="rounded-panel border border-default bg-default p-4 sm:p-5"
      >
        <header class="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-dimmed">
              Beranda · Our Best Menu
            </p>
            <h2 class="mt-0.5 font-display text-lg font-bold text-highlighted">
              {{ Math.min(unggulan.length, SLOT_UNGGULAN) }} dari {{ SLOT_UNGGULAN }} slot terisi
            </h2>
          </div>
          <UButton
            label="Kelola menu"
            trailing-icon="i-lucide-arrow-right"
            color="neutral"
            variant="ghost"
            to="/homepage/menu"
          />
        </header>

        <div
          v-if="menu.error.value"
          class="text-sm text-error"
        >
          {{ apiErrorMessage(menu.error.value) }}
        </div>
        <div
          v-else
          class="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <template
            v-for="(m, i) in slotMenu"
            :key="m?.id ?? `kosong-${i}`"
          >
            <USkeleton
              v-if="memuat && !m"
              :ui="{ base: 'bg-accented/70' }"
              class="aspect-[4/5] rounded-panel"
            />
            <NuxtLink
              v-else-if="m"
              to="/homepage/menu?status=unggulan"
              class="group overflow-hidden rounded-panel border border-default"
            >
              <div class="relative aspect-[4/3] bg-muted">
                <img
                  v-if="m.foto_url"
                  :src="apiFileUrl(m.foto_url)!"
                  alt=""
                  loading="lazy"
                  class="size-full object-cover transition-transform group-hover:scale-[1.03]"
                >
                <span
                  v-else
                  class="flex size-full flex-col items-center justify-center gap-1 text-warning"
                >
                  <UIcon
                    name="i-lucide-image-off"
                    class="size-5"
                  />
                  <span class="text-xs font-semibold">Belum ada foto</span>
                </span>
                <UBadge
                  v-if="!m.tersedia"
                  label="Habis"
                  color="error"
                  variant="solid"
                  size="sm"
                  class="absolute start-2 top-2"
                />
              </div>
              <div class="p-2.5">
                <p class="truncate text-sm font-semibold text-highlighted">
                  {{ m.nama }}
                </p>
                <p class="truncate text-xs text-muted num">
                  {{ hargaRingkas(m.varian) }}
                </p>
              </div>
            </NuxtLink>
            <NuxtLink
              v-else
              to="/homepage/menu"
              class="flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-panel border border-dashed border-accented p-3 text-center text-muted hover:text-highlighted"
            >
              <UIcon
                name="i-lucide-star"
                class="size-5"
              />
              <span class="text-xs font-semibold">Slot kosong</span>
              <span class="text-[11px] text-dimmed">Beri bintang pada menu</span>
            </NuxtLink>
          </template>
        </div>
        <p
          v-if="!memuat && !menu.error.value && !(menu.data.value?.item.length)"
          class="mt-3 text-xs text-muted"
        >
          Katalog masih kosong, jadi website menampilkan menu contoh.
        </p>
      </section>

      <!-- Kabar dari Laksamana -->
      <section
        v-if="berita"
        class="rounded-panel border border-default bg-default p-4 sm:p-5"
      >
        <header class="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-dimmed">
              Beranda · Kabar dari Laksamana
            </p>
            <h2 class="mt-0.5 font-display text-lg font-bold text-highlighted">
              {{ beritaBeranda.length ? `${beritaBeranda.length} berita terbaru` : 'Belum ada berita terbit' }}
            </h2>
          </div>
          <UButton
            label="Kelola berita"
            trailing-icon="i-lucide-arrow-right"
            color="neutral"
            variant="ghost"
            to="/homepage/berita"
          />
        </header>

        <div
          v-if="berita.error.value"
          class="text-sm text-error"
        >
          {{ apiErrorMessage(berita.error.value) }}
        </div>
        <div
          v-else
          class="grid gap-3 sm:grid-cols-3"
        >
          <template
            v-for="(a, i) in slotBerita"
            :key="a?.id ?? `kosong-${i}`"
          >
            <USkeleton
              v-if="memuat && !a"
              :ui="{ base: 'bg-accented/70' }"
              class="h-56 rounded-panel"
            />
            <NuxtLink
              v-else-if="a"
              :to="`/homepage/berita/${a.id}`"
              class="group flex gap-3 overflow-hidden rounded-panel border border-default sm:block"
            >
              <div class="aspect-[16/10] w-28 shrink-0 bg-muted sm:w-full">
                <img
                  v-if="a.cover"
                  :src="apiFileUrl(a.cover)!"
                  alt=""
                  loading="lazy"
                  class="size-full object-cover"
                >
              </div>
              <div class="min-w-0 py-2 pe-2 sm:p-3">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-900">
                  {{ a.category.nama }}
                </p>
                <p class="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-highlighted group-hover:underline">
                  {{ a.title }}
                </p>
                <p class="mt-1 text-[11px] text-dimmed">
                  {{ tglBerita(a.date) }}
                </p>
              </div>
            </NuxtLink>
            <NuxtLink
              v-else
              to="/homepage/berita/baru"
              class="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-panel border border-dashed border-accented p-3 text-center text-muted hover:text-highlighted sm:h-56"
            >
              <UIcon
                name="i-lucide-pen-line"
                class="size-5"
              />
              <span class="text-xs font-semibold">Slot kosong</span>
              <span class="text-[11px] text-dimmed">Beranda memakai berita contoh</span>
            </NuxtLink>
          </template>
        </div>
      </section>
    </div>
  </AppPage>
</template>
