<!--
  Marketing bonus cards (old kartuBonusMk = baguRingkasMk + note + kartuSkema1..4,
  deploy/assets/performa-bonus.js:385-595). Every number comes from
  `bonusMarketing()` in performa-bonus.ts; this file only lays the ladders out.
  The "Realisasi" column of the ladders uses `selRealisasi` (the row in force
  shows the value, rows above say what is missing, rows passed say so); on the
  "Semua" segment the per-PIC ladder (scheme 2) shows no figure — a combined
  number there would promise a bonus nobody receives.
-->
<script setup lang="ts">
import type { InfoBonusMarketing, PicBonus, SelRealisasi } from '~/utils/performa-bonus'
import {
  MK_S1_EVENT, MK_S1_JUMLAH, MK_S1_MIN_EVENT, MK_S2, MK_S3, MK_S4_CUTI_MIN, MK_S4_CUTI_PER, MK_S4_TOP, MK_S4_VOUCHER, selRealisasi,
} from '~/utils/performa-bonus'
import { angka, rupiah } from '~/utils/format'

const props = defineProps<{ info: InfoBonusMarketing, pid: string, real: number, list: PicBonus[] }>()

const semua = computed(() => props.pid === '__all__')
const p = computed(() => (semua.value ? null : props.info.per[props.pid] ?? null))

// ---- ringkas (baguRingkasMk)
const tunai = computed(() => (semua.value ? props.info.tunaiSemua : p.value?.tunai ?? 0))
const voucher = computed(() => (semua.value ? props.info.voucherSemua : p.value?.voucher ?? 0))
const cuti = computed(() => (semua.value ? props.info.cutiSemua : p.value?.cuti ?? 0))
const rinci = computed(() => (semua.value
  ? `jumlah bonus tunai ${angka(props.info.jumPic)} PIC di roster marketing`
  : p.value ? `Skema 1 ${rupiah(p.value.s1)} · 2 ${rupiah(p.value.s2.bonus)} · 3 ${rupiah(p.value.s3)}` : '—'))
const kurangS2 = computed(() => {
  const s2 = p.value?.s2
  return s2?.next ? Math.max(0, s2.next.min - props.real) : 0
})

// ---- skema 1
const perTangga = (m: number) => props.info.s1.ev.filter(x => x.t.min === m).length

// ---- skema 2 / 3 rows, low to high (MK_S2.slice().reverse())
const realS2 = computed(() => (semua.value ? null : props.real))
const s2 = computed(() => p.value?.s2 ?? null)
const barisS2 = computed(() => MK_S2.slice().reverse().map(t => ({ t, aktif: !!(s2.value?.bonus && s2.value.min === t.min) })))
const bawahS2 = computed(() => !!(s2.value && !s2.value.bonus))
const tier = computed(() => props.info.s3.tier)
const barisS3 = computed(() => MK_S3.slice().reverse().map(t => ({ t, aktif: !!(tier.value && tier.value.min === t.min) })))
const namaHead = computed(() => props.info.headIds.map(id => props.list.find(x => x.id === id)?.name).filter(Boolean) as string[])

// ---- skema 4
const jml = (m: number) => (semua.value
  ? props.list.reduce((s, e) => s + (props.info.per[e.id]?.vJml[m] ?? 0), 0)
  : p.value?.vJml[m] ?? 0)
const evBesar = computed(() => (semua.value ? props.list.reduce((s, e) => s + (props.info.per[e.id]?.evBesar ?? 0), 0) : p.value?.evBesar ?? 0))
const top = computed(() => (semua.value ? props.info.topSemua.length > 0 : !!p.value?.top))

function teksSel(s: SelRealisasi): { teks: string, kuat: boolean, redup: boolean } {
  if (s.jenis === 'kosong') return { teks: '—', kuat: false, redup: true }
  if (s.jenis === 'aktif') return { teks: `${rupiah(s.nilai)} ✓`, kuat: true, redup: false }
  if (s.jenis === 'terlampaui') return { teks: 'terlampaui', kuat: false, redup: true }
  return { teks: `kurang ${rupiah(s.nilai)}`, kuat: false, redup: true }
}
const HI = 'bg-primary-100'
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
        v-if="semua"
        label="Omset tim (skema 3)"
        :value="rupiah(info.s3.total)"
        :sub="info.s3.tier ? info.s3.tier.label : 'belum masuk tangga Skema 3'"
      />
      <AppStat
        v-else
        :label="s2?.next ? 'Menuju tangga skema 2' : 'Tangga skema 2 tertinggi'"
        :value="s2?.next ? rupiah(kurangS2) : '—'"
        :sub="s2?.next ? `lagi untuk bonus ${rupiah(s2.next.bonus)}` : 'sudah di tangga teratas'"
      />
      <AppStat
        label="Non-tunai (skema 4)"
        :value="voucher ? rupiah(voucher) : '—'"
        :sub="`voucher F&B${cuti ? ` · ${cuti} hari cuti` : ''}${(!voucher && !cuti) ? ' · belum ada' : ''}`"
      />
    </AppStatGrid>

    <AppPanel>
      <p class="text-sm text-muted">
        <b class="text-highlighted">Skema 1 + 2 + 3 diakumulasi</b> jadi Bonus Tunai{{ semua ? ' tiap PIC' : '' }};
        <b class="text-highlighted">Skema 4 berdiri sendiri</b> karena bentuknya voucher, cuti, dan penghargaan.
        Pencairan tetap lewat verifikasi & persetujuan — kartu-kartu ini hanya menunjukkan posisi capaian.
      </p>
    </AppPanel>

    <AppPanel
      title="Skema 1 — Bonus target tim"
      icon="i-lucide-users"
      flush
    >
      <p class="px-4 pt-3 text-sm text-muted">
        Pool dihitung dari <b>seluruh event tim</b> — event Marketing, Reservasi VIP, dan baris yang diketik finance di Breakdown — apa pun jenis acaranya,
        lalu dibagi rata ke PIC yang punya event pada periode ini. Nilai tiap event memakai kolom <b>Diakui</b> (omset + tax + service).
      </p>
      <div class="overflow-x-auto">
        <table class="mt-3 w-full min-w-[34rem] text-sm">
          <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
            <tr>
              <th class="px-4 py-2">
                Syarat
              </th>
              <th class="px-4 py-2 text-right">
                Tercapai
              </th>
              <th class="px-4 py-2 text-right">
                Bonus
              </th>
              <th class="px-4 py-2 text-right">
                Diperoleh
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="t in MK_S1_JUMLAH"
              :key="`j${t.min}`"
              :class="info.s1.jum?.min === t.min ? HI : ''"
            >
              <td class="px-4 py-2">
                Tim mencapai <b>{{ t.min }} event</b> senilai ≥ {{ rupiah(MK_S1_MIN_EVENT) }}
              </td>
              <td class="px-4 py-2 text-right num">
                {{ info.s1.lolos.length }} event
              </td>
              <td class="px-4 py-2 text-right num">
                {{ rupiah(t.bonus) }}
              </td>
              <td class="px-4 py-2 text-right num">
                <b v-if="info.s1.jum?.min === t.min">{{ rupiah(t.bonus) }} ✓</b>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </td>
            </tr>
            <tr
              v-for="t in MK_S1_EVENT"
              :key="`e${t.min}`"
              :class="perTangga(t.min) ? HI : ''"
            >
              <td class="px-4 py-2">
                Tiap event senilai ≥ {{ rupiah(t.min) }}
              </td>
              <td class="px-4 py-2 text-right num">
                {{ perTangga(t.min) }} event
              </td>
              <td class="px-4 py-2 text-right num">
                {{ rupiah(t.bonus) }} <span class="text-dimmed">/ event</span>
              </td>
              <td class="px-4 py-2 text-right num">
                <b v-if="perTangga(t.min)">{{ rupiah(t.bonus * perTangga(t.min)) }} ✓</b>
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
                class="px-4 py-2"
              >
                Pool tim
              </td>
              <td class="px-4 py-2 text-right num">
                {{ rupiah(info.s1.pool) }}
              </td>
            </tr>
            <tr>
              <td
                colspan="3"
                class="px-4 py-2"
              >
                Dibagi ke {{ info.s1.bagi }} PIC yang punya event periode ini
              </td>
              <td class="px-4 py-2 text-right num">
                {{ rupiah(info.s1.perPic) }} <span class="text-dimmed">/ PIC</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p class="px-4 py-3 text-xs text-muted">
        Dua baris pertama <b>tidak berlipat</b> — yang berlaku hanya yang tertinggi. Dua baris terakhir dihitung per event dan boleh berulang;
        tiap event dihitung sekali, di tangga tertingginya.
      </p>
    </AppPanel>

    <AppPanel
      title="Skema 2 — Tangga total nilai deal per PIC"
      icon="i-lucide-trending-up"
      flush
    >
      <p class="px-4 pt-3 text-sm text-muted">
        Dasarnya <b>realisasi PIC itu sendiri</b> pada periode ini — seluruh event yang diakui untuknya, sudah dipotong compliment.
        <template v-if="semua">
          <b>Dinilai per PIC</b>; angka gabungan tidak dipakai di sini, pilih namanya di atas.
        </template>
        <template v-else>
          Realisasi {{ rupiah(real) }}.
        </template>
      </p>
      <div class="overflow-x-auto">
        <table class="mt-3 w-full min-w-[30rem] text-sm">
          <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
            <tr>
              <th class="px-4 py-2">
                Total nilai deal / bulan
              </th>
              <th class="px-4 py-2 text-right">
                Realisasi
              </th>
              <th class="px-4 py-2 text-right">
                Bonus untuk marketing
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr :class="bawahS2 ? HI : ''">
              <td class="px-4 py-2">
                <b v-if="bawahS2">Di bawah {{ rupiah(120000000) }} ✓</b>
                <template v-else>
                  Di bawah {{ rupiah(120000000) }}
                </template>
              </td>
              <td
                class="px-4 py-2 text-right num"
                :class="teksSel(selRealisasi(realS2, 0, bawahS2)).redup ? 'text-dimmed' : 'font-bold'"
              >
                {{ teksSel(selRealisasi(realS2, 0, bawahS2)).teks }}
              </td>
              <td class="px-4 py-2 text-right num">
                —
              </td>
            </tr>
            <tr
              v-for="b in barisS2"
              :key="b.t.min"
              :class="b.aktif ? HI : ''"
            >
              <td class="px-4 py-2">
                <b v-if="b.aktif">{{ b.t.label }} ✓</b>
                <template v-else>
                  {{ b.t.label }}
                </template>
              </td>
              <td
                class="px-4 py-2 text-right num"
                :class="teksSel(selRealisasi(realS2, b.t.min, b.aktif)).redup ? 'text-dimmed' : 'font-bold'"
              >
                {{ teksSel(selRealisasi(realS2, b.t.min, b.aktif)).teks }}
              </td>
              <td
                class="px-4 py-2 text-right num"
                :class="b.aktif ? 'font-bold' : ''"
              >
                {{ rupiah(b.t.bonus) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="px-4 py-3 text-xs text-muted">
        Dihitung per PIC — tangganya memakai <b>seluruh event</b> PIC itu.
      </p>
    </AppPanel>

    <AppPanel
      title="Skema 3 — Bonus total omset team"
      icon="i-lucide-users-round"
      flush
    >
      <p class="px-4 pt-3 text-sm text-muted">
        Dasarnya <b>omset seluruh tim marketing</b> pada periode ini: {{ rupiah(info.s3.total) }}{{ tier ? ` — masuk ${tier.label}` : ' — belum masuk tangga mana pun' }}.
        Sama untuk <b>seluruh PIC di roster</b>, termasuk yang periode ini belum punya event: yang dinilai capaian TIM, bukan capaian orangnya. Yang membedakan hanya leader.
      </p>
      <div class="overflow-x-auto">
        <table class="mt-3 w-full min-w-[36rem] text-sm">
          <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
            <tr>
              <th class="px-4 py-2">
                Total nilai deal / bulan
              </th>
              <th class="px-4 py-2 text-right">
                Realisasi tim
              </th>
              <th class="px-4 py-2 text-right">
                Bonus leader
              </th>
              <th class="px-4 py-2 text-right">
                Bonus team marketing
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr :class="tier ? '' : HI">
              <td class="px-4 py-2">
                <b v-if="!tier">Di bawah {{ rupiah(300000000) }} ✓</b>
                <template v-else>
                  Di bawah {{ rupiah(300000000) }}
                </template>
              </td>
              <td
                class="px-4 py-2 text-right num"
                :class="teksSel(selRealisasi(info.s3.total, 0, !tier)).redup ? 'text-dimmed' : 'font-bold'"
              >
                {{ teksSel(selRealisasi(info.s3.total, 0, !tier)).teks }}
              </td>
              <td class="px-4 py-2 text-right num">
                —
              </td>
              <td class="px-4 py-2 text-right num">
                —
              </td>
            </tr>
            <tr
              v-for="b in barisS3"
              :key="b.t.min"
              :class="b.aktif ? HI : ''"
            >
              <td class="px-4 py-2">
                <b v-if="b.aktif">{{ b.t.label }} ✓</b>
                <template v-else>
                  {{ b.t.label }}
                </template>
              </td>
              <td
                class="px-4 py-2 text-right num"
                :class="teksSel(selRealisasi(info.s3.total, b.t.min, b.aktif)).redup ? 'text-dimmed' : 'font-bold'"
              >
                {{ teksSel(selRealisasi(info.s3.total, b.t.min, b.aktif)).teks }}
              </td>
              <td
                class="px-4 py-2 text-right num"
                :class="b.aktif ? 'font-bold' : ''"
              >
                {{ rupiah(b.t.leader) }}
              </td>
              <td
                class="px-4 py-2 text-right num"
                :class="b.aktif ? 'font-bold' : ''"
              >
                {{ rupiah(b.t.tim) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="px-4 py-3">
        <UAlert
          v-if="!namaHead.length && !info.ketAda"
          color="warning"
          variant="soft"
          title="Tim/Keterangan dari Office belum termuat"
          description="Head belum bisa ditentukan, jadi seluruh PIC sementara dihitung memakai kolom Bonus Team Marketing. Muat ulang halaman; kalau tetap begini, Office-nya yang belum menjawab."
        />
        <UAlert
          v-else-if="!namaHead.length"
          color="warning"
          variant="soft"
          title="Head belum ditentukan"
          description="Seluruh PIC dihitung memakai kolom Bonus Team Marketing. Tentukan lewat Office: tambahkan kata Head pada kolom Tim/Keterangan orangnya, di samping Marketing. Kata yang dicari Head, bukan &quot;Leader&quot; — kalau keterangannya sudah terlanjur ditulis Leader, gantilah."
        />
        <UAlert
          v-else-if="namaHead.length > 1"
          color="warning"
          variant="soft"
          :title="`${namaHead.length} orang tercatat sebagai Head`"
          :description="`${namaHead.join(', ')} — semuanya menerima Bonus Leader. Kalau itu tidak disengaja, hapus kata Head pada kolom Tim/Keterangan yang tidak seharusnya di Office.`"
        />
        <p
          v-else
          class="text-xs text-muted"
        >
          Head: <b class="text-highlighted">{{ namaHead[0] }}</b> — dari kata <b>Head</b> di kolom Tim/Keterangan Office. PIC lain memakai kolom Bonus Team Marketing.
        </p>
      </div>
    </AppPanel>

    <AppPanel
      title="Skema 4 — Bonus non-tunai (insentif tambahan)"
      icon="i-lucide-gift"
      flush
    >
      <p class="px-4 pt-3 text-sm text-muted">
        Voucher, cuti, dan penghargaan — <b>tidak dijumlahkan</b> ke Bonus Tunai di atas.
        Nilainya rupiah, tapi yang keluar bukan uang: menjumlahkannya membuat angka yang tidak bisa dicairkan tampak seperti yang bisa.
      </p>
      <div class="overflow-x-auto">
        <table class="mt-3 w-full min-w-[34rem] text-sm">
          <thead class="bg-table-head text-left text-xs font-bold uppercase tracking-wide text-table-head-text">
            <tr>
              <th class="px-4 py-2">
                Insentif
              </th>
              <th class="px-4 py-2 text-right">
                Tercapai
              </th>
              <th class="px-4 py-2 text-right">
                Diperoleh
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="t in MK_S4_VOUCHER"
              :key="t.min"
              :class="jml(t.min) ? HI : ''"
            >
              <td class="px-4 py-2">
                Voucher F&B {{ rupiah(t.nilai) }} untuk tiap event ≥ {{ rupiah(t.min) }}
              </td>
              <td class="px-4 py-2 text-right num">
                {{ jml(t.min) }} event
              </td>
              <td class="px-4 py-2 text-right num">
                <b v-if="jml(t.min)">{{ rupiah(t.nilai * jml(t.min)) }} ✓</b>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </td>
            </tr>
            <tr :class="cuti ? HI : ''">
              <td class="px-4 py-2">
                1 hari cuti tambahan tiap {{ MK_S4_CUTI_PER }} event ≥ {{ rupiah(MK_S4_CUTI_MIN) }} dalam 1 bulan
              </td>
              <td class="px-4 py-2 text-right num">
                {{ evBesar }} event
              </td>
              <td class="px-4 py-2 text-right num">
                <b v-if="cuti">{{ cuti }} hari ✓</b>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </td>
            </tr>
            <tr :class="top ? HI : ''">
              <td class="px-4 py-2">
                Penghargaan “Top Marketer of the Month” (plakat & sertifikat) — realisasi ≥ {{ rupiah(MK_S4_TOP) }}
              </td>
              <td class="px-4 py-2 text-right num">
                {{ semua ? `${info.topSemua.length} PIC` : '—' }}
              </td>
              <td class="px-4 py-2 text-right num">
                <template v-if="semua">
                  <b v-if="info.topSemua.length">{{ info.topSemua.join(', ') }} ✓</b>
                  <span
                    v-else
                    class="text-dimmed"
                  >belum ada</span>
                </template>
                <template v-else>
                  <b v-if="top">Tercapai ✓</b>
                  <span
                    v-else
                    class="text-dimmed"
                  >belum</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="px-4 py-3 text-xs text-muted">
        Cuti tambahan berlaku <b>akumulatif selama 1 tahun</b>. Sisa event yang belum genap {{ MK_S4_CUTI_PER }} tidak dibulatkan ke atas —
        dan tidak dibawa ke bulan berikutnya oleh halaman ini, karena periode yang dibaca cuma yang dipilih di atas.
      </p>
    </AppPanel>
  </div>
</template>
