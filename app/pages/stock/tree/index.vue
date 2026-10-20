<!--
  Stock › Pohon Resep (old `deploy/stock/tree/index.html`, read-only).

  The recipe graph rebuilt live from v1 (`GET /stock/hpp/ingredients` +
  `/recipes`, module `tree`) — the old page shipped it embedded with a build
  date. Sidebar: menu search + material search + menu list per category, a dot
  marks menus with a data gap. Main: the dish tree (amber prep rows expand,
  green rows are raw materials, quantities per one batch of each prep step);
  clicking a raw material opens where it is used. Stats: menus, raw
  materials, links, and rows missing a measure (clicking filters the flagged
  menus). Engine: `~/utils/pohon-resep` (T-18).
-->
<script setup lang="ts">
import { getHppRecipes, useBahanHpp } from '~/composables/useStock'
import { bangunMenu, fmtQtyPohon, indeksPohon, pohonPunyaFlag, statPohon, whereusedPohon, type KindPohon, type MenuPohon, type NodePohon } from '~/utils/pohon-resep'

definePageMeta({ access: ['tree'] })

const KIND_LABEL: Record<KindPohon, string> = {
  menu: 'Menu',
  root: 'Mentah',
  wip: 'Olahan',
  wip_noyield: 'Tanpa yield',
  mismatch: 'Satuan beda',
  unmapped: 'Belum petakan',
  implausible: 'Qty janggal',
  storebought: 'Beli jadi',
}
const KIND_WARNA: Record<KindPohon, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  menu: 'neutral',
  root: 'success',
  wip: 'warning',
  wip_noyield: 'error',
  mismatch: 'error',
  unmapped: 'error',
  implausible: 'error',
  storebought: 'info',
}

const { data: bahanData, error: bahanError } = useBahanHpp()
const { data: resepData, error: resepError, refresh } = useAsyncData('stock-tree-resep', () => getHppRecipes())

const sumber = computed(() => indeksPohon(resepData.value?.rows ?? [], bahanData.value?.rows ?? []))
const semuaMenu = computed<MenuPohon[]>(() => bangunMenu(sumber.value, resepData.value?.rows ?? []))
const dipakai = computed(() => whereusedPohon(semuaMenu.value))
const stat = computed(() => statPohon(semuaMenu.value))

const cariMenu = ref('')
const hanyaFlag = ref(false)
const daftarMenu = computed(() => {
  const q = cariMenu.value.trim().toUpperCase().replace(/\s+/g, ' ')
  let list = semuaMenu.value
  if (hanyaFlag.value) list = list.filter(m => pohonPunyaFlag(m.tree))
  else if (q) list = list.filter(m => m.name.toUpperCase().replace(/\s+/g, ' ').includes(q))
  const grup = new Map<string, MenuPohon[]>()
  for (const m of list) {
    const g = grup.get(m.category) ?? []
    g.push(m)
    grup.set(m.category, g)
  }
  return [...grup.entries()].sort((a, b) => a[0].localeCompare(b[0], 'id'))
})

const aktif = ref<string | null>(null)
const menuAktif = computed(() => semuaMenu.value.find(m => m.name === aktif.value) ?? null)
watch(semuaMenu, (list) => {
  if (!list.length) {
    aktif.value = null
    return
  }
  if (!list.some(m => m.name === aktif.value)) aktif.value = list[0]!.name
}, { immediate: true })

function pilihMenu(nama: string) {
  aktif.value = nama
  tutupLaci()
}

// Collapsed branches, keyed by the path of names from the dish root.
const tutup = ref<Set<string>>(new Set())
watch(aktif, () => {
  tutup.value = new Set()
})
interface BarisPohon { node: NodePohon, dalam: number, path: string, punyaAnak: boolean, tertutup: boolean }
const baris = computed<BarisPohon[]>(() => {
  const out: BarisPohon[] = []
  const m = menuAktif.value
  if (!m) return out
  const jalan = (n: NodePohon, dalam: number, path: string) => {
    const punyaAnak = n.children.length > 0
    const tertutup = tutup.value.has(path)
    out.push({ node: n, dalam, path, punyaAnak, tertutup })
    if (punyaAnak && !tertutup) n.children.forEach(c => jalan(c, dalam + 1, `${path}|${c.name}`))
  }
  m.tree.children.forEach(c => jalan(c, 0, c.name))
  return out
})
function lipat(path: string) {
  const s = new Set(tutup.value)
  if (s.has(path)) s.delete(path)
  else s.add(path)
  tutup.value = s
}

// ---- material search ----
const cariBahan = ref('')
const cocokBahan = computed(() => {
  const q = cariBahan.value.trim().toUpperCase().replace(/\s+/g, ' ')
  if (!q) return []
  return Object.keys(dipakai.value).filter(n => n.toUpperCase().replace(/\s+/g, ' ').includes(q)).sort().slice(0, 30)
})

// ---- where-used sheet (the old right drawer) ----
const laciBahan = ref<string | null>(null)
const laciBuka = ref(false)
const laciPakai = computed(() => (laciBahan.value ? dipakai.value[laciBahan.value] ?? [] : []))
const laciMaks = computed(() => Math.max(...laciPakai.value.map(u => Number(u.qty) || 0), 1))
function bukaLaci(nama: string) {
  laciBahan.value = nama
  laciBuka.value = true
  cariBahan.value = ''
}
function tutupLaci() {
  laciBuka.value = false
}
function dariLaciKeMenu(menu: string) {
  tutupLaci()
  pilihMenu(menu)
}
</script>

<template>
  <AppPage
    title="Pohon resep"
    description="Rincian tiap menu makanan yang aktif, turun lewat WIP sampai ke bahan mentah."
  >
    <template #actions>
      <UButton
        label="Segarkan"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        size="sm"
        @click="refresh()"
      />
    </template>

    <UAlert
      v-if="bahanError || resepError"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(bahanError || resepError)}`"
    />

    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Menu"
          icon="i-lucide-book-open"
          :value="stat.menu"
          sub="resep menu jadi aktif"
        />
        <AppStat
          label="Bahan mentah"
          icon="i-lucide-carrot"
          :value="stat.mentah"
          sub="nama bahan berbeda"
        />
        <AppStat
          label="Sambungan"
          icon="i-lucide-git-fork"
          :value="stat.sambungan"
          sub="baris bahan ke resep"
        />
        <button
          v-if="stat.tanpaTakaran"
          type="button"
          class="text-start"
          title="Saring menu bermasalah"
          @click="() => { hanyaFlag = !hanyaFlag }"
        >
          <AppStat
            label="Takaran belum ada"
            icon="i-lucide-triangle-alert"
            :value="stat.tanpaTakaran"
            sub="klik untuk saring menu bermasalah"
            tone="error"
          />
        </button>
        <AppStat
          v-else
          label="Takaran belum ada"
          icon="i-lucide-triangle-alert"
          :value="0"
          sub="semua takaran lengkap"
          tone="success"
        />
      </AppStatGrid>
      <p class="mb-4 text-[12px] text-muted">
        Data live dari API — kalau resep atau menu berubah, pohon ini ikut berubah.
      </p>

      <div class="grid items-start gap-4 lg:grid-cols-[270px_1fr]">
        <AppPanel
          title="Menu"
          flush
        >
          <div class="border-b border-default p-3">
            <UInput
              v-model="cariMenu"
              icon="i-lucide-search"
              placeholder="Cari menu…"
              size="sm"
              class="w-full"
              @update:model-value="() => { hanyaFlag = false }"
            />
          </div>
          <div class="relative border-b border-default p-3 pt-1.5">
            <UInput
              v-model="cariBahan"
              icon="i-lucide-search"
              placeholder="Cari bahan…"
              size="sm"
              class="w-full"
            />
            <div
              v-if="cariBahan.trim()"
              class="absolute inset-x-3 top-full z-20 max-h-64 overflow-y-auto rounded-field border border-default bg-default p-1 shadow-panel"
            >
              <button
                v-for="n in cocokBahan"
                :key="n"
                type="button"
                class="flex w-full items-center justify-between gap-2 rounded-field px-2.5 py-1.5 text-start text-[13px] hover:bg-elevated/60"
                @click="bukaLaci(n)"
              >
                <b class="text-highlighted">{{ n }}</b>
                <span class="shrink-0 text-[11px] text-muted">{{ (dipakai[n] ?? []).length }} menu</span>
              </button>
              <p
                v-if="!cocokBahan.length"
                class="px-2.5 py-2 text-[12px] text-muted"
              >
                Tidak ada bahan yang cocok.
              </p>
            </div>
          </div>
          <div class="max-h-[50vh] overflow-y-auto p-1.5 lg:max-h-[calc(100vh-320px)]">
            <p
              v-if="hanyaFlag"
              class="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-error"
            >
              Menu dengan data belum lengkap
              <UButton
                label="Tampilkan semua"
                size="xs"
                color="neutral"
                variant="ghost"
                class="ml-1"
                @click="hanyaFlag = false"
              />
            </p>
            <template
              v-for="[kat, isi] in daftarMenu"
              :key="kat"
            >
              <p class="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                {{ kat }}
              </p>
              <button
                v-for="m in isi"
                :key="m.name"
                type="button"
                :class="[
                  'flex w-full items-center gap-2 rounded-field px-2.5 py-1.5 text-start text-[13px]',
                  m.name === aktif ? 'bg-primary-100 font-semibold text-highlighted' : 'hover:bg-elevated/60',
                ]"
                @click="pilihMenu(m.name)"
              >
                <span
                  v-if="pohonPunyaFlag(m.tree)"
                  class="size-1.5 shrink-0 rounded-full bg-error"
                  title="Ada data belum lengkap"
                />
                <span class="min-w-0 flex-1 truncate">{{ m.name }}</span>
              </button>
            </template>
            <p
              v-if="!daftarMenu.length"
              class="px-2.5 py-6 text-center text-[12px] text-muted"
            >
              Tidak ada menu yang cocok.
            </p>
          </div>
        </AppPanel>

        <AppPanel
          :title="menuAktif?.name ?? 'Pilih menu'"
          :description="menuAktif ? menuAktif.category : ''"
          flush
        >
          <div class="flex flex-wrap gap-x-3 gap-y-1 border-b border-default px-4 py-2.5 text-[11px] text-muted lg:px-5">
            <span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-sm bg-warning" />Olahan setengah jadi</span>
            <span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-sm bg-success" />Bahan mentah</span>
            <span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-sm bg-info" />Beli jadi</span>
            <span class="inline-flex items-center gap-1.5"><span class="size-2 rounded-sm bg-error" />Data belum lengkap</span>
          </div>
          <div
            v-if="menuAktif && baris.length"
            class="px-2 py-2"
          >
            <div
              v-for="b in baris"
              :key="b.path"
              :class="b.dalam > 0 && 'ml-5 border-l border-default'"
            >
              <div class="flex items-center gap-2 rounded-field px-2 py-1 hover:bg-elevated/60">
                <UButton
                  :icon="b.tertutup ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :disabled="!b.punyaAnak"
                  :class="!b.punyaAnak && 'invisible'"
                  @click="lipat(b.path)"
                />
                <AppStatus
                  :color="KIND_WARNA[b.node.kind]"
                  size="sm"
                >
                  {{ KIND_LABEL[b.node.kind] }}
                </AppStatus>
                <button
                  v-if="b.node.kind === 'root'"
                  type="button"
                  class="min-w-0 flex-1 truncate text-start text-sm underline decoration-default underline-offset-2 hover:decoration-primary"
                  @click="bukaLaci(b.node.name)"
                >
                  {{ b.node.name }}
                </button>
                <span
                  v-else
                  class="min-w-0 flex-1 truncate text-sm text-highlighted"
                >{{ b.node.name }}</span>
                <span class="shrink-0 text-[12px] text-muted num">{{ fmtQtyPohon(b.node.qty) }} {{ b.node.unit }}</span>
              </div>
            </div>
          </div>
          <p
            v-else-if="menuAktif"
            class="px-4 py-10 text-center text-sm text-muted"
          >
            Menu ini beli jadi atau belum punya resep — ia direstock apa adanya.
          </p>
          <p
            v-else
            class="px-4 py-10 text-center text-sm text-muted"
          >
            Pilih menu di sebelah kiri untuk melihat rincian bahannya.
            Takaran per satu batch tiap tahap olahan, seperti tertulis di resep.
          </p>
        </AppPanel>
      </div>

      <ResponsiveSheet
        v-model:open="laciBuka"
        title="Dipakai di menu"
      >
        <template #default>
          <b class="text-highlighted">{{ laciBahan }}</b>
          <p class="mb-3 text-sm text-muted">
            Dipakai di <b>{{ laciPakai.length }} menu</b> · takaran per saji, dalam satuan resepnya.
          </p>
          <div
            v-if="laciPakai.length"
            class="divide-y divide-default"
          >
            <button
              v-for="u in laciPakai"
              :key="u.menu"
              type="button"
              class="flex w-full items-center justify-between gap-3 py-2 text-start"
              @click="dariLaciKeMenu(u.menu)"
            >
              <span class="min-w-0 flex-1">
                <b class="block truncate text-sm text-highlighted">{{ u.menu }}</b>
                <span
                  class="block h-1 rounded-full bg-primary/50"
                  :style="{ width: `${Math.max(6, 100 * (Number(u.qty) || 0) / laciMaks)}%` }"
                />
              </span>
              <span class="shrink-0 text-[12px] text-muted num">{{ fmtQtyPohon(u.qty) }} {{ u.unit }}</span>
            </button>
          </div>
          <p
            v-else
            class="py-4 text-center text-sm text-muted"
          >
            Tidak dipakai menu mana pun.
          </p>
        </template>
      </ResponsiveSheet>
    </template>
  </AppPage>
</template>
