<!--
  Anjungan (deploy/akademi/index.html vAnjungan, :1197-1232), admin only: the
  ship-wide numbers, progress per division, the crew to push, and quiz results.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { muatAkademiKru, useAkademiData } from '~/composables/useAkademi'
import { namaDivisi, statKru } from '~/utils/akademi-hitung'
import { ikonDivisi } from '~/utils/akademi-konstanta'

definePageMeta({ access: ['akademi'] })

const { materials, progress, divisions, isAdmin } = useAkademiData()
muatAkademiKru()

const kru = computed(() => useAkademiKru().value.filter(k => k.active))

const jumlahSertifikat = computed(() => kru.value.filter(k => statKru(k, materials.value, progress.value).certified).length)
const materiTerbit = computed(() => materials.value.filter(m => m.published).length)
const rataRata = computed(() => {
  const n = kru.value.length || 1
  return Math.round(kru.value.reduce((s, k) => s + statKru(k, materials.value, progress.value).mandPct, 0) / n)
})

const perDivisi = computed(() => divisions.value
  .map((d) => {
    const anggota = kru.value.filter(k => k.division === d.id)
    const pct = anggota.length
      ? Math.round(anggota.reduce((s, k) => s + statKru(k, materials.value, progress.value).mandPct, 0) / anggota.length)
      : 0
    return { ...d, jumlah: anggota.length, pct }
  })
  .filter(d => d.jumlah > 0))

const perluDidorong = computed(() => kru.value
  .map(k => ({ k, s: statKru(k, materials.value, progress.value) }))
  .filter(x => x.s.mandTotal > 0 && x.s.mandPct < 50)
  .sort((a, b) => a.s.mandPct - b.s.mandPct)
  .slice(0, 8))

const kuis = computed(() => materials.value.filter(m => m.type === 'quiz' && m.published))
const hasilKuis = computed(() => kuis.value.map((q) => {
  let peserta = 0
  let lulus = 0
  let jumlah = 0
  for (const k of kru.value) {
    const p = progress.value[k.id]?.[q.id]
    const attempts = Number(p?.attempts)
    if (attempts) {
      peserta++
      jumlah += Number(p?.score) || 0
      if (p?.passed) lulus++
    }
  }
  return { id: q.id, judul: q.title, peserta, total: kru.value.length, lulus, rata: peserta ? Math.round(jumlah / peserta) : null }
}))

const kolomKuis: TableColumn<(typeof hasilKuis.value)[number]>[] = [
  { id: 'kuis', header: 'Kuis' },
  { id: 'peserta', header: 'Peserta' },
  { id: 'lulus', header: 'Lulus' },
  { id: 'rata', header: 'Rata-rata Skor' },
]
</script>

<template>
  <AppPage
    title="Anjungan"
    description="Pusat kendali training, kondisi standar kru secara keseluruhan"
  >
    <AppPanel
      v-if="!isAdmin"
      title="Khusus admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Anjungan hanya untuk admin modul Akademi.
      </p>
    </AppPanel>

    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Kru Aktif"
          icon="i-lucide-users"
          tone="info"
          :value="kru.length"
          sub="punya akses Akademi"
        />
        <AppStat
          label="Tersertifikasi"
          icon="i-lucide-medal"
          tone="success"
          :value="jumlahSertifikat"
          :sub="`dari ${kru.length} kru aktif`"
        />
        <AppStat
          label="Rata-rata Progress Wajib"
          icon="i-lucide-gauge"
          tone="warning"
          :value="`${rataRata}%`"
          sub="seluruh kru aktif"
        />
        <AppStat
          label="Materi Terbit"
          icon="i-lucide-book-open"
          tone="gold"
          :value="materiTerbit"
          sub="siap dipelajari"
        />
      </AppStatGrid>

      <div class="grid gap-5 xl:grid-cols-2">
        <AppPanel
          title="Progress per Divisi"
          icon="i-lucide-network"
        >
          <div
            v-for="d in perDivisi"
            :key="d.id"
            class="mb-3"
          >
            <div class="mb-1 flex items-center justify-between gap-3 text-[13px] font-semibold">
              <span class="flex items-center gap-1.5">
                <UIcon
                  :name="ikonDivisi(divisions, d.id)"
                  class="size-4 text-muted"
                />
                {{ namaDivisi(divisions, d.id) }}
                <span class="font-medium text-muted">({{ d.jumlah }} kru)</span>
              </span>
              <b>{{ d.pct }}%</b>
            </div>
            <div class="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-primary-400"
                :style="{ width: `${d.pct}%` }"
              />
            </div>
          </div>
          <p
            v-if="!perDivisi.length"
            class="text-sm text-muted"
          >
            Belum ada kru aktif.
          </p>
        </AppPanel>

        <AppPanel
          title="Kru yang Perlu Didorong (<50% wajib)"
          icon="i-lucide-trending-down"
          :count="perluDidorong.length"
        >
          <div
            v-if="perluDidorong.length"
            class="divide-y divide-default"
          >
            <div
              v-for="x in perluDidorong"
              :key="x.k.id"
              class="flex items-center justify-between gap-3 py-2.5"
            >
              <div class="min-w-0">
                <p class="truncate font-semibold text-highlighted">
                  {{ x.k.name }}
                </p>
                <p class="text-[11px] text-muted">
                  {{ namaDivisi(divisions, x.k.division) }}
                </p>
              </div>
              <AppStatus
                color="error"
                icon="i-lucide-trending-down"
                size="sm"
              >
                {{ x.s.mandPct }}%
              </AppStatus>
            </div>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            Semua kru di atas 50%. Kapal berlayar mulus.
          </p>
        </AppPanel>
      </div>

      <AppPanel
        title="Hasil Kuis per Materi"
        icon="i-lucide-circle-help"
        :count="hasilKuis.length"
        flush
      >
        <div class="hidden lg:block">
          <UTable
            :data="hasilKuis"
            :columns="kolomKuis"
          >
            <template #kuis-cell="{ row }">
              <span class="font-semibold">{{ row.original.judul }}</span>
            </template>
            <template #peserta-cell="{ row }">
              {{ row.original.peserta }}/{{ row.original.total }}
            </template>
            <template #rata-cell="{ row }">
              {{ row.original.rata != null ? `${row.original.rata}%` : '—' }}
            </template>
          </UTable>
        </div>
        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="q in hasilKuis"
            :key="q.id"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate font-semibold text-highlighted">
                {{ q.judul }}
              </p>
              <p class="text-xs text-muted">
                Peserta {{ q.peserta }}/{{ q.total }} · Lulus {{ q.lulus }}
              </p>
            </div>
            <b>{{ q.rata != null ? `${q.rata}%` : '—' }}</b>
          </div>
          <p
            v-if="!hasilKuis.length"
            class="px-4 py-3 text-sm text-muted"
          >
            Belum ada kuis terbit.
          </p>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
