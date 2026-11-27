<!--
  Investor Compass › Dividen. Capital returns recorded by the CFO in
  Finance → Brankas → Pengembalian Modal, summed server-side. Since
  6 Oct 2026 the server sends each viewer only their own records
  (an investor admin sees every investor plus the Per Investor table).

  A backend that does not answer is NOT "never paid out": the two read very
  differently, and only the second one triggers phone calls. An account that
  is not linked to any investor record is NEITHER of those: it says so.

    laksamana-office/investor/index.html:1383-1470  renderDividen
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useInvestorSummary } from '~/composables/useInvestor'
import type { InvestorDividenPer } from '~/composables/useInvestor'
import { rupiah, tglPanjang } from '~/utils/format'

definePageMeta({ access: ['investor'] })

const { data: balasan, status, error } = useInvestorSummary()
const dividen = computed(() => balasan.value?.data?.dividen ?? null)
const riwayat = computed(() => dividen.value?.riwayat ?? [])
const per = computed(() => dividen.value?.per ?? [])
/** Missing `semua` = an old server (before 6 Oct 2026), which sent every investor. */
const semua = computed(() => !(dividen.value && dividen.value.semua === false))
const belumTerhubung = computed(() => !!dividen.value && !semua.value && !per.value.length)
const total = computed(() => Number(dividen.value?.total || 0))
const modal = computed(() => Number(dividen.value?.modal || 0))

/** Per-investor rows with the computed cells the table needs (sisa, %, akun). */
interface BarisPer extends InvestorDividenPer { sisa: number, persen: number | null, akun: boolean }
const barisPer = computed<BarisPer[]>(() => per.value.map((p) => {
  const m = Number(p.modal) || 0
  const k = Number(p.kembali) || 0
  return { ...p, sisa: Math.max(m - k, 0), persen: m > 0 ? k / m * 100 : null, akun: !!p.terhubung }
}))

interface BarisDividen { tgl: string, investor: string, nominal: number }
/** The admin opens one investor's history from the Per Investor table (owner, Nov 2026). */
const dipilih = ref('')
const pilih = (nama: string) => {
  dipilih.value = dipilih.value === nama ? '' : nama
}
const riwayatTampil = computed(() => (semua.value && per.value.length ? riwayat.value.filter(r => r.investor === dipilih.value) : riwayat.value))
const tampilRiwayat = computed(() => !(semua.value && per.value.length) || !!dipilih.value)
const kolom = computed<TableColumn<BarisDividen>[]>(() => [
  { accessorKey: 'tgl', header: 'Tanggal' },
  { accessorKey: 'investor', header: 'Investor' },
  { accessorKey: 'nominal', header: 'Nominal' },
])
const kolomPer = computed<TableColumn<BarisPer>[]>(() => [
  { accessorKey: 'nama', header: 'Investor' },
  { accessorKey: 'modal', header: 'Modal masuk' },
  { accessorKey: 'kembali', header: 'Dikembalikan' },
  { accessorKey: 'sisa', header: 'Sisa' },
  { accessorKey: 'persen', header: '%' },
  { accessorKey: 'akun', header: 'Akun' },
  { id: 'riwayat', header: 'Riwayat' },
])
</script>

<template>
  <AppPage
    title="Dividen"
    description="Riwayat dividen yang sudah dibagikan"
  >
    <AppPanel
      v-if="status === 'pending'"
      title="Memuat dividen"
    >
      <USkeleton class="h-24 w-full" />
    </AppPanel>

    <UAlert
      v-else-if="error || !dividen"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Riwayat dividen belum bisa dibaca"
      :description="apiErrorMessage(error, 'Servernya tidak menjawab.')"
    />

    <UAlert
      v-else-if="dividen.gagal"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Riwayat dividen belum bisa dibaca"
      description="Catatan pengembalian modal ada di panel Finance, dan panel itu sedang tidak menjawab. Ini bukan berarti belum ada pembagian — coba muat ulang halaman beberapa saat lagi."
    />

    <AppPanel
      v-else-if="belumTerhubung"
      title="Akun ini belum terhubung ke data investor"
      icon="i-lucide-link"
    >
      <p class="text-sm text-muted">
        Modal dan dividen Anda dicatat Finance di <b>Brankas</b>. Akun ini belum ditautkan ke catatan
        investor mana pun, jadi belum ada angka yang bisa ditampilkan. Hubungi Finance untuk menautkannya.
      </p>
    </AppPanel>

    <AppPanel
      v-else-if="!riwayat.length && !per.length"
      title="Belum ada pembagian yang dicatat"
      icon="i-lucide-hand-coins"
    >
      <p class="text-sm text-muted">
        Pengembalian modal dicatat di <b>Finance → Brankas → Pengembalian Modal</b>. Begitu satu pembayaran dicatat, riwayatnya muncul di sini.
      </p>
    </AppPanel>

    <template v-else>
      <!-- same cards as Finance › Brankas › Pengembalian Modal (owner, Nov 2026) -->
      <AppStatGrid
        :count="3"
        satu-baris
      >
        <AppStat
          label="Total modal"
          :value="rupiah(modal)"
        />
        <AppStat
          label="Sudah dikembalikan investor"
          :value="rupiah(total)"
          :sub="`${riwayat.length} kali pembagian`"
        />
        <AppStat
          label="Sisa kewajiban"
          :value="rupiah(Math.max(modal - total, 0))"
          sub="Modal yang belum kembali"
        />
      </AppStatGrid>

      <AppPanel
        v-if="semua && per.length"
        title="Per investor"
        icon="i-lucide-users"
        description="Tekan Lihat riwayat untuk melihat pembagian tiap investor · hanya terlihat oleh admin · sumber: Brankas Finance"
        flush
      >
        <UTable
          class="hidden lg:block"
          :data="barisPer"
          :columns="kolomPer"
          empty="Belum ada investor."
        >
          <template #nama-cell="{ row }">
            <div>
              <b>{{ row.original.nama || '—' }}</b>
              <p
                v-if="Number(row.original.kepemilikan)"
                class="text-xs text-muted"
              >
                {{ row.original.kepemilikan }}% kepemilikan
              </p>
            </div>
          </template>
          <template #riwayat-cell="{ row }">
            <UButton
              size="sm"
              :color="dipilih === row.original.nama ? 'primary' : 'neutral'"
              :variant="dipilih === row.original.nama ? 'solid' : 'outline'"
              :icon="dipilih === row.original.nama ? 'i-lucide-x' : 'i-lucide-history'"
              :label="dipilih === row.original.nama ? 'Tutup' : 'Lihat riwayat'"
              @click="pilih(row.original.nama)"
            />
          </template>
          <template #modal-cell="{ row }">
            <span class="num">{{ rupiah(Number(row.original.modal) || 0) }}</span>
          </template>
          <template #kembali-cell="{ row }">
            <span class="num">{{ rupiah(Number(row.original.kembali) || 0) }}</span>
          </template>
          <template #sisa-cell="{ row }">
            <span class="num">{{ rupiah(row.original.sisa) }}</span>
          </template>
          <template #persen-cell="{ row }">
            <span class="num">{{ row.original.persen == null ? '—' : `${row.original.persen.toFixed(1).replace('.', ',')}%` }}</span>
          </template>
          <template #akun-cell="{ row }">
            <AppStatus
              v-if="row.original.akun"
              color="success"
              size="sm"
            >
              Terhubung
            </AppStatus>
            <span
              v-else
              class="text-sm text-muted"
            >Belum ditautkan</span>
          </template>
        </UTable>
        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="(p, i) in barisPer"
            :key="i"
            class="space-y-2 px-4 py-3"
            :class="dipilih === p.nama ? 'bg-elevated' : ''"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate font-semibold text-highlighted">
                  {{ p.nama || '—' }}
                </p>
                <p
                  v-if="Number(p.kepemilikan)"
                  class="text-xs text-muted"
                >
                  {{ p.kepemilikan }}% kepemilikan
                </p>
              </div>
              <AppStatus
                v-if="p.akun"
                color="success"
                size="sm"
              >
                Terhubung
              </AppStatus>
              <span
                v-else
                class="shrink-0 text-xs text-muted"
              >Belum ditautkan</span>
            </div>
            <p class="text-sm text-muted num">
              Modal {{ rupiah(Number(p.modal) || 0) }} · kembali {{ rupiah(Number(p.kembali) || 0) }} ·
              sisa {{ rupiah(p.sisa) }}{{
                p.persen == null ? '' : ` · ${p.persen.toFixed(1).replace('.', ',')}%`
              }}
            </p>
            <UButton
              size="sm"
              :color="dipilih === p.nama ? 'primary' : 'neutral'"
              :variant="dipilih === p.nama ? 'solid' : 'outline'"
              :icon="dipilih === p.nama ? 'i-lucide-x' : 'i-lucide-history'"
              :label="dipilih === p.nama ? 'Tutup riwayat' : 'Lihat riwayat'"
              @click="pilih(p.nama)"
            />
          </div>
        </div>
      </AppPanel>

      <AppPanel
        v-if="tampilRiwayat"
        :title="dipilih ? `Riwayat pembagian · ${dipilih}` : 'Riwayat pembagian'"
        icon="i-lucide-history"
        description="Terbaru lebih dulu · sumber: Brankas Finance"
        flush
      >
        <template
          v-if="dipilih"
          #actions
        >
          <UButton
            label="Tutup"
            icon="i-lucide-x"
            size="sm"
            color="neutral"
            variant="ghost"
            @click="dipilih = ''"
          />
        </template>
        <UTable
          class="hidden lg:block"
          :data="riwayatTampil"
          :columns="kolom"
          empty="Belum ada pembagian."
        >
          <template #tgl-cell="{ row }">
            {{ tglPanjang(row.original.tgl) }}
          </template>
          <template #investor-cell="{ row }">
            <b>{{ row.original.investor || '—' }}</b>
          </template>
          <template #nominal-cell="{ row }">
            <span class="num">{{ rupiah(row.original.nominal) }}</span>
          </template>
        </UTable>
        <div class="divide-y divide-default lg:hidden">
          <div
            v-for="(r, i) in riwayatTampil"
            :key="i"
            class="flex items-start justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate font-semibold text-highlighted">
                {{ r.investor || '—' }}
              </p>
              <p class="text-sm text-muted">
                {{ tglPanjang(r.tgl) }}
              </p>
            </div>
            <p class="shrink-0 font-semibold text-highlighted num">
              {{ rupiah(r.nominal) }}
            </p>
          </div>
        </div>
      </AppPanel>
    </template>
  </AppPage>
</template>
