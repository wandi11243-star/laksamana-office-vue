<!--
  Impor dari Excel (deploy/jadwal/index.html imporTempel/imporBerkas/
  imporPratinjauHtml :3991-4205, F.8). The main way in is the file (.xlsx or
  .csv, the same shape as the CSV export: Employee Name then one column per
  date), read by the shared `xlsx-baca.ts` (K-05); pasting from Excel/Sheets
  stays as a fallback. Dates come from the sheet, never from the open week; a
  name outside this Divisi is skipped and named, never guessed; a code that is
  no shift is written as a cell note. The preview shows every week and how many
  filled cells will be overwritten; the clash list comes on Simpan.
-->
<script setup lang="ts">
import type { HasilImpor, KruJadwal, PetaSel, SelJadwal, SettingJadwal } from '~/utils/jadwal'
import {
  HARI_SENIN, daftarTimpa, imporParse, labelSel, namaDivisiJadwal, rentangMinggu, seninDari, shiftDef, tujuhHari,
} from '~/utils/jadwal'
import { bacaBerkasTabel, barisKeTsv } from '~/utils/xlsx-baca'

const props = defineProps<{
  set: SettingJadwal
  peta: PetaSel
  kru: KruJadwal[]
  div: string
  /** A date in the open week/month, for years and the 18-month guard. */
  acuan: string
}>()
const emit = defineEmits<{ simpan: [rows: SelJadwal[]] }>()
const open = defineModel<boolean>('open', { default: false })

const teks = ref('')
const berkas = ref('')
const gagal = ref('')
const membaca = ref(false)
watch(open, (v) => {
  if (v) {
    teks.value = ''
    berkas.value = ''
    gagal.value = ''
  }
})

const hasil = computed<HasilImpor | null>(() => (teks.value.trim()
  ? imporParse(teks.value, { emps: props.kru, shifts: props.set.shifts, ref: props.acuan })
  : null))
const nama = (id: string) => props.kru.find(u => u.id === id)?.name ?? '—'
const bentrok = computed(() => (hasil.value ? daftarTimpa(props.peta, hasil.value.rows, nama) : []))

/** Preview grouped by Monday–Sunday week. */
const perMinggu = computed(() => {
  const out = new Map<string, SelJadwal[]>()
  for (const r of hasil.value?.rows ?? []) {
    const s = seninDari(r.d)
    out.set(s, [...(out.get(s) ?? []), r])
  }
  return [...out].sort(([a], [b]) => a.localeCompare(b)).map(([senin, rr]) => ({
    senin,
    hari: tujuhHari(senin),
    ids: [...new Set(rr.map(r => r.u))],
    by: new Map(rr.map(r => [`${r.u}|${r.d}`, r])),
  }))
})

async function pilihBerkas(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  membaca.value = true
  gagal.value = ''
  try {
    const tsv = barisKeTsv(await bacaBerkasTabel(f))
    if (!tsv.trim()) throw new Error('Berkasnya terbaca tapi isinya kosong.')
    teks.value = tsv
    berkas.value = f.name
  }
  catch (err) {
    berkas.value = ''
    gagal.value = (err as Error)?.message || 'penyebab tidak diketahui'
  }
  finally {
    membaca.value = false
  }
}

function simpan() {
  if (!hasil.value?.rows.length) return
  open.value = false
  emit('simpan', hasil.value.rows)
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`Impor dari Excel · ${namaDivisiJadwal(div)}`"
  >
    <div class="space-y-3 text-sm">
      <label class="flex cursor-pointer items-start gap-3 rounded-field border-2 border-dashed border-default p-3 hover:border-primary-400">
        <UIcon
          name="i-lucide-folder-open"
          class="size-7 shrink-0 text-primary-700"
        />
        <span>
          <b>Pilih berkas Excel jadwalnya</b>
          <span class="mt-0.5 block text-muted">
            .xlsx atau .csv — bentuk yang sama dengan tombol Excel (Employee Name lalu satu kolom per tanggal).
            Kolom Employee ID dan baris nama hari boleh ikut. Tanggalnya dibaca dari berkasnya, jadi sebulan penuh boleh sekaligus.
          </span>
        </span>
        <input
          type="file"
          accept=".xlsx,.csv"
          class="sr-only"
          @change="pilihBerkas"
        >
      </label>
      <p
        v-if="membaca"
        class="text-muted"
      >
        Membaca berkas…
      </p>
      <p
        v-if="berkas"
        class="text-success"
      >
        Berkas terbaca: <b>{{ berkas }}</b>
      </p>
      <p
        v-if="gagal"
        class="rounded-field bg-error/12 px-3 py-2 text-error"
      >
        Gagal membaca berkasnya: {{ gagal }}
      </p>

      <details>
        <summary class="cursor-pointer text-muted">
          Atau tempel dari papan ketik (Ctrl+C dari Excel/Sheets)
        </summary>
        <UTextarea
          v-model="teks"
          :rows="7"
          spellcheck="false"
          class="mt-2 w-full font-mono text-xs"
          placeholder="Employee Name · 2026-09-01 · 2026-09-02 …"
          @update:model-value="berkas = ''"
        />
      </details>

      <template v-if="hasil">
        <p
          v-if="!hasil.adaTgl"
          class="rounded-field bg-warning/12 px-3 py-2"
        >
          <b>Tidak menemukan baris tanggal.</b> Ikutkan baris tanggal Excel di dalam tempelan (mis. 01/09/2026 atau 1 Sep di tiap kolom hari).
        </p>
        <template v-else>
          <div v-if="hasil.cocok.length">
            <p class="mb-1 text-muted">
              Nama dikenali:
            </p>
            <div class="flex flex-wrap gap-1.5">
              <AppStatus
                v-for="c in hasil.cocok"
                :key="c.token"
                size="sm"
              >
                {{ c.token }} → {{ c.ke }}
              </AppStatus>
            </div>
          </div>
          <p
            v-if="hasil.ganda.length"
            class="rounded-field bg-warning/12 px-3 py-2"
          >
            <b>Nama tidak pasti — dilewati:</b>
            <span
              v-for="g in hasil.ganda"
              :key="g.token"
              class="block"
            >{{ g.token }} bisa {{ g.kandidat.join(' / ') }}</span>
          </p>
          <p
            v-if="hasil.lewat.length"
            class="rounded-field bg-warning/12 px-3 py-2"
          >
            <b>Tidak ada di roster {{ namaDivisiJadwal(div) }} — barisnya dilewati:</b> {{ hasil.lewat.join(', ') }}
            <span class="mt-1 block text-muted">Betulkan ejaannya di Excel, atau daftarkan orangnya di Data Pegawai.</span>
          </p>
          <p
            v-if="hasil.bebas.length"
            class="rounded-field bg-info/10 px-3 py-2"
          >
            Bukan kode shift — ditulis sebagai <b>catatan sel</b>: {{ hasil.bebas.join(', ') }}
          </p>
          <div
            v-for="w in perMinggu"
            :key="w.senin"
          >
            <p class="mb-1 font-semibold">
              {{ rentangMinggu(w.senin) }}
            </p>
            <div class="overflow-x-auto">
              <table class="w-full text-[11px]">
                <thead>
                  <tr class="bg-table-head text-table-head-text">
                    <th class="px-1.5 py-1 text-start">
                      Kru
                    </th>
                    <th
                      v-for="(d, k) in w.hari"
                      :key="d"
                      class="px-1 py-1"
                    >
                      {{ HARI_SENIN[k]!.slice(0, 2) }} {{ Number(d.slice(8)) }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="id in w.ids"
                    :key="id"
                    class="border-b border-default"
                  >
                    <td class="whitespace-nowrap px-1.5 py-1 font-semibold">
                      {{ nama(id) }}
                    </td>
                    <td
                      v-for="d in w.hari"
                      :key="d"
                      class="p-0.5 text-center"
                    >
                      <JadwalShiftPil
                        v-if="w.by.get(`${id}|${d}`)"
                        :def="shiftDef(set, w.by.get(`${id}|${d}`)!.t)"
                        :label="labelSel(set, w.by.get(`${id}|${d}`))"
                        size="sm"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <p
            class="rounded-field px-3 py-2"
            :class="bentrok.length ? 'bg-warning/12' : 'bg-info/10'"
          >
            <template v-if="hasil.rows.length">
              <b>{{ hasil.rows.length }} sel</b> akan ditulis
              <template v-if="bentrok.length">
                — <b class="text-error">{{ bentrok.length }}</b> menimpa sel yang sudah terisi (dirinci saat Simpan).
              </template>
              <template v-else>
                — tidak ada sel terisi yang tertimpa.
              </template>
            </template>
            <template v-else>
              Belum ada sel yang bisa ditulis.
            </template>
          </p>
        </template>
      </template>
    </div>
    <template #footer>
      <UButton
        label="Simpan"
        :disabled="!hasil?.rows.length"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
