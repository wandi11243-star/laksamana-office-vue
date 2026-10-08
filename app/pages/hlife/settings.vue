<!--
  Data, Sync & Login — the old viewSettings (howandi_life/index.html:811-829).
  The browser password gate is NOT rebuilt: v1 already guards the module with
  Bearer + `module:howandi_life`, and the API does not enforce `settings/auth`
  (hlife.md H, F.4). Storage/backup and the Google Calendar guide stay.

  "Reset data" is deferred: it needs a whole-document endpoint that v1 does not
  have yet (K-01 = C, G-13), so it shows as "Segera".
-->
<script setup lang="ts">
import { useHlifeState } from '~/composables/useHlife'
import { icsDari } from '~/utils/hlife'

definePageMeta({ access: ['howandi_life'] })

const toast = useToast()

const { data: state, status, error } = useHlifeState()

function unduh(nama: string, isi: string, tipe: string) {
  const blob = new Blob([isi], { type: tipe })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  a.click()
  URL.revokeObjectURL(url)
}

function backupJson() {
  if (!state.value) return
  unduh('howandi-life-os-backup.json', JSON.stringify(state.value, null, 2), 'application/json')
  toast.add({ title: 'Backup diunduh.', color: 'success' })
}

function eksporIcs() {
  const s = state.value
  if (!s) return
  unduh('howandi-life-os.ics', icsDari({ events: s.events ?? [], tasks: s.tasks ?? [], content: s.content ?? [] }), 'text/calendar')
  toast.add({ title: 'File .ics diunduh — import ke Google Calendar.', color: 'success' })
}
</script>

<template>
  <AppPage
    title="Data, Sync & Login"
    description="Penyimpanan, backup, integrasi Google Calendar, dan proteksi akses."
  >
    <p
      v-if="error"
      class="mb-4 rounded-field border border-error/30 bg-error/10 p-3 text-sm"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <div class="grid gap-5 lg:grid-cols-2">
      <!-- Access protection -->
      <AppPanel
        title="Proteksi akses"
        icon="i-lucide-shield-check"
      >
        <p class="text-sm text-muted">
          Howandi Life OS hanya terbuka untuk pemegang modul <b class="text-highlighted">howandi_life</b>.
          Setiap permintaan memakai token Office (Bearer) dan ditolak API bila modulnya tidak dimiliki —
          termasuk superadmin, yang sengaja tidak otomatis mendapat akses ke sini.
        </p>
        <p class="mt-3 text-sm text-muted">
          Kunci password sisi-browser Office lama <b>tidak dibangun lagi</b> di Vue: dahulu ia hanya
          penghalang di peramban dan tidak pernah ditegakkan server. Gunakan login Office untuk keluar
          dari modul ini.
        </p>
      </AppPanel>

      <!-- Storage & backup -->
      <AppPanel
        title="Penyimpanan & backup"
        icon="i-lucide-database"
      >
        <p class="text-sm text-muted">
          Data tersimpan otomatis di <b class="text-highlighted">database</b> (bukan di browser).
          Semua perangkat melihat data yang sama, dan setiap tulisan diperiksa versinya.
        </p>
        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            label="Backup JSON"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            :disabled="status === 'pending' || !state"
            @click="backupJson"
          />
          <UButton
            label="Export .ics"
            icon="i-lucide-calendar-arrow-down"
            color="neutral"
            variant="outline"
            :disabled="status === 'pending' || !state"
            @click="eksporIcs"
          />
          <UButton
            label="Segera"
            icon="i-lucide-trash-2"
            color="neutral"
            variant="outline"
            disabled
          />
        </div>
        <p class="mt-3 text-xs text-dimmed">
          Reset data ditunda: butuh endpoint pengosongan massal <code>POST /hlife/admin/reset</code>
          (K-01 / G-13) yang belum ada di v1. Sampai itu tersedia, tombolnya tidak dibangun.
        </p>
      </AppPanel>

      <!-- Google Calendar -->
      <AppPanel
        class="lg:col-span-2"
        title="Google Calendar — 3 cara integrasi"
        icon="i-lucide-calendar-check"
      >
        <div class="grid gap-4 lg:grid-cols-3">
          <div>
            <p class="font-semibold text-highlighted">
              1. Add 1-klik
              <AppStatus
                size="sm"
                color="success"
                icon="i-lucide-circle-check"
                class="ms-1"
              >
                jalan sekarang
              </AppStatus>
            </p>
            <p class="mt-1 text-sm text-muted">
              Ikon kalender di tiap task/event membuka Google Calendar dengan detail terisi.
            </p>
          </div>
          <div>
            <p class="font-semibold text-highlighted">
              2. Export .ics
              <AppStatus
                size="sm"
                color="success"
                icon="i-lucide-circle-check"
                class="ms-1"
              >
                jalan sekarang
              </AppStatus>
            </p>
            <p class="mt-1 text-sm text-muted">
              Semua event + deadline + konten menjadi satu berkas .ics: Google Calendar →
              Setelan → Import.
            </p>
          </div>
          <div>
            <p class="font-semibold text-highlighted">
              3. Auto 2-arah via n8n
              <AppStatus
                size="sm"
                color="neutral"
                icon="i-lucide-clock"
                class="ms-1"
              >
                belum
              </AppStatus>
            </p>
            <p class="mt-1 text-sm text-muted">
              Sinkron otomatis (n8n DB Trigger → Google Calendar). SSOT waktu = Calendar.
            </p>
          </div>
        </div>
      </AppPanel>
    </div>
  </AppPage>
</template>
