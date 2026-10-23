<!--
  Program Bulanan (deploy/akademi/index.html vProgram, :1452-1483): one card per
  monthly program, newest month first. Program items are counted separately from
  normal progress, and an item already passed before is still a "Refresher" that
  must be redone (:1472).
-->
<script setup lang="ts">
import { muatAkademiKru, useAkademiData, usePenontonMateri } from '~/composables/useAkademi'
import { itemProgramSelesai, kunciBulanIni, labelBulan, materiProgramUntuk, selesaiMateri, statProgram } from '~/utils/akademi-hitung'
import { statusProgram, statusTipe } from '~/utils/status-akademi'
import SheetKuis from '~/widgets/akademi/SheetKuis.vue'
import SheetMateri from '~/widgets/akademi/SheetMateri.vue'

definePageMeta({ access: ['akademi'] })

const { materials, programs, progress, progProg, divisions, kru, isAdmin } = useAkademiData()
muatAkademiKru()

const viewer = usePenontonMateri()
const { buka, materi, dariProgram, dalamLingkup, selesai, progresMateri, passingDefault, bukaMateri, tandaiSelesai, simpanKuis } = viewer

const progs = computed(() => [...programs.value].sort((a, b) => b.bulan.localeCompare(a.bulan)))

const stat = (p: (typeof programs.value)[number]) => (kru.value ? statProgram(kru.value, p, materials.value, progProg.value) : { total: 0, done: 0, pct: 100 })
const itemStat = (p: (typeof programs.value)[number]) => {
  const s = stat(p)
  return statusProgram({ total: s.total, pct: s.pct, over: new Date(`${p.deadline}T23:59:59`) < new Date(), isCur: p.bulan === kunciBulanIni() })
}
const items = (p: (typeof programs.value)[number]) => (kru.value ? materiProgramUntuk(kru.value, p, materials.value) : [])
const sudahItem = (p: (typeof programs.value)[number], matId: string) => (kru.value ? itemProgramSelesai(kru.value.id, p.id, matId, progProg.value) : false)
// Reimagine (B): one focal action per program card. Only the next unfinished
// item gets the solid gold button; the rest stay neutral so the eye lands once.
const pertamaBelumIdx = (p: (typeof programs.value)[number]) => items(p).findIndex(m => !sudahItem(p, m.id))
</script>

<template>
  <AppPage
    title="Program Bulanan"
    description="Training baru & refresher tiap bulan, standar dijaga terus, bukan sekali jalan"
  >
    <AppPanel
      v-if="!progs.length"
      title="Belum ada program bulanan"
      icon="i-lucide-calendar-days"
    >
      <p class="text-sm text-muted">
        {{ isAdmin ? 'Buat di menu Kelola Program.' : 'Tunggu pengumuman dari manajemen ya!' }}
      </p>
    </AppPanel>

    <AppPanel
      v-for="p in progs"
      :key="p.id"
      :title="p.title"
      icon="i-lucide-calendar-days"
    >
      <template #actions>
        <AppStatus
          :color="itemStat(p).tone"
          :icon="itemStat(p).icon"
        >
          {{ itemStat(p).label }}
        </AppStatus>
      </template>
      <p class="text-[12px] text-muted">
        {{ labelBulan(p.bulan) }}, deadline {{ p.deadline }}
      </p>
      <p
        v-if="p.note"
        class="mt-1 text-[13px] text-muted"
      >
        {{ p.note }}
      </p>
      <div
        v-if="stat(p).total > 0"
        class="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          class="h-full rounded-full bg-primary-400"
          :style="{ width: `${stat(p).pct}%` }"
        />
      </div>

      <div class="mt-3 divide-y divide-default">
        <div
          v-for="(m, idx) in items(p)"
          :key="m.id"
          class="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 font-semibold text-highlighted">
              <UIcon
                :name="statusTipe(m.type).icon"
                class="size-4 text-muted"
              />
              {{ m.title }}
            </p>
            <div class="mt-1 flex flex-wrap items-center gap-1.5">
              <AppStatus
                :color="statusTipe(m.type).tone"
                :icon="statusTipe(m.type).icon"
                size="sm"
              >
                {{ statusTipe(m.type).label }}
              </AppStatus>
              <AppStatus
                v-if="kru && !sudahItem(p, m.id) && selesaiMateri(kru.id, m, progress)"
                color="info"
                icon="i-lucide-repeat"
                size="sm"
              >
                Refresher
              </AppStatus>
            </div>
          </div>
          <AppStatus
            v-if="sudahItem(p, m.id)"
            color="success"
            icon="i-lucide-circle-check"
          >
            Selesai
          </AppStatus>
          <UButton
            v-else
            label="Kerjakan"
            size="sm"
            :color="idx === pertamaBelumIdx(p) ? 'primary' : 'neutral'"
            :variant="idx === pertamaBelumIdx(p) ? 'solid' : 'outline'"
            @click="bukaMateri(m.id, p.id)"
          />
        </div>
        <p
          v-if="!items(p).length"
          class="py-3 text-sm text-muted"
        >
          Tidak ada item divisimu di program ini.
        </p>
      </div>
    </AppPanel>

    <SheetMateri
      v-if="materi && materi.type !== 'quiz'"
      v-model:open="buka"
      :materi="materi"
      :dalam-lingkup="dalamLingkup"
      :selesai="selesai"
      :dari-program="dariProgram"
      :divisions="divisions"
      @selesai="tandaiSelesai"
    />
    <SheetKuis
      v-else-if="materi"
      v-model:open="buka"
      :materi="materi"
      :dalam-lingkup="dalamLingkup"
      :selesai="selesai"
      :dari-program="dariProgram"
      :entry="progresMateri"
      :passing-default="passingDefault"
      @simpan="simpanKuis"
    />
  </AppPage>
</template>
