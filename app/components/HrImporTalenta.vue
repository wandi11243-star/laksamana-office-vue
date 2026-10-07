<!--
  Unggah Report Talenta (deploy/hr/index.html openAttImport/prosesAttFile/
  simpanAttImport :1769-1845).

  One file = one month; the month is read from the dates, the filename is
  ignored. Rows match Office accounts only by Talenta ID (F.3) — unmatched
  names are REPORTED and still stored, so filling the ID later makes their
  score appear without re-uploading (:1697). Rows of resigned crew are dropped.
  The preview is what gets saved, so the numbers on it are the ones stored.
-->
<script setup lang="ts">
import type { HrAttendanceMonth } from '~/utils/hr'
import { bacaTalenta, cocokkanTalenta } from '~/utils/talenta'
import { hrPostAudit, hrSaveAttendance, useHrDasar } from '~/composables/useHr'
import { labelBulanJadwal } from '~/utils/jadwal'
import { hariIni } from '~/utils/format'

const emit = defineEmits<{ saved: [mk: string] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { s, cu, refresh } = useHrDasar()

const sibuk = ref(false)
const pesanGagal = ref('')
const berkas = ref('')
const bulan = ref('')
const hari = ref(0)
const cocok = ref(0)
const nResign = ref(0)
const takCocok = ref<{ talentaId: string, name: string, org: string }[]>([])
let payload: HrAttendanceMonth | null = null

const sudahAda = computed(() => !!bulan.value && !!s.value.attendance[bulan.value])
const berkasInput = ref<HTMLInputElement | null>(null)

watch(open, (v) => {
  if (!v) return
  pesanGagal.value = ''
  berkas.value = ''
  bulan.value = ''
  hari.value = 0
  cocok.value = 0
  nResign.value = 0
  takCocok.value = []
  payload = null
})

async function pilihFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  pesanGagal.value = ''
  sibuk.value = true
  try {
    const rows = await bacaTalenta(file)
    const hasil = cocokkanTalenta(rows, s.value.employees)
    bulan.value = hasil.bulan
    hari.value = hasil.days.length
    cocok.value = hasil.cocok
    nResign.value = hasil.nResign
    takCocok.value = hasil.unmatched
    berkas.value = file.name
    payload = {
      fileName: file.name,
      importedAt: new Date().toISOString(),
      importedBy: cu.value?.name ?? '',
      unmatched: hasil.unmatched,
      days: hasil.days,
    }
  }
  catch (e) {
    pesanGagal.value = e instanceof Error ? e.message : 'Berkas tidak bisa dibaca.'
    payload = null
  }
  finally {
    sibuk.value = false
    if (input) input.value = ''
  }
}

async function simpan() {
  if (!payload || !bulan.value) return
  sibuk.value = true
  try {
    await hrSaveAttendance(bulan.value, payload)
    try {
      await hrPostAudit('ATT_IMPORT', `${bulan.value} — ${payload.days.length} baris, ${payload.fileName}`)
    }
    catch {
      // Audit is a bonus; the attendance is already saved.
    }
    toast.add({ title: `Kehadiran ${labelBulanJadwal(bulan.value)} tersimpan`, color: 'success' })
    open.value = false
    emit('saved', bulan.value)
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

/** The latest month that already has data, for the page's default picker. */
const bulanAda = computed(() => Object.keys(s.value.attendance).sort())
const contohHariIni = hariIni().slice(0, 7)
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    title="Unggah report kehadiran"
  >
    <div class="space-y-3">
      <p class="rounded-field bg-muted px-3 py-2 text-sm">
        Pilih berkas <b>export_report_attendance.xlsx</b> dari Talenta. Satu berkas berisi satu bulan; bulannya
        dibaca dari isi berkas, bukan dari namanya.
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <input
          ref="berkasInput"
          type="file"
          accept=".xlsx,.csv"
          class="w-full rounded-field border border-default bg-default px-3 py-2 text-sm file:me-3 file:rounded-field file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-semibold"
          @change="pilihFile"
        >
      </div>
      <p
        v-if="sibuk && !berkas"
        class="text-sm text-muted"
      >
        Membaca berkas…
      </p>

      <p
        v-if="pesanGagal"
        class="rounded-field bg-error/12 px-3 py-2 text-sm text-error"
      >
        {{ pesanGagal }}
      </p>

      <template v-if="payload">
        <p
          class="rounded-field px-3 py-2 text-sm"
          :class="sudahAda ? 'bg-warning/12' : 'bg-info/10'"
        >
          <b>{{ labelBulanJadwal(bulan) }}</b> — {{ hari }} baris harian, {{ cocok }} kru cocok<template v-if="nResign">
            , {{ nResign }} baris kru resign dilewati
          </template>.
          <template v-if="sudahAda">
            <b>Bulan ini sudah pernah diunggah dan akan diganti.</b>
          </template>
        </p>
        <p
          v-if="takCocok.length"
          class="rounded-field bg-warning/12 px-3 py-2 text-sm"
        >
          <b>{{ takCocok.length }} nama belum punya Talenta ID di Office</b> — boleh tetap disimpan, skornya menyusul
          begitu dipetakan:<br>
          {{ takCocok.map(u => `${u.name} (${u.talentaId})`).join(', ') }}
        </p>
        <p
          v-if="!cocok"
          class="rounded-field bg-error/12 px-3 py-2 text-sm text-error"
        >
          Tidak ada satu pun kru yang cocok. Isi kolom <b>Talenta ID</b> di Office → Kelola User lebih dulu,
          kalau tidak seluruh berkas ini tidak akan berpengaruh ke skor siapa pun.
        </p>
        <p class="text-xs text-muted">
          File contoh default bulan ini: {{ labelBulanJadwal(contohHariIni) }}<template v-if="bulanAda.length">
            · bulan yang sudah ada: {{ bulanAda.map(m => labelBulanJadwal(m)).join(', ') }}
          </template>.
        </p>
      </template>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : `Simpan ${bulan ? labelBulanJadwal(bulan) : ''}`"
        :loading="sibuk"
        :disabled="!payload"
        @click="simpan"
      />
      <UButton
        label="Tutup"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
