<!--
  Konten › Pipeline (old VIEWS.pipeline + kDrop, deploy/konten/index.html:2532-2568;
  konten.md D.3). Shared AppKanban over the ten pipeline steps; dragging a card to another
  column sets its status (needs edit on `content`; moving into Approval
  notifies). The board scrolls inside its own box, not the page.

  On phones the board scrolls horizontally; status changes use the detail page.
  PIC filter: counts over ACTIVE content (not Cancelled), "Belum ada PIC" = __none__.
-->
<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { KontenItem } from '~/utils/konten'
import { PIPELINE_KONTEN, contentPlatforms, opsiPicKonten, picCocok, sudahArsip } from '~/utils/konten'
import { ikonStatusKonten, warnaStatusKonten } from '~/utils/status-konten'

definePageMeta({ access: ['konten'] })

const { data: st, error, status } = useStateKonten()
const { saya, can } = useAksesKonten()
const brand = useBrandKonten()
const pic = useState('konten-pipe-pic', () => '')
const desktop = useMediaQuery('(min-width: 1024px)')
const route = useRoute()
const demo = computed(() => import.meta.dev && route.query.demo === '1')
const contoh: KontenItem[] = [
  { id: 'demo-1', title: 'Ide konten menu akhir pekan', status: 'Idea', platform: 'IG' },
  { id: 'demo-2', title: 'Riset tren video live music', status: 'Research', platform: 'TT' },
  { id: 'demo-3', title: 'Storyboard suasana senja', status: 'Script', platform: 'IG' },
  { id: 'demo-4', title: 'Poster agenda November', status: 'Design', platform: 'IG' },
  { id: 'demo-5', title: 'Rekam behind the scenes', status: 'Shooting', platform: 'TT' },
  { id: 'demo-6', title: 'Edit cuplikan penampilan band', status: 'Editing', platform: 'TT' },
  { id: 'demo-7', title: 'Reels menu favorit tamu', status: 'Approval', platform: 'IG' },
]
const toast = useToast()

const SEMUA = '__semua'
const fPic = computed({ get: () => pic.value || SEMUA, set: (v: string) => {
  pic.value = v === SEMUA ? '' : v
} })

const dasar = computed(() => demo.value ? contoh : saringBrand(st.value.content, brand.value))
const tersaring = computed(() => demo.value ? dasar.value : dasar.value.filter(c => picCocok(pic.value, c.pic)))
const aktif = computed(() => dasar.value.filter(c => c.status !== 'Cancelled'))
const nAktif = computed(() => tersaring.value.filter(c => c.status !== 'Cancelled').length)
const opsiPic = computed(() => opsiPicKonten(
  st.value.users,
  id => (id == null ? aktif.value.length : aktif.value.filter(c => picCocok(id, c.pic)).length),
  saya.value?.user.id,
).map(o => ({ ...o, value: o.value || SEMUA })))
const kolom = computed(() => PIPELINE_KONTEN.map(s => ({ s, items: tersaring.value.filter(c => c.status === s) })))
const kolomKanban = computed(() => kolom.value.map(k => ({ id: k.s, title: k.s, items: k.items })))

const detailId = ref('')
const detailBuka = ref(false)
const detailKonten = computed(() => tersaring.value.find(c => c.id === detailId.value))
const namaBrand = (id?: string) => st.value.brands.find(b => b.id === id)?.name.split(' (')[0] ?? ''
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? ''
const inisial = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()

// ---- board moves (drag state lives in AppKanban; guards + save stay here) ----
function alihKartu(id: string, telan: () => boolean) {
  // A click fires right after a drop on the same card — swallow it once.
  if (demo.value || telan()) return
  detailId.value = id
  detailBuka.value = true
}
async function lepas(p: { id: string, to: string }) {
  if (demo.value) return
  const col = p.to
  if (!can('content')) return toast.add({ title: 'Tidak punya akses ubah status', color: 'error' })
  const c = st.value.content.find(x => x.id === p.id)
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
        v-if="can('content') && !demo"
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

      <UAlert
        v-if="demo"
        title="Data contoh Pipeline"
        description="Mode pratinjau. Kartu contoh tidak tersimpan atau bisa dipindahkan."
        color="info"
        variant="subtle"
        class="mb-4"
      />
      <KontenBrandBar
        v-else
        :brands="st.brands"
      />

      <AppPanel v-if="!demo">
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

      <!-- Loading board mirrors the kanban columns below. -->
      <div
        v-if="status === 'pending' && !st.content.length"
        class="hidden gap-3 lg:grid lg:grid-cols-5"
        aria-hidden="true"
      >
        <div
          v-for="i in 5"
          :key="i"
          class="space-y-2 rounded-panel border border-default bg-default p-2"
        >
          <USkeleton class="h-6 w-2/3" />
          <USkeleton class="h-16 w-full" />
          <USkeleton class="h-16 w-full" />
        </div>
      </div>
      <!-- Desktop: shared board (AppKanban owns the drag state). -->
      <div
        class="min-w-0"
        :class="status === 'pending' ? 'opacity-60' : ''"
      >
        <AppKanban
          :columns="kolomKanban"
          :can-drag="desktop && can('content') && !demo"
          drag-reason="Kamu tidak punya izin mengubah status konten."
          :layout="desktop ? 'grid' : 'scroll'"
          empty-text="-"
          list-class="max-h-[min(68dvh,640px)]"
          @move="lepas"
        >
          <template #header="{ column }">
            <AppStatus
              :color="warnaStatusKonten(column.id)"
              :icon="ikonStatusKonten(column.id)"
              size="sm"
            >
              {{ column.title }}
            </AppStatus>
            <span class="num ml-auto rounded-full bg-muted px-2 text-xs font-bold">{{ column.items.length }}</span>
          </template>
          <template #card="{ item, dragging, canDrag: bolehSeret, dragReason: alasanSeret, dragStart, dragEnd, swallowClick }">
            <AppKanbanCard
              :dragging="dragging"
              :can-drag="bolehSeret"
              :drag-reason="alasanSeret"
              @dragstart="dragStart"
              @dragend="dragEnd"
              @card-click="alihKartu(item.id, swallowClick)"
            >
              <template #title>
                <p class="truncate text-[11px] font-normal text-muted">
                  {{ [namaBrand(item.brand), contentPlatforms(item).slice(0, 2).join(' · ')].filter(Boolean).join(' · ') }}
                </p>
                <p class="mt-0.5 line-clamp-2 text-sm font-semibold text-highlighted">
                  {{ item.title || '(tanpa judul)' }}
                </p>
              </template>
              <template #meta>
                <div class="mt-2 flex items-center justify-between gap-2">
                  <KontenDeadline
                    :tgl="item.deadline"
                    :selesai="sudahArsip(item)"
                  />
                  <span
                    v-if="item.pic"
                    class="flex size-6 items-center justify-center rounded-md bg-primary-100 text-[10px] font-bold text-primary-800"
                    :title="namaUser(item.pic)"
                  >{{ inisial(namaUser(item.pic) || '?') }}</span>
                  <UBadge
                    v-else
                    label="Belum ada PIC"
                    color="neutral"
                    variant="soft"
                    size="sm"
                  />
                </div>
              </template>
            </AppKanbanCard>
          </template>
        </AppKanban>
      </div>
      <ResponsiveSheet
        v-model:open="detailBuka"
        :title="detailKonten?.title || 'Detail konten'"
        :description="detailKonten ? contentPlatforms(detailKonten).join(' / ') : ''"
      >
        <dl
          v-if="detailKonten"
          class="grid grid-cols-2 gap-3 text-sm"
        >
          <div>
            <dt class="text-muted">
              Tahap
            </dt>
            <dd>{{ detailKonten.status || '-' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Tenggat
            </dt>
            <dd>
              <KontenDeadline
                :tgl="detailKonten.deadline"
                :selesai="sudahArsip(detailKonten)"
              />
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Brand
            </dt>
            <dd>{{ namaBrand(detailKonten.brand) || '-' }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              PIC
            </dt>
            <dd>{{ namaUser(detailKonten.pic) || 'Belum ada PIC' }}</dd>
          </div>
        </dl>
        <template #footer>
          <UButton
            v-if="detailKonten"
            label="Buka detail lengkap"
            icon="i-lucide-arrow-right"
            :to="'/konten/detail/' + detailKonten.id"
          />
        </template>
      </ResponsiveSheet>
    </AppPage>
  </KontenGerbang>
</template>
