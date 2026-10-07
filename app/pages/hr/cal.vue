<!--
  HR › Kalender HR (deploy/hr/index.html RENDER.cal :2532-2567). Daily shifts
  stay in Talenta; this calendar is for HR agendas, plus automatic birthdays,
  contract ends and probations computed from the crew profiles (F.11) — those
  automatic rows have no id and cannot be deleted.
-->
<script setup lang="ts">
import { canHr } from '~/utils/hr'
import { calendarItemsHr } from '~/utils/people-score'
import { hrDelete, hrPostAudit, useHrDasar } from '~/composables/useHr'
import { fTglP, hariIni } from '~/utils/format'

definePageMeta({ access: ['hr'] })

const toast = useToast()
const { s, cu, officeAdmin, error, refresh } = useHrDasar()
const admin = computed(() => canHr('manageOps', cu.value, officeAdmin.value))

const semua = computed(() => calendarItemsHr(s.value))
const mendatang = computed(() => semua.value.filter(x => x.date >= hariIni()))
const lewat = computed(() => semua.value.filter(x => x.date < hariIni()).slice(-6))

const agendaOpen = ref(false)

const hapus = ref<{ id: string, title: string } | null>(null)
const hapusOpen = ref(false)
async function jalanHapus() {
  if (!hapus.value) return
  try {
    await hrDelete('calendar', hapus.value.id)
    try {
      await hrPostAudit('CAL_DEL', hapus.value.title)
    }
    catch {
      // Audit is a bonus.
    }
    hapusOpen.value = false
    toast.add({ title: 'Agenda dihapus', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menghapus: ${apiErrorMessage(e)}`, color: 'error' })
  }
}
async function sesudah() {
  await refresh()
}
const nada = (kind: string): 'info' | 'gold' | 'error' | 'warning' | 'neutral' =>
  kind === 'Training' ? 'info' : kind === 'Event' || kind === 'Birthday' ? 'gold' : kind === 'Kontrak' ? 'error' : kind === 'Probation' ? 'warning' : 'neutral'
const ikon = (kind: string) => (kind === 'Birthday' ? 'i-lucide-cake' : kind === 'Kontrak' ? 'i-lucide-file-clock' : kind === 'Probation' ? 'i-lucide-hourglass' : kind === 'Training' ? 'i-lucide-graduation-cap' : 'i-lucide-calendar')
</script>

<template>
  <AppPage
    title="Kalender HR"
    description="Agenda HR & tanggal penting."
  >
    <template
      v-if="admin"
      #actions
    >
      <UButton
        label="Agenda"
        icon="i-lucide-plus"
        @click="agendaOpen = true"
      />
    </template>

    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel
      v-if="!admin"
      title="Halaman ini untuk admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Agenda HR diatur admin modul <b>hr</b> (dari Kelola Akses Office).
      </p>
    </AppPanel>

    <template v-else>
      <AppPanel>
        <p class="rounded-field bg-muted px-3 py-2 text-sm text-muted">
          Shift harian tetap di Talenta. Kalender ini untuk agenda HR: training, meeting, event internal, ulang
          tahun, kontrak habis, probation selesai (2 terakhir otomatis dari profil kru).
        </p>
      </AppPanel>

      <AppPanel
        title="Agenda mendatang"
        icon="i-lucide-calendar-days"
        :count="mendatang.length"
        flush
      >
        <div
          v-if="mendatang.length"
          class="divide-y divide-default"
        >
          <div
            v-for="(ev, i) in mendatang"
            :key="`${ev.date}-${i}`"
            class="flex items-center gap-3 px-4 py-3 lg:px-5"
          >
            <span class="w-24 shrink-0 text-sm text-muted num">{{ fTglP(ev.date) }}</span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-highlighted">
                {{ ev.title }}
              </p>
              <p
                v-if="ev.note"
                class="text-[13px] text-muted"
              >
                {{ ev.note }}
              </p>
            </div>
            <AppStatus
              :color="nada(ev.kind)"
              :icon="ikon(ev.kind)"
              size="sm"
            >
              {{ ev.kind }}
            </AppStatus>
            <UButton
              v-if="ev.id"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              :aria-label="`Hapus agenda ${ev.title}`"
              @click="hapus = { id: ev.id, title: ev.title }; hapusOpen = true"
            />
          </div>
        </div>
        <p
          v-else
          class="px-4 py-8 text-center text-muted"
        >
          Belum ada agenda.
        </p>
      </AppPanel>

      <AppPanel
        v-if="lewat.length"
        title="Sudah lewat"
        icon="i-lucide-history"
        :count="lewat.length"
        flush
      >
        <div class="divide-y divide-default">
          <div
            v-for="(ev, i) in lewat"
            :key="`${ev.date}-${i}`"
            class="flex items-center gap-3 px-4 py-2.5 lg:px-5"
          >
            <span class="w-24 shrink-0 text-sm text-muted num">{{ fTglP(ev.date) }}</span>
            <span class="min-w-0 flex-1 truncate text-sm text-muted">{{ ev.title }}</span>
            <AppStatus
              color="neutral"
              size="sm"
            >
              {{ ev.kind }}
            </AppStatus>
          </div>
        </div>
      </AppPanel>
    </template>

    <HrAgendaSheet
      v-model:open="agendaOpen"
      @saved="sesudah"
    />

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="hapus ? `Hapus agenda &quot;${hapus.title}&quot;?` : 'Hapus agenda?'"
    >
      <p class="text-sm">
        Agenda ini dihapus dari kalender. Baris otomatis (ulang tahun, kontrak, probation) tidak bisa dihapus dari
        sini — ubah datanya di halaman Kru.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          @click="jalanHapus"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="hapusOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
