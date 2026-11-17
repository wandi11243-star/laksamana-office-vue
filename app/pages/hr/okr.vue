<!--
  HR › OKR & Target (deploy/hr/index.html RENDER.okr :1915-1970). Cards per OKR
  with its key results; overall progress is the average of each KR's capped
  percentage. Owner may be a division or one person. Anyone with `inputKpi`
  may add/edit, and progress updates replace the record (v1 is per-record).
-->
<script setup lang="ts">
import type { HrOkr } from '~/utils/hr'
import { activeEmps, canHr, divName } from '~/utils/hr'
import { clamp, rataRata } from '~/utils/people-score'
import { hrDelete, hrPostAudit, useHrDasar } from '~/composables/useHr'
import { angka } from '~/utils/format'

definePageMeta({ access: ['hr'] })

const toast = useToast()
const { s, cu, officeAdmin, error, refresh } = useHrDasar()

const adaInput = computed(() => canHr('inputKpi', cu.value, officeAdmin.value))
const daftar = computed(() => s.value.okrs.slice().sort((a, b) => (b.period || '').localeCompare(a.period || '')))

const progresKr = (k: { target: number, progress: number }) => (k.target > 0 ? clamp((k.progress / k.target) * 100, 0, 100) : 0)
const progresOkr = (o: HrOkr) => rataRata(o.krs.map(progresKr)) ?? 0
const namaPemilik = (o: HrOkr) => (o.ownerType === 'emp'
  ? (activeEmps(s.value).find(e => e.id === o.ownerId)?.name ?? '—')
  : divName(s.value, o.ownerId))

const sheetOpen = ref(false)
const edit = ref<HrOkr | null>(null)
function bukaOkr(o: HrOkr | null) {
  edit.value = o
  sheetOpen.value = true
}

const progOpen = ref(false)
const progOkr = ref<HrOkr | null>(null)
const progIndex = ref(0)
function bukaProgress(o: HrOkr, i: number) {
  progOkr.value = o
  progIndex.value = i
  progOpen.value = true
}

const hapusOpen = ref(false)
const hapusO = ref<HrOkr | null>(null)
async function jalanHapus() {
  if (!hapusO.value) return
  try {
    await hrDelete('okrs', hapusO.value.id)
    try {
      await hrPostAudit('OKR_DEL', hapusO.value.id)
    }
    catch {
      // Audit is a bonus.
    }
    hapusOpen.value = false
    toast.add({ title: 'OKR dihapus', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menghapus: ${apiErrorMessage(e)}`, color: 'error' })
  }
}
async function sesudah() {
  await refresh()
}
</script>

<template>
  <AppPage
    title="OKR & Target"
    description="Objective dan key result."
  >
    <template
      v-if="adaInput"
      #actions
    >
      <UButton
        label="OKR baru"
        icon="i-lucide-plus"
        @click="bukaOkr(null)"
      />
    </template>

    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel>
      <p
        v-if="!daftar.length"
        class="rounded-field bg-muted px-3 py-6 text-center text-sm text-muted"
      >
        Belum ada OKR. Contoh: Marketing Q3, Sponsor 50 juta, 30 konten, 4 event, 15 partnership.
      </p>

      <div class="grid gap-4 lg:grid-cols-2">
        <div
          v-for="o in daftar"
          :key="o.id"
          class="rounded-panel border border-default p-4"
        >
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <AppStatus
                color="info"
                size="sm"
              >
                {{ o.period || '—' }}
              </AppStatus>
              <AppStatus size="sm">
                {{ namaPemilik(o) }}
              </AppStatus>
            </div>
            <div
              v-if="adaInput"
              class="flex items-center gap-1"
            >
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Sunting OKR"
                @click="bukaOkr(o)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                aria-label="Hapus OKR"
                @click="hapusO = o; hapusOpen = true"
              />
            </div>
          </div>

          <p class="font-semibold text-highlighted">
            {{ o.objective }}
          </p>
          <div class="mt-2">
            <HrBar :value="progresOkr(o)" />
          </div>

          <div class="mt-3 space-y-2">
            <div
              v-for="(k, i) in o.krs"
              :key="i"
              class="rounded-field bg-muted px-3 py-2"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="min-w-0 truncate text-sm font-semibold text-highlighted">{{ k.name }}</span>
                <div class="flex shrink-0 items-center gap-1">
                  <span class="text-xs text-muted num">{{ angka(k.progress) }} / {{ angka(k.target) }} {{ k.unit }}</span>
                  <UButton
                    v-if="adaInput"
                    icon="i-lucide-refresh-cw"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    aria-label="Update progress"
                    @click="bukaProgress(o, i)"
                  />
                </div>
              </div>
              <HrBar
                :value="progresKr(k)"
                class="mt-1"
              />
            </div>
          </div>
        </div>
      </div>
    </AppPanel>

    <HrOkrSheet
      v-model:open="sheetOpen"
      :okr="edit"
      @saved="sesudah"
    />
    <HrOkrProgress
      v-model:open="progOpen"
      :okr="progOkr"
      :index="progIndex"
      @saved="sesudah"
    />

    <ResponsiveSheet
      v-model:open="hapusOpen"
      :title="hapusO ? `Hapus OKR &quot;${hapusO.objective}&quot;?` : 'Hapus OKR?'"
    >
      <p class="text-sm">
        Key result dan progresnya ikut terhapus. Tidak bisa dikembalikan.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus"
          color="error"
          loading-auto
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
