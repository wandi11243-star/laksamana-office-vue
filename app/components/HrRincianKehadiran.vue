<!--
  Rincian harian satu kru (deploy/hr/index.html openAttDetail :1739-1763):
  the answer to "which days?". Late minutes under the tolerance are shown in
  brackets — they are recorded but do not reduce the score.
-->
<script setup lang="ts">
import type { HrEmployee } from '~/utils/hr'
import { attendanceDetail, attRules } from '~/utils/people-score'
import { useHrDasar } from '~/composables/useHr'
import { labelBulanJadwal } from '~/utils/jadwal'

const props = defineProps<{ e: HrEmployee | null, mk: string }>()
const open = defineModel<boolean>('open', { default: false })

const { s } = useHrDasar()
const detail = computed(() => (props.e ? attendanceDetail(s.value, props.e.id, props.mk) : null))
const toleransi = computed(() => attRules(s.value).lateToleranceMin ?? 15)

const LABEL: Record<string, string> = {
  'hadir': 'Hadir',
  'tanpa-checkout': 'Tanpa check-out',
  'alpa': 'Alpa',
  'libur': 'Libur',
  'izin': 'Izin/cuti',
  'izin-lewat': 'Izin lewat jatah',
}
const warna = (st: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' =>
  st === 'hadir' ? 'success' : st === 'tanpa-checkout' ? 'warning' : st === 'alpa' || st === 'izin-lewat' ? 'error' : st === 'izin' ? 'info' : 'neutral'
const ikon = (st: string) => (st === 'hadir' ? 'i-lucide-check' : st === 'alpa' || st === 'izin-lewat' ? 'i-lucide-x' : st === 'izin' ? 'i-lucide-calendar-check' : st === 'libur' ? 'i-lucide-palmtree' : 'i-lucide-clock')
const telatTeks = (m: number) => (m > toleransi.value ? `${m}m` : m ? `(${m}m)` : '—')
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`Rincian kehadiran — ${e?.name ?? ''}, ${labelBulanJadwal(mk)}`"
  >
    <div
      v-if="detail"
      class="space-y-3"
    >
      <p
        v-if="detail.noData"
        class="rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        <b>Tidak ada skor</b> — tidak ditemukan satu pun check-in bulan ini, jadi datanya dianggap tidak
        terekam, bukan tidak masuk.
      </p>
      <p
        v-else
        class="rounded-field bg-info/10 px-3 py-2 text-sm"
      >
        Skor <b>{{ Math.round((detail.score ?? 0) * 10) / 10 }}</b>
        (presensi {{ Math.round((detail.presence ?? 0) * 10) / 10 }},
        ketepatan {{ Math.round((detail.punctuality ?? 0) * 10) / 10 }}).
      </p>

      <div class="overflow-x-auto">
        <table class="w-full min-w-96 text-sm">
          <thead>
            <tr>
              <th class="py-1.5 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                Tanggal
              </th>
              <th class="py-1.5 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                Shift
              </th>
              <th class="py-1.5 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                Kode
              </th>
              <th class="py-1.5 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                Masuk
              </th>
              <th class="py-1.5 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                Pulang
              </th>
              <th class="py-1.5 text-end text-[11px] font-bold uppercase tracking-wider text-muted">
                Telat
              </th>
              <th class="py-1.5 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="h in detail.rincian"
              :key="h.date"
              :class="(h.status === 'alpa' || h.status === 'izin-lewat') && 'bg-error/8'"
            >
              <td class="py-1.5 text-muted num">
                {{ h.date }}
              </td>
              <td class="py-1.5">
                {{ h.shift || '—' }}
              </td>
              <td class="py-1.5 text-muted num">
                {{ h.code || '—' }}
              </td>
              <td class="py-1.5 num">
                {{ h.checkIn || '—' }}
              </td>
              <td class="py-1.5 num">
                {{ h.checkOut || '—' }}
              </td>
              <td class="py-1.5 text-end num">
                {{ telatTeks(h.lateMin) }}
              </td>
              <td class="py-1.5">
                <AppStatus
                  :color="warna(h.status)"
                  :icon="ikon(h.status)"
                  size="sm"
                >
                  {{ LABEL[h.status] ?? h.status }}
                </AppStatus>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted">
        Angka telat dalam kurung masih di bawah toleransi {{ toleransi }} menit, jadi tidak mengurangi skor.
      </p>
    </div>
  </ResponsiveSheet>
</template>
