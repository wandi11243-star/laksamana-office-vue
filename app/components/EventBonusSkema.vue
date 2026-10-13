<!--
  Event bonus cards (old kartuBonusEv, deploy/assets/performa-bonus.js), the
  twin of MarketingBonusSkema. Every number comes from `bonusEvent()` in
  performa-bonus.ts; this file only lays the ladders out.

  Numbering follows the HR document, so the cash schemes are 1 + 2 + 4 and the
  voucher is 3. Schemes 1 & 3 use the net event value (`amount`); scheme 4 uses
  the PIC's realisation = half the event value. On the "Semua" segment the
  per-PIC ladder (scheme 4) shows no figure — a combined number there would
  promise a bonus nobody receives.
-->
<script setup lang="ts">
import type { InfoBonusEvent, PicBonus, SelRealisasi } from '~/utils/performa-bonus'
import { EV_S1, EV_S2, EV_S2_DASAR, EV_S3_VOUCHER, EV_S4, selRealisasi } from '~/utils/performa-bonus'
import { angka, rupiah } from '~/utils/format'

const props = defineProps<{ info: InfoBonusEvent, pid: string, list: PicBonus[] }>()

const semua = computed(() => props.pid === '__all__')
const p = computed(() => (semua.value ? null : props.info.per[props.pid] ?? null))

const tunai = computed(() => (semua.value ? props.info.tunaiSemua : p.value?.tunai ?? 0))
const voucher = computed(() => (semua.value ? props.info.voucherSemua : p.value?.voucher ?? 0))
const rinci = computed(() => (semua.value
  ? `jumlah bonus tunai ${angka(props.info.jumPic)} PIC di roster event`
  : p.value ? `Skema 1 ${rupiah(p.value.s1)} · 2 ${rupiah(p.value.s2)} · 4 ${rupiah(p.value.s4.bonus)}` : '—'))

/** Events of the segment per scheme-1 / scheme-3 rung (summed over the roster on "Semua"). */
const jumlahDi = (key: 's1Jml' | 'vJml', m: number) => (semua.value
  ? props.list.reduce((s, e) => s + (props.info.per[e.id]?.[key][m] ?? 0), 0)
  : p.value?.[key][m] ?? 0)
const eventSeg = computed(() => (semua.value ? props.info.jumEvent : p.value?.jumEvent ?? 0))
const s1Total = computed(() => (semua.value ? props.list.reduce((s, e) => s + (props.info.per[e.id]?.s1 ?? 0), 0) : p.value?.s1 ?? 0))
const dibawahS1 = computed(() => eventSeg.value - EV_S1.reduce((s, t) => s + jumlahDi('s1Jml', t.min), 0))

const s2Tier = computed(() => props.info.s2.tier)
const barisS2 = computed(() => [
  { min: EV_S2_DASAR, bonus: 0, aktif: !s2Tier.value },
  ...EV_S2.slice().reverse().map(t => ({ min: t.min, bonus: t.bonus, aktif: s2Tier.value?.min === t.min })),
])

const s4 = computed(() => p.value?.s4 ?? null)
const realS4 = computed(() => (semua.value ? null : p.value?.dasarS4 ?? 0))
const barisS4 = computed(() => EV_S4.slice().reverse().map(t => ({ t, aktif: !!(s4.value?.bonus && s4.value.min === t.min) })))
const bawahS4 = computed(() => !!(s4.value && !s4.value.bonus))

function teksSel(s: SelRealisasi): { teks: string, kuat: boolean } {
  if (s.jenis === 'kosong') return { teks: '—', kuat: false }
  if (s.jenis === 'aktif') return { teks: `${rupiah(s.nilai)} ✓`, kuat: true }
  if (s.jenis === 'terlampaui') return { teks: 'terlampaui', kuat: false }
  return { teks: `kurang ${rupiah(s.nilai)}`, kuat: false }
}
const HI = 'bg-primary-100'
const TH = 'px-4 py-2'
</script>

<template>
  <div class="space-y-4">
    <AppStatGrid>
      <AppStat
        :label="`Bonus tunai${semua ? ' — seluruh tim' : ''}`"
        :value="rupiah(tunai)"
        :sub="rinci"
        :tone="tunai ? 'success' : 'gold'"
      />
      <AppStat
        label="Event tim bulan ini"
        :value="angka(info.jumEvent)"
        :sub="s2Tier ? `tangga ${s2Tier.min} event — pool ${rupiah(info.s2.pool)}` : `belum mencapai ${EV_S2[EV_S2.length - 1]!.min} event`"
      />
      <AppStat
        label="Non-tunai (skema 3)"
        :value="voucher ? rupiah(voucher) : '—'"
        :sub="`voucher F&B${voucher ? '' : ' · belum ada'}`"
      />
    </AppStatGrid>

    <AppPanel>
      <p class="text-sm text-muted">
        <b class="text-highlighted">Skema 1 + 2 + 4 diakumulasi</b> jadi Bonus Tunai tiap PIC; <b class="text-highlighted">Skema 3 berdiri sendiri</b>
        karena bentuknya voucher. Penomorannya mengikuti dokumen SDM-nya, jadi yang tunai tidak berurutan. Skema 1 &amp; 3 dihitung dari
        <b>nilai event utuh</b> (net, sebelum tax &amp; service); Skema 4 dari <b>realisasi</b>, yaitu separuh nilai event (kolom Diakui).
        Laporan maksimal 7–14 hari setelah event selesai; pencairan ikut gajian. Kartu-kartu ini hanya menunjukkan posisi capaian.
      </p>
    </AppPanel>

    <!-- Skema 1 -->
    <AppPanel
      title="Skema 1 — Bonus per Event"
      icon="i-lucide-ticket"
      flush
    >
      <p class="px-4 pt-3 text-sm text-muted">
        Tangga dari <b>omset tiap event</b>, dihitung per event lalu dijumlahkan. Dasarnya kolom <b>Nilai Event</b> di tabel sebelah —
        <b>net, sebelum tax &amp; service</b>, sesuai catatan di skemanya.
      </p>
      <div class="overflow-x-auto">
        <table class="mt-3 w-full min-w-[34rem] text-sm">
          <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
            <tr>
              <th :class="TH">
                F&amp;B sales internal event
              </th>
              <th :class="[TH, 'text-right']">
                Tercapai
              </th>
              <th :class="[TH, 'text-right']">
                Bonus tim event
              </th>
              <th :class="[TH, 'text-right']">
                Diperoleh
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr>
              <td :class="TH">
                Di bawah {{ rupiah(EV_S1[EV_S1.length - 1]!.min) }}
              </td>
              <td :class="[TH, 'text-right num']">
                {{ dibawahS1 }} event
              </td>
              <td :class="[TH, 'text-right text-dimmed']">
                —
              </td>
              <td :class="[TH, 'text-right text-muted']">
                standar kerja
              </td>
            </tr>
            <tr
              v-for="t in EV_S1.slice().reverse()"
              :key="t.min"
              :class="jumlahDi('s1Jml', t.min) ? HI : ''"
            >
              <td :class="TH">
                {{ t.label }}
              </td>
              <td :class="[TH, 'text-right num']">
                {{ jumlahDi('s1Jml', t.min) }} event
              </td>
              <td :class="[TH, 'text-right num']">
                {{ rupiah(t.bonus) }} <span class="text-dimmed">/orang</span>
              </td>
              <td :class="[TH, 'text-right num']">
                <b v-if="jumlahDi('s1Jml', t.min)">{{ rupiah(t.bonus * jumlahDi('s1Jml', t.min)) }} ✓</b>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </td>
            </tr>
          </tbody>
          <tfoot class="border-t border-default font-semibold text-highlighted">
            <tr>
              <td
                colspan="3"
                :class="TH"
              >
                Total skema 1
              </td>
              <td :class="[TH, 'text-right num']">
                {{ rupiah(s1Total) }} <span class="text-dimmed">/orang</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="px-4 py-3 text-xs text-muted">
        <b>Nominalnya per orang.</b> Halaman ini menghitungnya untuk <b>PIC yang tercatat</b> di baris breakdown — Office tidak menyimpan siapa
        saja anggota tim sebuah event. Kalau timnya lebih dari satu orang, yang dibayarkan angka ini <b>dikali jumlah orangnya</b>. Tiap event
        dihitung sekali, di tangga tertingginya.
      </p>
    </AppPanel>

    <!-- Skema 2 -->
    <AppPanel
      title="Skema 2 — Bonus Target Bulanan (Performance Team)"
      icon="i-lucide-users"
      flush
    >
      <p class="px-4 pt-3 text-sm text-muted">
        Dari <b>JUMLAH</b> event tim event pada periode ini, bukan nilainya: <b>{{ info.jumEvent }} event</b>
        <template v-if="s2Tier">
          — masuk tangga {{ s2Tier.min }} event.
        </template>
        <template v-else>
          — belum masuk tangga mana pun.
        </template>
      </p>
      <div class="overflow-x-auto">
        <table class="mt-3 w-full min-w-[30rem] text-sm">
          <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
            <tr>
              <th :class="TH">
                Target event internal per bulan
              </th>
              <th :class="[TH, 'text-right']">
                Total bonus (dibagi tim)
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="b in barisS2"
              :key="b.min"
              :class="b.aktif ? HI : ''"
            >
              <td :class="TH">
                <b v-if="b.aktif">{{ b.min }} event internal / Collab ✓</b>
                <template v-else>
                  {{ b.min }} event internal / Collab
                </template>
              </td>
              <td :class="[TH, 'text-right num']">
                {{ b.bonus ? rupiah(b.bonus) : 'standar kerja' }}
              </td>
            </tr>
          </tbody>
          <tfoot class="border-t border-default font-semibold text-highlighted">
            <tr>
              <td :class="TH">
                Pool tim
              </td>
              <td :class="[TH, 'text-right num']">
                {{ rupiah(info.s2.pool) }}
              </td>
            </tr>
            <tr>
              <td :class="TH">
                Dibagi ke {{ info.s2.bagi }} PIC yang punya event periode ini
              </td>
              <td :class="[TH, 'text-right num']">
                {{ rupiah(info.s2.perPic) }} <span class="text-dimmed">/ PIC</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="px-4 py-3 text-xs text-muted">
        Berbeda dari Skema 1: yang ini <b>satu pool yang dibagi</b>, bukan nominal per orang. Yang berlaku hanya tangga tertinggi.
      </p>
    </AppPanel>

    <!-- Skema 3 -->
    <AppPanel
      title="Skema 3 — Bonus Non-Tunai (insentif tambahan)"
      icon="i-lucide-gift"
      flush
    >
      <p class="px-4 pt-3 text-sm text-muted">
        Voucher F&amp;B — <b>tidak dijumlahkan</b> ke Bonus Tunai di atas. Nilainya rupiah, tapi yang keluar bukan uang: menjumlahkannya
        membuat angka yang tidak bisa dicairkan tampak seperti yang bisa.
      </p>
      <div class="overflow-x-auto">
        <table class="mt-3 w-full min-w-[30rem] text-sm">
          <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
            <tr>
              <th :class="TH">
                Insentif
              </th>
              <th :class="[TH, 'text-right']">
                Tercapai
              </th>
              <th :class="[TH, 'text-right']">
                Diperoleh
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="t in EV_S3_VOUCHER.slice().reverse()"
              :key="t.min"
              :class="jumlahDi('vJml', t.min) ? HI : ''"
            >
              <td :class="TH">
                Voucher F&amp;B {{ rupiah(t.nilai) }} untuk tiap event di atas {{ rupiah(t.min - 1) }}
              </td>
              <td :class="[TH, 'text-right num']">
                {{ jumlahDi('vJml', t.min) }} event
              </td>
              <td :class="[TH, 'text-right num']">
                <b v-if="jumlahDi('vJml', t.min)">{{ rupiah(t.nilai * jumlahDi('vJml', t.min)) }} ✓</b>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </td>
            </tr>
          </tbody>
          <tfoot class="border-t border-default font-semibold text-highlighted">
            <tr>
              <td
                colspan="2"
                :class="TH"
              >
                Total voucher
              </td>
              <td :class="[TH, 'text-right num']">
                {{ rupiah(voucher) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="px-4 py-3 text-xs text-muted">
        Tiap event dihitung sekali, di tangga tertingginya — event {{ rupiah(120000000) }} memberi {{ rupiah(250000) }}, bukan ketiganya sekaligus.
      </p>
    </AppPanel>

    <!-- Skema 4 -->
    <AppPanel
      title="Skema 4 — Tangga Total Nilai Omset per PIC"
      icon="i-lucide-trending-up"
      flush
    >
      <p class="px-4 pt-3 text-sm text-muted">
        Dasarnya <b>realisasi PIC itu sendiri</b> pada periode ini — <b>separuh nilai event</b> (kolom Diakui), angka yang sama dengan kartu
        Realisasi di atas. <b>Dinilai per PIC</b>; angka gabungan tidak dipakai di sini, pilih namanya di atas.
      </p>
      <div class="overflow-x-auto">
        <table class="mt-3 w-full min-w-[34rem] text-sm">
          <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
            <tr>
              <th :class="TH">
                Total nilai omset / bulan
              </th>
              <th :class="[TH, 'text-right']">
                Realisasi
              </th>
              <th :class="[TH, 'text-right']">
                Bonus untuk tim event
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr :class="bawahS4 ? HI : ''">
              <td :class="TH">
                Di bawah {{ rupiah(EV_S4[EV_S4.length - 1]!.min) }}
              </td>
              <td :class="[TH, 'text-right num']">
                <b v-if="bawahS4 && realS4 !== null">{{ rupiah(realS4) }} ✓</b>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </td>
              <td :class="[TH, 'text-right text-dimmed']">
                —
              </td>
            </tr>
            <tr
              v-for="b in barisS4"
              :key="b.t.min"
              :class="b.aktif ? HI : ''"
            >
              <td :class="TH">
                {{ b.t.label }}
              </td>
              <td :class="[TH, 'text-right num']">
                <b v-if="teksSel(selRealisasi(realS4, b.t.min, b.aktif)).kuat">{{ teksSel(selRealisasi(realS4, b.t.min, b.aktif)).teks }}</b>
                <span
                  v-else
                  class="text-dimmed"
                >{{ teksSel(selRealisasi(realS4, b.t.min, b.aktif)).teks }}</span>
              </td>
              <td :class="[TH, 'text-right num']">
                {{ rupiah(b.t.bonus) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppPanel>
  </div>
</template>
