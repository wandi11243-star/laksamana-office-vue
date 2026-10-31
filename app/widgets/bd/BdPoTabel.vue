<!--
  The purchase-order table (old `poTabel`, deploy/bd/index.html:3241-3282), shared
  by "Semua Item" and the weekly recap. A row whose value is not yet known shows
  "belum dihitung", never "Rp 0": zero would read as free.
-->
<script setup lang="ts">
import type { BdPerson, BdPo, BdProject } from '~/composables/useBd'
import { fDue, fRpPenuh, fWaktu, poBeres, poRequester, sisaHari } from '~/utils/bd-rumus'
import { WARNA_PO } from '~/utils/status-bd'

const props = defineProps<{
  list: BdPo[]
  people: BdPerson[]
  projects: BdProject[]
}>()
const emit = defineEmits<{ buka: [BdPo], hapus: [BdPo], proses: [BdPo] }>()

const namaProject = (id?: string | null) => props.projects.find(p => p.id === id)?.name
</script>

<template>
  <div class="grid gap-3 lg:hidden">
    <div
      v-for="p in list"
      :key="p.id"
      class="rounded-panel border border-default bg-default px-4 py-3.5 shadow-panel lg:px-5"
    >
      <div class="flex items-start justify-between gap-2">
        <button
          type="button"
          class="min-w-0 flex-1 text-start"
          @click="emit('buka', p)"
        >
          <span class="block font-semibold text-highlighted">{{ p.item }}</span>
          <span
            v-if="namaProject(p.project)"
            class="mt-0.5 block text-xs text-ink-900"
          >{{ namaProject(p.project) }}</span>
          <span class="mt-1 block text-xs text-muted">{{ poRequester(p, people) }} · {{ p.vendor || '—' }}</span>
        </button>
        <AppStatus
          :color="WARNA_PO[p.status] || 'neutral'"
          size="sm"
        >
          {{ p.status }}
        </AppStatus>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <AppStatus size="sm">
          {{ Number(p.qty) || 0 }} {{ p.unit }}
        </AppStatus>
        <AppStatus
          size="sm"
          :color="poBeres(p) ? 'success' : 'neutral'"
        >
          {{ poBeres(p) ? 'Done' : fDue(p.needBy) }}
        </AppStatus>
        <AppStatus
          v-if="!poBeres(p) && sisaHari(p.needBy) < 0"
          color="error"
          size="sm"
        >
          Telat
        </AppStatus>
      </div>
      <div class="mt-2 flex items-center gap-2">
        <span class="text-sm font-semibold text-highlighted num">{{ Number(p.amount) ? fRpPenuh(p.amount) : 'belum dihitung' }}</span>
        <div class="flex-1" />
        <UButton
          :label="poBeres(p) ? 'Batalkan' : 'Done'"
          color="neutral"
          variant="outline"
          size="xs"
          @click="emit('proses', p)"
        />
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Ubah"
          @click="emit('buka', p)"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Hapus"
          @click="emit('hapus', p)"
        />
      </div>
    </div>
    <p
      v-if="!list.length"
      class="py-6 text-center text-sm text-muted"
    >
      <b class="block text-highlighted">Tidak ada PO</b>
    </p>
  </div>

  <div class="hidden overflow-x-auto lg:block">
    <table class="w-full text-sm">
      <thead class="bg-muted text-muted">
        <tr>
          <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
            Item
          </th>
          <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
            Peminta
          </th>
          <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
            Diinput
          </th>
          <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
            Vendor
          </th>
          <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
            Qty
          </th>
          <th class="px-3 py-2 text-end text-[11px] uppercase tracking-wide">
            Nilai
          </th>
          <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
            Divisi
          </th>
          <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
            Butuh
          </th>
          <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
            Proses
          </th>
          <th class="px-3 py-2 text-start text-[11px] uppercase tracking-wide">
            Status
          </th>
          <th class="px-3 py-2" />
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr
          v-for="p in list"
          :key="p.id"
          class="cursor-pointer hover:bg-elevated/50"
          @click="emit('buka', p)"
        >
          <td class="px-3 py-2">
            <span class="font-semibold text-highlighted">{{ p.item }}</span>
            <div
              v-if="namaProject(p.project)"
              class="text-xs text-ink-900"
            >
              {{ namaProject(p.project) }}
            </div>
            <div
              v-if="p.note"
              class="text-[11.5px] text-muted"
            >
              {{ p.note }}
            </div>
          </td>
          <td class="px-3 py-2 text-muted">
            {{ poRequester(p, people) }}
            <div
              v-if="p.sumber"
              class="text-xs"
            >
              <AppStatus size="sm">
                dari {{ p.sumber }}
              </AppStatus>
            </div>
          </td>
          <td class="px-3 py-2 whitespace-nowrap text-muted">
            {{ fWaktu(p.at) }}
            <div
              v-if="p.input && p.input !== poRequester(p, people)"
              class="text-[11px]"
            >
              oleh {{ p.input }}
            </div>
          </td>
          <td class="px-3 py-2 text-muted">
            {{ p.vendor || '—' }}
          </td>
          <td class="px-3 py-2 text-muted num">
            {{ Number(p.qty) || 0 }} {{ p.unit }}
          </td>
          <td class="px-3 py-2 text-end">
            <span
              v-if="!(Number(p.amount)) && (p.status === 'Draft' || p.status === 'Diajukan')"
              class="text-muted"
            >belum dihitung</span>
            <span
              v-else
              class="font-semibold text-highlighted num"
            >{{ fRpPenuh(p.amount) }}</span>
          </td>
          <td class="px-3 py-2">
            <AppStatus size="sm">
              {{ String(p.div || '').split(' ')[0] }}
            </AppStatus>
          </td>
          <td class="px-3 py-2">
            <AppStatus
              v-if="poBeres(p)"
              color="success"
              size="sm"
            >
              Done
            </AppStatus>
            <span
              v-else
              :class="sisaHari(p.needBy) < 0 ? 'font-semibold text-error' : 'text-muted'"
            >{{ fDue(p.needBy) }}</span>
          </td>
          <td class="px-3 py-2">
            <button
              type="button"
              class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="p.proses ? 'bg-success/12 text-success' : 'bg-muted text-muted'"
              @click.stop="emit('proses', p)"
            >
              {{ p.proses ? 'Selesai' : 'Belum' }}
            </button>
          </td>
          <td class="px-3 py-2">
            <AppStatus
              :color="WARNA_PO[p.status] || 'neutral'"
              size="sm"
            >
              {{ p.status }}
            </AppStatus>
          </td>
          <td class="px-3 py-2">
            <div class="flex justify-end">
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Hapus"
                @click.stop="emit('hapus', p)"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
