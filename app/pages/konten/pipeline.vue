<!--
  Konten › Pipeline (old VIEWS.pipeline + kDrop, deploy/konten/index.html:2532-2568;
  konten.md D.3). Kanban over the ten pipeline steps; dragging a card to another
  column sets its status (needs edit on `content`; moving into Approval
  notifies). The board scrolls inside its own box, not the page.

  On phones (konten.md H) the same rows are a list grouped per status — drag &
  drop is not reliable on touch; the status is changed from the detail page.
  PIC filter: counts over ACTIVE content (not Cancelled), "Belum ada PIC" = __none__.
-->
<script setup lang="ts">
import type { KontenItem } from '~/utils/konten'
import { PIPELINE_KONTEN, contentPlatforms, opsiPicKonten, picCocok, sudahArsip } from '~/utils/konten'
import { ikonStatusKonten, warnaStatusKonten } from '~/utils/status-konten'

definePageMeta({ access: ['konten'] })

const { data: st, error, status } = useStateKonten()
const { saya, can } = useAksesKonten()
const brand = useBrandKonten()
const pic = useState('konten-pipe-pic', () => '')
const toast = useToast()

const SEMUA = '__semua'
const fPic = computed({ get: () => pic.value || SEMUA, set: (v: string) => {
  pic.value = v === SEMUA ? '' : v
} })

const dasar = computed(() => saringBrand(st.value.content, brand.value))
const tersaring = computed(() => dasar.value.filter(c => picCocok(pic.value, c.pic)))
const aktif = computed(() => dasar.value.filter(c => c.status !== 'Cancelled'))
const nAktif = computed(() => tersaring.value.filter(c => c.status !== 'Cancelled').length)
const opsiPic = computed(() => opsiPicKonten(
  st.value.users,
  id => (id == null ? aktif.value.length : aktif.value.filter(c => picCocok(id, c.pic)).length),
  saya.value?.user.id,
).map(o => ({ ...o, value: o.value || SEMUA })))
const kolom = computed(() => PIPELINE_KONTEN.map(s => ({ s, items: tersaring.value.filter(c => c.status === s) })))

const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? ''
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? ''
const inisial = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()

// ---- drag & drop (desktop) ----
const seret = ref<string | null>(null)
const atas = ref<string | null>(null)
async function lepas(col: string) {
  atas.value = null
  const id = seret.value
  seret.value = null
  if (!id) return
  if (!can('content')) return toast.add({ title: 'Tidak punya akses ubah status', color: 'error' })
  const c = st.value.content.find(x => x.id === id)
  if (!c || c.status === col) return
  const ok = await kontenSimpan(
    () => tambalKonten<KontenItem>('content', c.id, { status: col }, c.updatedAt),
    `${c.title} → ${col}`,
    { action: `memindahkan ke ${col}`, target: c.title },
  )
  if (ok && col === 'Approval') notifKonten('approval', `Menunggu approval: ${c.title}`)
}
</script>

<template>
  <KontenGerbang lihat="pipeline">
    <AppPage
      title="Content Pipeline"
      description="Geser kartu antar kolom untuk update status"
    >
      <template
        v-if="can('content')"
        #actions
      >
        <UButton
          label="Konten baru"
          icon="i-lucide-plus"
          to="/konten/detail/baru"
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

      <AppPanel>
        <div class="flex flex-wrap items-center gap-3">
          <USelect
            v-model="fPic"
            :items="opsiPic"
            class="w-64 max-w-full"
            aria-label="PIC"
          />
          <UButton
            v-if="pic"
            label="Reset"
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="outline"
            size="sm"
            @click="pic = ''"
          />
          <span class="ml-auto text-xs text-muted">{{ nAktif }} konten aktif<template v-if="pic"> · {{ pic === '__none__' ? 'belum ada PIC' : namaUser(pic) }}</template></span>
        </div>
      </AppPanel>

      <!-- Desktop: the board. -->
      <div
        class="hidden gap-3 overflow-x-auto pb-2 lg:flex"
        :class="status === 'pending' ? 'opacity-60' : ''"
      >
        <section
          v-for="k in kolom"
          :key="k.s"
          class="flex w-60 flex-none flex-col rounded-panel border bg-muted"
          :class="atas === k.s ? 'border-primary-400 bg-primary-50' : 'border-default'"
          @dragover.prevent="atas = k.s"
          @dragleave="atas === k.s && (atas = null)"
          @drop.prevent="lepas(k.s)"
        >
          <header class="flex items-center gap-2 px-3 py-2.5">
            <AppStatus
              :color="warnaStatusKonten(k.s)"
              :icon="ikonStatusKonten(k.s)"
              size="sm"
            >
              {{ k.s }}
            </AppStatus>
            <span class="num ml-auto rounded-full bg-default px-2 text-xs font-bold">{{ k.items.length }}</span>
          </header>
          <div class="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
            <NuxtLink
              v-for="c in k.items"
              :key="c.id"
              :to="`/konten/detail/${c.id}`"
              draggable="true"
              class="block cursor-grab rounded-field border border-default bg-default p-2.5 shadow-panel hover:border-accented"
              :class="seret === c.id ? 'opacity-50' : ''"
              @dragstart="seret = c.id"
              @dragend="seret = null; atas = null"
            >
              <p class="truncate text-[11px] text-muted">
                {{ [namaBrand(c.brand), contentPlatforms(c).slice(0, 2).join(' · ')].filter(Boolean).join(' · ') }}
              </p>
              <p class="mt-0.5 line-clamp-2 text-sm font-semibold text-highlighted">
                {{ c.title || '(tanpa judul)' }}
              </p>
              <div class="mt-2 flex items-center justify-between gap-2">
                <KontenDeadline
                  :tgl="c.deadline"
                  :selesai="sudahArsip(c)"
                />
                <span
                  v-if="c.pic"
                  class="flex size-6 items-center justify-center rounded-md bg-primary-100 text-[10px] font-bold text-primary-800"
                  :title="namaUser(c.pic)"
                >{{ inisial(namaUser(c.pic) || '?') }}</span>
                <UBadge
                  v-else
                  label="Belum ada PIC"
                  color="neutral"
                  variant="soft"
                  size="sm"
                />
              </div>
            </NuxtLink>
            <p
              v-if="!k.items.length"
              class="py-4 text-center text-xs text-dimmed"
            >
              -
            </p>
          </div>
        </section>
      </div>

      <!-- Phone: grouped list. -->
      <div class="space-y-3 lg:hidden">
        <AppPanel
          v-for="k in kolom.filter(x => x.items.length)"
          :key="k.s"
          flush
        >
          <template #head>
            <div class="flex items-center gap-2 px-4 pt-3">
              <AppStatus
                :color="warnaStatusKonten(k.s)"
                :icon="ikonStatusKonten(k.s)"
                size="sm"
              >
                {{ k.s }}
              </AppStatus>
              <span class="num text-xs text-muted">{{ k.items.length }}</span>
            </div>
          </template>
          <ul class="divide-y divide-default">
            <li
              v-for="c in k.items"
              :key="c.id"
            >
              <NuxtLink
                :to="`/konten/detail/${c.id}`"
                class="flex items-start justify-between gap-2 p-4 hover:bg-muted"
              >
                <div class="min-w-0">
                  <b class="text-highlighted">{{ c.title || '(tanpa judul)' }}</b>
                  <p class="text-xs text-muted">
                    {{ [namaBrand(c.brand), contentPlatforms(c).join(' · '), namaUser(c.pic).split(' ')[0] || 'Belum ada PIC'].filter(Boolean).join(' · ') }}
                  </p>
                </div>
                <KontenDeadline
                  :tgl="c.deadline"
                  :selesai="sudahArsip(c)"
                />
              </NuxtLink>
            </li>
          </ul>
        </AppPanel>
        <p
          v-if="!tersaring.length"
          class="p-6 text-center text-sm text-muted"
        >
          Belum ada konten.
        </p>
      </div>
    </AppPage>
  </KontenGerbang>
</template>
