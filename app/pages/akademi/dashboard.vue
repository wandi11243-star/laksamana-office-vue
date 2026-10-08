<!--
  Beranda (deploy/akademi/index.html vDashboard, :908-933): four numbers, the
  current month's program, the mandatory materials still open (or a plain
  "everything done" panel) and the three newest materials.

  The viewer + quiz are shared with Materi / Perpustakaan / Program through
  usePenontonMateri(), so completing a material here behaves the same everywhere.
-->
<script setup lang="ts">
import { muatAkademiKru, sinkronRosterAkademi, useAkademiData, usePenontonMateri } from '~/composables/useAkademi'
import { useModulMembers } from '~/composables/useRoster'
import { kunciBulanIni, materiProgramUntuk, materiUntuk, namaDivisi, selesaiMateri, statKru, statProgram, terbaruDulu } from '~/utils/akademi-hitung'
import { statusSertifikasi } from '~/utils/status-akademi'
import KartuMateri from '~/widgets/akademi/KartuMateri.vue'
import SheetKuis from '~/widgets/akademi/SheetKuis.vue'
import SheetMateri from '~/widgets/akademi/SheetMateri.vue'

definePageMeta({ access: ['akademi'] })

const { me, materials, programs, progress, progProg, divisions, users, kru, isAdmin, refresh } = useAkademiData()
muatAkademiKru()

const viewer = usePenontonMateri()
const { buka, materi, dariProgram, dalamLingkup, selesai, progresMateri, passingDefault, bukaMateri, tandaiSelesai, simpanKuis } = viewer

const st = computed(() => (kru.value ? statKru(kru.value, materials.value, progress.value) : null))
const namaDepan = computed(() => (me.value?.name ?? 'Kru').split(' ')[0])
const sert = computed(() => statusSertifikasi(!!st.value?.certified))

const materiSaya = computed(() => (kru.value ? materiUntuk(kru.value, materials.value) : []))
const wajibBelum = computed(() => (kru.value ? materiSaya.value.filter(m => m.mandatory && !selesaiMateri(kru.value!.id, m, progress.value)).slice(0, 6) : []))
const terbaru = computed(() => [...materiSaya.value].sort(terbaruDulu).slice(0, 3))

const programBulanIni = computed(() => programs.value
  .filter(p => p.bulan === kunciBulanIni() && kru.value && materiProgramUntuk(kru.value, p, materials.value).length > 0)
  .sort((a, b) => b.bulan.localeCompare(a.bulan)))

const divisiNama = computed(() => namaDivisi(divisions.value, kru.value?.division ?? 'all'))

// Roster sync: Office is the only source of the crew list (T-01). Admin-only,
// best-effort, once per session; a non-admin opening the module cannot write.
const { data: anggota } = useModulMembers('akademi')
const pernahSinkron = useState('akademi-sinkron', () => false)
watch(anggota, async (list) => {
  if (!isAdmin.value || pernahSinkron.value || !list?.length) return
  pernahSinkron.value = true
  try {
    const ubah = await sinkronRosterAkademi(users.value, list)
    if (ubah) await refresh()
  }
  catch {
    // Roster is a convenience; a failure must never block the dashboard.
  }
}, { immediate: true })
</script>

<template>
  <AppPage
    :title="`Halo, ${namaDepan}`"
    :description="`${divisiNama}, ${st?.certified ? 'Kru Tersertifikasi' : 'Selesaikan materi wajib untuk sertifikasi'}`"
  >
    <template #actions>
      <UButton
        label="Buka Program"
        icon="i-lucide-calendar-days"
        color="neutral"
        variant="outline"
        to="/akademi/program"
      />
    </template>

    <AppStatGrid>
      <AppStat
        label="Materi Wajib Selesai"
        icon="i-lucide-flag"
        tone="warning"
        :value="`${st?.mandPct ?? 0}%`"
        :sub="`${st?.mandDone ?? 0}/${st?.mandTotal ?? 0} wajib`"
      />
      <AppStat
        label="Total Materi Selesai"
        icon="i-lucide-book-open-check"
        tone="info"
        :value="`${st?.done ?? 0}/${st?.total ?? 0}`"
        :sub="`${st?.pct ?? 0}% semua materi`"
      />
      <AppStat
        label="Wajib Selesai"
        icon="i-lucide-circle-check"
        tone="success"
        :value="`${st?.mandDone ?? 0}/${st?.mandTotal ?? 0}`"
        sub="materi wajib divisimu"
      />
      <AppStat
        label="Sertifikasi Kru"
        :icon="sert.icon"
        :tone="sert.tone === 'success' ? 'success' : 'warning'"
        :value="sert.label"
        :sub="`${st?.mandTotal ?? 0} materi wajib`"
        wrap
      />
    </AppStatGrid>

    <AppPanel
      v-for="p in programBulanIni"
      :key="p.id"
      :title="p.title"
      icon="i-lucide-calendar-days"
    >
      <template #actions>
        <UButton
          label="Buka Program"
          size="sm"
          to="/akademi/program"
        />
      </template>
      <p class="text-[12.5px] text-muted">
        Deadline {{ p.deadline }}, {{ kru ? statProgram(kru, p, materials, progProg).done : 0 }}/{{ kru ? statProgram(kru, p, materials, progProg).total : 0 }} item selesai
      </p>
      <div class="mt-2.5 h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          class="h-full rounded-full bg-primary-400"
          :style="{ width: `${kru ? statProgram(kru, p, materials, progProg).pct : 0}%` }"
        />
      </div>
    </AppPanel>

    <AppPanel
      v-if="wajibBelum.length"
      title="Materi Wajib yang Belum Selesai"
      icon="i-lucide-flag"
      :count="wajibBelum.length"
    >
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KartuMateri
          v-for="m in wajibBelum"
          :key="m.id"
          :materi="m"
          :divisions="divisions"
          :skor="progress[kru?.id ?? '']?.[m.id]?.score ?? null"
          @buka="bukaMateri"
        />
      </div>
    </AppPanel>
    <AppPanel
      v-else-if="st"
      title="Semua materi wajib selesai"
      icon="i-lucide-medal"
    >
      <p class="text-[13.5px] text-muted">
        Kamu sudah memenuhi standar divisi. Buka Progress & Sertifikat untuk melihat sertifikatmu.
      </p>
      <UButton
        label="Lihat sertifikat"
        icon="i-lucide-award"
        color="neutral"
        variant="outline"
        class="mt-3"
        to="/akademi/sertifikat"
      />
    </AppPanel>

    <AppPanel
      title="Materi Terbaru"
      icon="i-lucide-sparkles"
    >
      <div
        v-if="terbaru.length"
        class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <KartuMateri
          v-for="m in terbaru"
          :key="m.id"
          :materi="m"
          :divisions="divisions"
          :selesai="kru ? selesaiMateri(kru.id, m, progress) : false"
          :skor="progress[kru?.id ?? '']?.[m.id]?.score ?? null"
          @buka="bukaMateri"
        />
      </div>
      <p
        v-else
        class="text-sm text-muted"
      >
        Belum ada materi untuk divisimu.
      </p>
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
