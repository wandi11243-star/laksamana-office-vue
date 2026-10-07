<!--
  Performa Konten (old pkPanelKonten, deploy/assets/performa-konten.js:609-783;
  konten.md D.12). Every number comes from app/utils/performa-konten.ts — the
  same functions the Analytics module uses (#20). Pass the posts already
  filtered by brand; `kunci` keeps the choices (month, platform, sort, search)
  per host so Konten and Analytics don't share them.

  Order as the old page: controls → Jumlah post → (no figures? say so, stop)
  → 8 cards → notices (not filled / old records / unlisted platforms) → per
  platform → content pillar → top konten (its own search, which only filters
  that table — said on screen).
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AggPk, GrupPk, KontenPk, UrutPk } from '~/utils/performa-konten'
import type { KontenItem } from '~/utils/konten'
import {
  PK_TANPA_PILLAR, PK_URUT, pkAggCTR, pkAggER, pkAggViral, pkBulanKonten, pkHitungPost, pkKumpul, pkNamaBulan,
  pkPerPillar, pkPerPlatform, pkPersen, pkTotal, pkUrutKonten,
} from '~/utils/performa-konten'
import { angka } from '~/utils/format'

// `tautan` = titles link to the Konten detail page (a host without Konten access passes false)
const props = withDefaults(defineProps<{ content: KontenItem[], kunci?: string, tautan?: boolean }>(), { kunci: 'konten-pk', tautan: true })

const st = useKeadaanPk(props.kunci)

const tapis = computed(() => ({ bulan: st.value.bulan, plat: st.value.plat }))
const k = computed(() => pkKumpul(props.content, tapis.value))
const tot = computed(() => pkTotal(k.value))
const platAda = computed(() => pkPerPlatform(pkKumpul(props.content, { bulan: st.value.bulan }).baris))
const jp = computed(() => pkHitungPost(props.content, tapis.value))
const perPlat = computed(() => pkPerPlatform(k.value.baris))
const perPil = computed(() => pkPerPillar(k.value.konten))
const top = computed(() => pkUrutKonten(pkKumpul(props.content, { ...tapis.value, cari: st.value.cari }).konten, st.value.urut))

// ---- controls
const SEMUA = '__semua'
const opsiBulan = computed(() => {
  const l = Object.keys(k.value.bulanAda).sort().reverse()
  const out = [{ value: SEMUA, label: 'Semua bulan' }, ...l.map(b => ({ value: b, label: pkNamaBulan(b) }))]
  // the chosen month may have no data (it is shared with Performa Desain): still shown, marked
  if (st.value.bulan && !l.includes(st.value.bulan)) out.push({ value: st.value.bulan, label: `${pkNamaBulan(st.value.bulan)} — tidak ada data` })
  return out
})
const bulan = computed({
  get: () => st.value.bulan || SEMUA,
  set: (v: string) => {
    st.value.bulan = v === SEMUA ? '' : v
  },
})
const opsiPlat = computed(() => [{ value: '', label: 'Semua Platform' }, ...platAda.value.map(p => ({ value: p.nama, label: p.nama }))])
const plat = computed({
  get: () => st.value.plat,
  set: (v: string) => {
    st.value.plat = v
  },
})
const opsiUrut = (Object.keys(PK_URUT) as UrutPk[]).map(u => ({ value: u, label: PK_URUT[u].t }))
const urut = computed({
  get: () => st.value.urut,
  set: (v: UrutPk) => {
    st.value.urut = v
  },
})

// ---- cells
const pct = (v: number | null) => (v == null ? '—' : `${pkPersen(v)}%`)
/** A ratio cell carries its own denominator: the header scrolls away, the number stays. */
const dari = (v: number | null, a: AggPk) => (v == null ? 'reach belum diisi' : `dari ${angka(a.dasar)} ${a.dasarImpr > 0 ? 'reach/impression' : 'reach'}`)
const penyebut = computed(() => `${angka(tot.value.dasar)} ${tot.value.dasarImpr ? 'reach/impression' : 'reach'}`)

const R = { th: 'text-right', td: 'text-right' }
const kolomGrup = (nama: string, extra: boolean): TableColumn<GrupPk>[] => [
  { id: 'nama', header: nama },
  { id: 'n', header: 'Konten', meta: { class: R } },
  { id: 'reach', header: 'Reach', meta: { class: R } },
  ...(extra ? [{ id: 'impr', header: 'Impression', meta: { class: R } }] : []),
  { id: 'eng', header: 'Engagement', meta: { class: R } },
  { id: 'er', header: 'Engagement Rate', meta: { class: R } },
  { id: 'viral', header: 'Virality Index', meta: { class: R } },
  { id: 'cta', header: 'CTA Click Rate', meta: { class: R } },
  ...(extra ? [{ id: 'follow', header: 'Follower Baru', meta: { class: R } }] : []),
]
const kolomPlat = kolomGrup('Platform', true)
const kolomPil = kolomGrup('Content Pillar', false)
const kolomTop: TableColumn<KontenPk>[] = [
  { id: 'no', header: '#' },
  { id: 'konten', header: 'Konten' },
  { id: 'plat', header: 'Platform' },
  { id: 'pillar', header: 'Content Pillar' },
  { id: 'reach', header: 'Reach', meta: { class: R } },
  { id: 'impr', header: 'Impression', meta: { class: R } },
  { id: 'eng', header: 'Engagement', meta: { class: R } },
  { id: 'er', header: 'Engagement Rate', meta: { class: R } },
  { id: 'viral', header: 'Virality Index', meta: { class: R } },
  { id: 'cta', header: 'CTA Click Rate', meta: { class: R } },
]
const rasio = (a: AggPk) => [
  { t: 'ER', v: pkAggER(a) },
  { t: 'Viral', v: pkAggViral(a) },
  { t: 'CTA', v: pkAggCTR(a) },
]
</script>

<template>
  <div>
    <AppPanel>
      <div class="flex flex-wrap items-center gap-3">
        <USelect
          v-model="bulan"
          :items="opsiBulan"
          aria-label="Pilih bulan"
          class="w-full sm:w-56"
        />
        <AppSeg
          v-model="plat"
          :options="opsiPlat"
          size="sm"
        />
      </div>
      <p class="mt-3 text-sm text-muted">
        <b>Jumlah post</b> di bawah menghitung seluruh konten berstatus <b>Posted</b>. Angka performa (reach,
        engagement, dll.) <b>tidak wajib</b> diisi — kartu-kartu performa hanya memakai konten yang angkanya sudah
        diisi. Semua platform yang didaftarkan tim konten ikut — angkanya dicatat per platform, jadi satu konten yang
        tayang di dua platform punya dua catatan.
      </p>
    </AppPanel>

    <!-- Jumlah post -->
    <AppPanel
      :title="`Jumlah post — ${pkNamaBulan(st.bulan)}`"
      description="Dihitung dari konten berstatus Posted, tanpa menunggu angka performanya diisi. Satu konten yang tayang di dua platform dihitung di keduanya, jadi kolom platform boleh berjumlah lebih besar daripada total konten."
    >
      <p
        v-if="!jp.n"
        class="text-sm text-muted"
      >
        Belum ada konten berstatus Posted pada periode ini.
      </p>
      <template v-else>
        <AppStatGrid>
          <AppStat
            label="Total konten tayang"
            :value="angka(jp.n)"
            sub="konten unik berstatus Posted"
          />
          <AppStat
            v-for="p in jp.daftarPlat.slice(0, 3)"
            :key="p"
            :label="`Post ${p}`"
            :value="angka(jp.plat[p])"
            tone="info"
          />
        </AppStatGrid>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs text-muted">
                <th class="py-2 pe-3 font-semibold">
                  Content type
                </th>
                <th
                  v-for="p in jp.daftarPlat"
                  :key="p"
                  class="px-3 py-2 text-right font-semibold"
                >
                  {{ p }}
                </th>
                <th class="ps-3 py-2 text-right font-semibold">
                  Total konten
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="t in jp.daftarTipe"
                :key="t"
              >
                <td class="py-2 pe-3 font-semibold">
                  {{ t }}
                </td>
                <td
                  v-for="p in jp.daftarPlat"
                  :key="p"
                  class="num px-3 py-2 text-right"
                >
                  {{ jp.sel[`${t}\u0001${p}`] ? angka(jp.sel[`${t}\u0001${p}`]) : '—' }}
                </td>
                <td class="num ps-3 py-2 text-right font-semibold">
                  {{ angka(jp.tipe[t]) }}
                </td>
              </tr>
              <tr class="font-semibold">
                <td class="py-2 pe-3">
                  Total post
                </td>
                <td
                  v-for="p in jp.daftarPlat"
                  :key="p"
                  class="num px-3 py-2 text-right"
                >
                  {{ angka(jp.plat[p]) }}
                </td>
                <td class="num ps-3 py-2 text-right">
                  {{ angka(jp.n) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </AppPanel>

    <UAlert
      v-if="!k.konten.length"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Belum ada angka performa pada periode ini — tidak wajib."
      :description="k.tayang
        ? `Ada ${k.tayang} konten berstatus Posted, tapi angkanya belum diisi. Isi lewat halaman Input Performa — reach, impression, likes, komentar, share, save, dan klik CTA per platform.`
        : 'Belum ada satu pun konten yang ditandai tayang.'"
    />

    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Reach"
          :value="angka(tot.reach)"
          :sub="`Akun berbeda yang melihat, dijumlahkan dari ${tot.n} konten`"
        />
        <AppStat
          label="Impression"
          :value="tot.impr ? angka(tot.impr) : '—'"
          :sub="tot.impr ? 'Berapa kali konten muncul — selalu lebih besar daripada reach' : 'Belum ada yang mengisi kolom impression'"
        />
        <AppStat
          label="Engagement Rate"
          :value="pct(pkAggER(tot))"
          :sub="`(likes + komentar + share + save) ÷ ${penyebut}`"
          tone="success"
        />
        <AppStat
          label="Virality Index"
          :value="pct(pkAggViral(tot))"
          :sub="`(share + save) ÷ ${angka(tot.dasar)} — yang membawa konten ke orang berikutnya`"
          tone="vip"
        />
        <AppStat
          label="CTA Click Rate"
          :value="pct(pkAggCTR(tot))"
          :sub="`${angka(tot.cta)} klik tautan / tombol ajakan`"
        />
        <AppStat
          label="Engagement"
          :value="angka(tot.eng)"
          :sub="`Likes ${angka(tot.likes)} · Komentar ${angka(tot.comments)} · Share ${angka(tot.shares)} · Save ${angka(tot.saves)}`"
        />
        <AppStat
          label="Views"
          :value="angka(tot.views)"
          sub="Penayangan video"
        />
        <AppStat
          label="Follower baru"
          :value="`+${angka(tot.follow)}`"
          :sub="`Pertambahan follower dari ${tot.n} konten`"
          tone="info"
        />
      </AppStatGrid>

      <UAlert
        v-if="k.tanpaData"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :description="`${k.tanpaData} konten tayang belum diisi performanya (tidak wajib) pada periode ini, jadi angkanya tidak ikut di halaman ini. Isi lewat halaman Input Performa.`"
        class="mb-5"
      />
      <UAlert
        v-if="k.warisan"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :description="`${k.warisan} konten memakai catatan performa lama yang tidak dipecah per platform. Angkanya IKUT di kartu, tabel pillar, dan peringkat konten, tapi SENGAJA tidak ikut di tabel per platform — memecahnya berarti menebak berapa bagian tiap platform, dan itu tidak pernah dicatat siapa pun.`"
        class="mb-5"
      />
      <UAlert
        v-if="k.lepas"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :description="`${k.lepas} catatan berada di platform yang sudah tidak terdaftar lagi di kontennya. Angkanya tetap dihitung — membuangnya membuat total halaman ini berubah sendiri tiap kali ada yang membetulkan daftar platform sebuah konten.`"
        class="mb-5"
      />

      <!-- Per platform -->
      <AppPanel
        title="Per platform"
        description="Satu konten yang tayang di dua platform dihitung di kedua-duanya, jadi kolom konten di sini boleh berjumlah lebih besar daripada jumlah konten di kartu atas."
        flush
      >
        <p
          v-if="!perPlat.length"
          class="p-6 text-center text-sm text-muted"
        >
          Belum ada catatan per platform pada periode ini.
        </p>
        <template v-else>
          <UTable
            class="hidden lg:block"
            :data="perPlat"
            :columns="kolomPlat"
          >
            <template #nama-cell="{ row }">
              <b>{{ row.original.nama }}</b>
            </template>
            <template #n-cell="{ row }">
              <span class="num">{{ row.original.a.n }}</span>
            </template>
            <template #reach-cell="{ row }">
              <span class="num">{{ angka(row.original.a.reach) }}</span>
            </template>
            <template #impr-cell="{ row }">
              <span class="num">{{ row.original.a.impr ? angka(row.original.a.impr) : '—' }}</span>
            </template>
            <template #eng-cell="{ row }">
              <span class="num">{{ angka(row.original.a.eng) }}</span>
            </template>
            <template #er-cell="{ row }">
              <b class="num">{{ pct(pkAggER(row.original.a)) }}</b>
              <span class="block text-[11px] text-muted">{{ dari(pkAggER(row.original.a), row.original.a) }}</span>
            </template>
            <template #viral-cell="{ row }">
              <b class="num">{{ pct(pkAggViral(row.original.a)) }}</b>
              <span class="block text-[11px] text-muted">{{ dari(pkAggViral(row.original.a), row.original.a) }}</span>
            </template>
            <template #cta-cell="{ row }">
              <b class="num">{{ pct(pkAggCTR(row.original.a)) }}</b>
              <span class="block text-[11px] text-muted">{{ dari(pkAggCTR(row.original.a), row.original.a) }}</span>
            </template>
            <template #follow-cell="{ row }">
              <span class="num">+{{ angka(row.original.a.follow) }}</span>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="p in perPlat"
              :key="p.nama"
              class="p-4 text-sm"
            >
              <b>{{ p.nama }}</b> <span class="text-xs text-muted">· {{ p.a.n }} konten</span>
              <p class="num mt-1">
                Reach {{ angka(p.a.reach) }} · Impr. {{ p.a.impr ? angka(p.a.impr) : '—' }} · Eng. {{ angka(p.a.eng) }} · Follower +{{ angka(p.a.follow) }}
              </p>
              <p class="num text-xs text-muted">
                <span
                  v-for="r in rasio(p.a)"
                  :key="r.t"
                  class="me-2"
                >{{ r.t }} {{ pct(r.v) }}</span>· {{ dari(pkAggER(p.a), p.a) }}
              </p>
            </li>
          </ul>
        </template>
      </AppPanel>

      <!-- Content pillar -->
      <AppPanel
        title="Content pillar performance"
        description="Pillar mana yang benar-benar menggerakkan orang, bukan cuma yang paling sering dibuat. Rasionya dihitung dengan menjumlahkan dulu lalu dibagi — bukan merata-rata persen tiap konten, yang akan memberi bobot sama kepada konten ber-reach 50 dan ber-reach 500.000."
        flush
      >
        <UTable
          class="hidden lg:block"
          :data="perPil"
          :columns="kolomPil"
        >
          <template #nama-cell="{ row }">
            <b>{{ row.original.nama }}</b>
            <span
              v-if="row.original.nama === PK_TANPA_PILLAR"
              class="block text-[11px] text-muted"
            >konten yang pillar-nya belum diisi — tidak ditebak</span>
          </template>
          <template #n-cell="{ row }">
            <span class="num">{{ row.original.a.n }}</span>
          </template>
          <template #reach-cell="{ row }">
            <span class="num">{{ angka(row.original.a.reach) }}</span>
          </template>
          <template #eng-cell="{ row }">
            <span class="num">{{ angka(row.original.a.eng) }}</span>
          </template>
          <template #er-cell="{ row }">
            <b class="num">{{ pct(pkAggER(row.original.a)) }}</b>
            <span class="block text-[11px] text-muted">{{ dari(pkAggER(row.original.a), row.original.a) }}</span>
          </template>
          <template #viral-cell="{ row }">
            <b class="num">{{ pct(pkAggViral(row.original.a)) }}</b>
            <span class="block text-[11px] text-muted">{{ dari(pkAggViral(row.original.a), row.original.a) }}</span>
          </template>
          <template #cta-cell="{ row }">
            <b class="num">{{ pct(pkAggCTR(row.original.a)) }}</b>
            <span class="block text-[11px] text-muted">{{ dari(pkAggCTR(row.original.a), row.original.a) }}</span>
          </template>
        </UTable>
        <ul class="divide-y divide-default lg:hidden">
          <li
            v-for="p in perPil"
            :key="p.nama"
            class="p-4 text-sm"
          >
            <b>{{ p.nama }}</b> <span class="text-xs text-muted">· {{ p.a.n }} konten</span>
            <p class="num mt-1">
              Reach {{ angka(p.a.reach) }} · Eng. {{ angka(p.a.eng) }}
            </p>
            <p class="num text-xs text-muted">
              <span
                v-for="r in rasio(p.a)"
                :key="r.t"
                class="me-2"
              >{{ r.t }} {{ pct(r.v) }}</span>· {{ dari(pkAggER(p.a), p.a) }}
            </p>
          </li>
        </ul>
      </AppPanel>

      <!-- Top konten -->
      <AppPanel
        title="Top konten"
        flush
      >
        <div class="space-y-3 border-b border-default p-4">
          <UInput
            v-model="st.cari"
            type="search"
            placeholder="Cari judul, pillar, platform…"
            icon="i-lucide-search"
            class="w-full sm:w-72"
          />
          <p class="text-xs text-muted">
            Kotak cari ini hanya menyaring tabel di bawahnya — kartu dan kedua tabel di atas tetap menghitung seluruh periode.
          </p>
          <AppSeg
            v-model="urut"
            :options="opsiUrut"
            size="sm"
          />
          <p class="text-xs text-muted">
            Diurut menurut <b>{{ PK_URUT[st.urut].t }}</b>.
            {{ st.urut === 'reach'
              ? 'Yang teratas konten yang paling banyak dilihat — belum tentu yang paling menggerakkan orang.'
              : 'Diurut menurut RASIO, jadi konten ber-reach kecil bisa berdiri di atas. Reach-nya ikut dipajang di kolom sebelah supaya itu terlihat — tidak ada batas minimum yang diam-diam membuang konten dari daftar ini.' }}
          </p>
        </div>
        <p
          v-if="!top.length"
          class="p-6 text-center text-sm text-muted"
        >
          {{ st.cari ? `Tidak ada konten yang cocok dengan "${st.cari}".` : 'Belum ada konten tayang yang performanya sudah diisi pada periode ini.' }}
        </p>
        <template v-else>
          <UTable
            class="hidden lg:block"
            :data="top"
            :columns="kolomTop"
          >
            <template #no-cell="{ row }">
              <span class="num">{{ row.index + 1 }}</span>
            </template>
            <template #konten-cell="{ row }">
              <NuxtLink
                v-if="tautan"
                :to="`/konten/detail/${row.original.c.id}`"
                class="font-semibold text-highlighted hover:underline"
              >
                {{ row.original.c.title || '(tanpa judul)' }}
              </NuxtLink>
              <b v-else>{{ row.original.c.title || '(tanpa judul)' }}</b>
              <span class="block text-[11px] text-muted">{{ pkBulanKonten(row.original.c) ? pkNamaBulan(pkBulanKonten(row.original.c)) : 'tanggal tayang belum dicatat' }}</span>
            </template>
            <template #plat-cell="{ row }">
              <span class="flex flex-wrap gap-1">
                <UBadge
                  v-for="p in row.original.plat"
                  :key="p"
                  :label="p"
                  color="neutral"
                  variant="soft"
                  size="sm"
                />
              </span>
            </template>
            <template #pillar-cell="{ row }">
              {{ String(row.original.c.pillar || '').trim() || PK_TANPA_PILLAR }}
            </template>
            <template #reach-cell="{ row }">
              <span class="num">{{ angka(row.original.agg.reach) }}</span>
            </template>
            <template #impr-cell="{ row }">
              <span class="num">{{ row.original.agg.impr ? angka(row.original.agg.impr) : '—' }}</span>
            </template>
            <template #eng-cell="{ row }">
              <span class="num">{{ angka(row.original.agg.eng) }}</span>
            </template>
            <template #er-cell="{ row }">
              <b class="num">{{ pct(pkAggER(row.original.agg)) }}</b>
              <span class="block text-[11px] text-muted">{{ dari(pkAggER(row.original.agg), row.original.agg) }}</span>
            </template>
            <template #viral-cell="{ row }">
              <b class="num">{{ pct(pkAggViral(row.original.agg)) }}</b>
              <span class="block text-[11px] text-muted">{{ dari(pkAggViral(row.original.agg), row.original.agg) }}</span>
            </template>
            <template #cta-cell="{ row }">
              <b class="num">{{ pct(pkAggCTR(row.original.agg)) }}</b>
              <span class="block text-[11px] text-muted">{{ dari(pkAggCTR(row.original.agg), row.original.agg) }}</span>
            </template>
          </UTable>
          <ul class="divide-y divide-default lg:hidden">
            <li
              v-for="(x, i) in top"
              :key="x.c.id"
              class="p-4 text-sm"
            >
              <NuxtLink
                v-if="tautan"
                :to="`/konten/detail/${x.c.id}`"
                class="font-semibold text-highlighted"
              >
                {{ i + 1 }}. {{ x.c.title || '(tanpa judul)' }}
              </NuxtLink>
              <b v-else>{{ i + 1 }}. {{ x.c.title || '(tanpa judul)' }}</b>
              <p class="text-xs text-muted">
                {{ [x.plat.join(' · '), String(x.c.pillar || '').trim() || PK_TANPA_PILLAR, pkBulanKonten(x.c) ? pkNamaBulan(pkBulanKonten(x.c)) : ''].filter(Boolean).join(' · ') }}
              </p>
              <p class="num mt-1">
                Reach {{ angka(x.agg.reach) }} · Impr. {{ x.agg.impr ? angka(x.agg.impr) : '—' }} · Eng. {{ angka(x.agg.eng) }}
              </p>
              <p class="num text-xs text-muted">
                <span
                  v-for="r in rasio(x.agg)"
                  :key="r.t"
                  class="me-2"
                >{{ r.t }} {{ pct(r.v) }}</span>· {{ dari(pkAggER(x.agg), x.agg) }}
              </p>
            </li>
          </ul>
          <p class="border-t border-default px-4 py-3 text-xs text-muted">
            Menampilkan <b>{{ top.length }}</b> konten. Satu baris = satu konten; angkanya gabungan seluruh platform konten itu<template v-if="st.plat">
              yang tersaring ke <b>{{ st.plat }}</b>
            </template>.
          </p>
        </template>
      </AppPanel>
    </template>
  </div>
</template>
