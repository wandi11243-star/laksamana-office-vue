<!--
  Reservasi › Atur denah & meja (owner request, Nov 2026: "kalau mau edit meja
  itu bisa di setting di side bar baru saja, jadi di dashboard tidak perlu
  ada"). Everything that CHANGES the plan lives here, out of the day-of
  dashboard, which only reads it:
    - Editor denah — move / add / resize tables of the plan in force on a date
      and floor; save into its template or for that date only (the old editor
      rules, see DenahEditor);
    - Jadwal denah — which template a date uses, per floor, and the dates that
      deviate from their built-in plan;
    - Database meja — every table of every plan in one list, with its
      capacity (min–max). A capacity saved here goes into EVERY template and
      date plan that holds the table, and the master `tables` list is rewritten
      from the plans, so Marketing / VIP read the same tables the floor has.
  Each write carries its section's own version (If-Match); a change in between
  reloads instead of overwriting.
-->
<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useMediaQuery } from '@vueuse/core'
import { postAudit, putDenah, putSection, useDenah, useSectionVersi } from '~/composables/useReservasi'
import { bolehAksi, roleReservasi } from '~/utils/layar/reservasi'
import type { LayoutDenah, MejaDenah } from '~/utils/venue-layouts'
import {
  LABEL_ZONA, adaDenahTanggal, allLayoutKeys, capDenah, capMax, capMin, dayTypeLayoutLt,
  defaultDayTypeLt, denahTanggalBaru, getLayout, jejakDenah, keyTanggal, lantaiLayout,
  layoutName, layoutTanggal, ltCfg, ovLantai, parseKeyTanggal,
} from '~/utils/venue-layouts'
import { hariIni, tglPanjang, tglPendek } from '~/utils/format'
import { tanganiKonflik, versiDari } from '~/utils/versi'

definePageMeta({ access: ['reservasi'] })

const me = useMe()
const toast = useToast()
const desktop = useMediaQuery('(min-width: 1024px)')
const role = computed(() => roleReservasi(me.value))
const bolehUbah = computed(() => bolehAksi('master', role.value))
const namaSaya = computed(() => me.value?.name ?? '')

const { master, versi, layouts: secLayouts, layoutOverrides: secOv1, layoutOverrides2: secOv2, layoutTanggal: secTgl, status } = useDenah()
const secTables = useSectionVersi<string[]>('tables')
const muatUlang = () => Promise.all([secLayouts.refresh(), secOv1.refresh(), secOv2.refresh(), secTgl.refresh(), secTables.refresh()])

const catat = async (action: string, detail: string) => {
  try {
    await postAudit({ action, detail })
  }
  catch {
    // The write itself succeeded; a missing audit line is not a failure.
  }
}

// --- date & floor ----------------------------------------------------------------

const tgl = ref(hariIni())
const lantai = ref<1 | 2>(1)
const kunci = computed(() => dayTypeLayoutLt(master.value, tgl.value, lantai.value))
const denah = computed(() => getLayout(master.value, kunci.value) ?? getLayout(master.value, defaultDayTypeLt(tgl.value, lantai.value, master.value)))
const jejak = computed(() => jejakDenah(denah.value))

// --- editor ------------------------------------------------------------------------

const editorTanggal = computed(() => parseKeyTanggal(kunci.value))
/** The template that would cover the date if its own plan were not there. */
const editorTemplat = computed(() => {
  const p = editorTanggal.value
  if (!p) return kunci.value
  const terjadwal = ovLantai(master.value, p.lt)[p.date]
  return (terjadwal && getLayout(master.value, terjadwal)) ? terjadwal : defaultDayTypeLt(p.date, p.lt, master.value)
})

const sibuk = ref(false)
async function tulis(aksi: () => Promise<unknown>, sukses: string, jejakAudit: [string, string]) {
  sibuk.value = true
  try {
    await aksi()
    await muatUlang()
    await catat(...jejakAudit)
    toast.add({ title: sukses, color: 'success' })
    return true
  }
  catch (e) {
    if (!(await tanganiKonflik(e, muatUlang))) toast.add({ title: apiErrorMessage(e), color: 'error' })
    return false
  }
  finally {
    sibuk.value = false
  }
}

/** Save into the covering template: every date that uses it changes. */
function simpanKeTemplat(data: LayoutDenah) {
  const key = editorTemplat.value
  if (!key || parseKeyTanggal(key)) return
  const cap = capDenah(data, namaSaya.value)
  return tulis(
    () => putDenah('layouts', { ...(secLayouts.data.value?.data ?? {}), [key]: cap }, versi.value.layouts),
    `Template ${layoutName(master.value, key)} disimpan — berlaku untuk semua tanggal yang memakainya`,
    ['Simpan Layout', `${layoutName(master.value, key)} (${cap.tables.length} meja)`],
  )
}

/** Save for the chosen date only: the template is not touched. */
function simpanUntukTanggal(data: LayoutDenah) {
  const d = tgl.value
  const lt = lantai.value
  const key = keyTanggal(d, lt)
  const cap = capDenah(denahTanggalBaru(data, d, lt), namaSaya.value)
  return tulis(
    () => putDenah('layoutTanggal', { ...(secTgl.data.value?.data ?? {}), [key]: cap }, versi.value.layoutTanggal),
    `Denah ${tglPendek(d)} disimpan — template tidak ikut berubah`,
    ['Simpan Denah Tanggal', `${tglPendek(d)} Lt.${lt} (${cap.tables.length} meja)`],
  )
}

// --- full screen ---------------------------------------------------------------------

const kanvas = ref<HTMLElement | null>(null)
const { penuh, bisa: bisaPenuh, alihkan: layarPenuh } = useLayarPenuh(kanvas)

// --- schedule per date ---------------------------------------------------------------

const ovLt = computed(() => ovLantai(master.value, lantai.value))
const BAWAAN = '__bawaan'
const opsiTemplat = computed(() => [
  { value: BAWAAN, label: `Bawaan hari (${layoutName(master.value, defaultDayTypeLt(tgl.value, lantai.value, master.value))})` },
  ...allLayoutKeys(master.value)
    .filter(k => !parseKeyTanggal(k) && lantaiLayout(master.value, k) === lantai.value)
    .map(k => ({ value: k, label: layoutName(master.value, k) })),
])
const pilihTemplat = ref(BAWAAN)
watch([tgl, lantai, ovLt], () => {
  pilihTemplat.value = ovLt.value[tgl.value] ?? BAWAAN
}, { immediate: true })

/**
 * A date's OWN plan always wins over a scheduled template (dayTypeLayoutLt). Until
 * 23 Oct 2026 the old app only wrote the schedule, so the choice was saved but
 * never seen ("24 Okt sudah dipindah ke Weekend tapi denahnya tidak berubah").
 * Now the crew is asked, and the date's plan is dropped in the same write.
 * Returns false when they cancel — then nothing changes.
 */
function bolehBuangDenahTanggal(d: string, lt: number) {
  if (!adaDenahTanggal(master.value, d, lt)) return true
  return window.confirm(`Tanggal ${tglPendek(d)} (${ltCfg(lt).nama}) punya DENAH KHUSUS yang digeser sendiri, dan denah khusus selalu menang atas template.

Supaya pilihan ini berlaku, denah khusus tanggal itu dibuang. Lanjutkan?`)
}

function simpanJadwal(d: string, templat: string) {
  const lt = lantai.value
  const key = lt === 2 ? 'layoutOverrides2' : 'layoutOverrides'
  if (!bolehBuangDenahTanggal(d, lt)) return
  const buangTgl = adaDenahTanggal(master.value, d, lt)
  const ov = Object.fromEntries(Object.entries(ovLt.value).filter(([k]) => k !== d))
  if (templat !== BAWAAN && getLayout(master.value, templat)) ov[d] = templat
  return tulis(
    async () => {
      if (buangTgl) {
        const { [keyTanggal(d, lt)]: _buang, ...sisa } = layoutTanggal(master.value)
        await putDenah('layoutTanggal', sisa, versi.value.layoutTanggal)
        await catat('Hapus Denah Tanggal', `${tglPendek(d)} Lt.${lt} (diganti template)`)
      }
      await putDenah(key, ov, versi.value[key])
    },
    templat !== BAWAAN ? `${ltCfg(lt).nama} ${tglPendek(d)} memakai ${layoutName(master.value, templat)}` : `${ltCfg(lt).nama} ${tglPendek(d)} kembali ke bawaan hari`,
    [templat !== BAWAAN ? 'Set Denah Tanggal' : 'Reset Denah Tanggal', `${ltCfg(lt).nama} · ${tglPendek(d)} → ${templat !== BAWAAN ? layoutName(master.value, templat) : 'bawaan'}`],
  )
}

const tglLain = ref('')
function terapkanKeTanggalLain() {
  if (!tglLain.value) return toast.add({ title: 'Pilih tanggalnya dulu', color: 'error' })
  if (pilihTemplat.value === BAWAAN) return toast.add({ title: 'Pilih template denahnya dulu (bukan bawaan hari)', color: 'error' })
  return simpanJadwal(tglLain.value, pilihTemplat.value)
}

/** Clears BOTH forms of deviation for a date — a scheduled template and tables drawn for that date. */
async function bersihkanTanggal(d: string) {
  const lt = lantai.value
  await tulis(async () => {
    if (adaDenahTanggal(master.value, d, lt)) {
      const { [keyTanggal(d, lt)]: _buang, ...sisa } = layoutTanggal(master.value)
      await putDenah('layoutTanggal', sisa, versi.value.layoutTanggal)
    }
    if (ovLt.value[d]) {
      const ov = Object.fromEntries(Object.entries(ovLt.value).filter(([k]) => k !== d))
      await putDenah(lt === 2 ? 'layoutOverrides2' : 'layoutOverrides', ov, versi.value[lt === 2 ? 'layoutOverrides2' : 'layoutOverrides'])
    }
  }, `${ltCfg(lt).nama} ${tglPendek(d)} dikembalikan ke bawaan hari`, ['Reset Denah Tanggal', `${ltCfg(lt).nama} · ${tglPendek(d)} → bawaan`])
}

/** Dates from today on whose plan differs from the built-in of the day, this floor. */
const tanggalKhusus = computed(() => {
  const lt = lantai.value
  const dari = hariIni()
  const out: { tgl: string, nama: string }[] = []
  for (const [d, v] of Object.entries(ovLt.value)) {
    if (d >= dari && getLayout(master.value, v)) out.push({ tgl: d, nama: layoutName(master.value, v) })
  }
  for (const key of Object.keys(layoutTanggal(master.value))) {
    const p = parseKeyTanggal(key)
    if (p && p.lt === lt && p.date >= dari) out.push({ tgl: p.date, nama: 'meja digeser khusus tanggal ini' })
  }
  return out.sort((a, b) => a.tgl.localeCompare(b.tgl))
})

// --- table database ----------------------------------------------------------------------

interface BarisMeja {
  id: string
  lantai: string
  zona: string
  min: number
  maks: number
  /** Plans holding this table. */
  denah: string[]
}

/** Every plan that is still in use: templates, and date plans from today on. */
const semuaDenah = computed(() => {
  const dari = hariIni()
  return allLayoutKeys(master.value).filter((k) => {
    const p = parseKeyTanggal(k)
    return !p || p.date >= dari
  })
})

const database = computed<BarisMeja[]>(() => {
  const per = new Map<string, BarisMeja>()
  for (const k of semuaDenah.value) {
    const lt = lantaiLayout(master.value, k)
    const nama = parseKeyTanggal(k) ? `${tglPendek(parseKeyTanggal(k)!.date)} Lt.${lt}` : layoutName(master.value, k)
    for (const t of getLayout(master.value, k)?.tables ?? []) {
      const id = String(t.id)
      const ada = per.get(id)
      if (ada) {
        ada.denah.push(nama)
        if (!ada.lantai.includes(String(lt))) ada.lantai = `${ada.lantai} & ${lt}`
        continue
      }
      per.set(id, { id, lantai: String(lt), zona: LABEL_ZONA[t.zone] ?? t.zone, min: capMin(t.cap), maks: capMax(t.cap), denah: [nama] })
    }
  }
  return [...per.values()].sort((a, b) => a.lantai.localeCompare(b.lantai) || a.id.localeCompare(b.id, 'id', { numeric: true }))
})

/** Edited capacities, by table id; untouched rows keep the plan's own. */
const ubahan = reactive<Record<string, { min: number, maks: number } | undefined>>({})
const kapasitas = (b: BarisMeja) => ubahan[b.id] ?? { min: b.min, maks: b.maks }
function setKapasitas(b: BarisMeja, k: 'min' | 'maks', v: number | string) {
  const n = Math.max(0, Math.round(Number(v) || 0))
  const kini = { ...kapasitas(b), [k]: n }
  if (k === 'maks' && kini.min > n) kini.min = n
  if (k === 'min' && kini.maks < n) kini.maks = n
  ubahan[b.id] = kini
}
const capTeks = (c: { min: number, maks: number }) => (c.min && c.min < c.maks ? `${c.min}-${c.maks}` : String(c.maks))
const jumlahUbah = computed(() => database.value.filter(b => ubahan[b.id] && capTeks(ubahan[b.id]!) !== capTeks(b)).length)
const salah = computed(() => database.value.filter(b => ubahan[b.id] && ubahan[b.id]!.maks < 1).map(b => b.id))

const cariMeja = ref('')
const baris = computed(() => {
  const q = cariMeja.value.trim().toLowerCase()
  return q ? database.value.filter(b => b.id.toLowerCase().includes(q)) : database.value
})
const totalKursi = computed(() => database.value.reduce((a, b) => a + kapasitas(b).maks, 0))

async function simpanDatabase() {
  if (salah.value.length) return toast.add({ title: `Kapasitas maksimal ${salah.value.join(', ')} masih 0`, color: 'error' })
  const ganti = new Map(database.value.filter(b => ubahan[b.id]).map(b => [b.id, capTeks(ubahan[b.id]!)]))
  const pakai = (l: LayoutDenah): LayoutDenah => capDenah({
    ...l,
    tables: (l.tables ?? []).map((t: MejaDenah) => (ganti.has(String(t.id)) ? { ...t, cap: ganti.get(String(t.id))! } : t)),
  }, namaSaya.value)
  const kena = (l?: LayoutDenah | null) => (l?.tables ?? []).some(t => ganti.has(String(t.id)))

  const ok = await tulis(async () => {
    if (ganti.size) {
      // Templates (built-in ones become stored ones, like any editor save).
      const tpl = { ...(secLayouts.data.value?.data ?? {}) }
      let ubahTpl = false
      for (const k of allLayoutKeys(master.value)) {
        if (parseKeyTanggal(k)) continue
        const l = getLayout(master.value, k)
        if (l && kena(l)) {
          tpl[k] = pakai(l)
          ubahTpl = true
        }
      }
      if (ubahTpl) await putDenah('layouts', tpl, versi.value.layouts)
      // Date plans still to come.
      const perTgl = { ...layoutTanggal(master.value) }
      let ubahTgl = false
      for (const [k, l] of Object.entries(perTgl)) {
        const p = parseKeyTanggal(k)
        if (p && p.date >= hariIni() && kena(l)) {
          perTgl[k] = pakai(l)
          ubahTgl = true
        }
      }
      if (ubahTgl) await putDenah('layoutTanggal', perTgl, versi.value.layoutTanggal)
    }
    // The flat table list other modules read, rebuilt from the plans.
    await putSection('tables', database.value.map(b => b.id), versiDari(secTables.data.value))
  }, ganti.size ? `Kapasitas ${ganti.size} meja disimpan ke semua denah` : 'Daftar meja disamakan dengan denah', ['Simpan Database Meja', ganti.size ? [...ganti].map(([id, c]) => `${id}=${c}`).join(', ') : `${database.value.length} meja`])
  if (ok) Object.assign(ubahan, Object.fromEntries(Object.keys(ubahan).map(k => [k, undefined])))
}

/** The stored flat list differs from the plans (e.g. the old "Meja 01 …" list). */
const daftarLama = computed(() => {
  const lama = secTables.data.value?.data ?? []
  const kini = new Set(database.value.map(b => b.id))
  return lama.length !== kini.size || lama.some(x => !kini.has(String(x)))
})

const kolom: TableColumn<BarisMeja>[] = [
  { accessorKey: 'id', header: 'Meja', meta: { class: { th: 'w-28', td: 'w-28' } } },
  { accessorKey: 'lantai', header: 'Lantai', meta: { class: { th: 'w-20', td: 'w-20' } } },
  { accessorKey: 'zona', header: 'Zona', meta: { class: { th: 'w-32', td: 'w-32' } } },
  { id: 'min', header: 'Kapasitas min', meta: { class: { th: 'w-36', td: 'w-36' } } },
  { id: 'maks', header: 'Kapasitas maks', meta: { class: { th: 'w-36', td: 'w-36' } } },
  { id: 'denah', header: 'Ada di denah' },
]
</script>

<template>
  <AppPage
    title="Atur denah & meja"
    description="Editor denah, jadwal denah per tanggal, dan database meja beserta kapasitasnya."
  >
    <p
      v-if="!bolehUbah"
      class="mb-4 rounded-xl border-l-4 border-warning bg-warning/10 p-3 text-sm text-warning"
    >
      Peranmu hanya bisa melihat. Minta manager/admin Reservasi untuk mengubah denah atau kapasitas meja.
    </p>

    <!-- Date & floor: what the editor and the schedule below act on. -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <AppTanggal
        v-model="tgl"
        :clearable="false"
        class="w-60"
      />
      <AppSeg
        :model-value="String(lantai)"
        :options="[{ value: '1', label: 'Lantai 1' }, { value: '2', label: 'Lantai 2' }]"
        @update:model-value="(v?: string) => { lantai = v === '2' ? 2 : 1 }"
      />
      <span class="text-sm text-muted">
        Denah berlaku: <b class="text-highlighted">{{ layoutName(master, kunci) }}</b>
        <template v-if="editorTanggal"> (khusus tanggal ini)</template>
      </span>
    </div>

    <AppPanel
      title="Editor denah"
      icon="i-lucide-map"
      :description="editorTanggal
        ? `Denah ${tglPanjang(tgl)} digeser sendiri. Menyimpan ke template mengubah ${layoutName(master, editorTemplat)}.`
        : `Simpan ke template = semua tanggal yang memakai ${layoutName(master, editorTemplat)} ikut berubah. Simpan untuk tanggal ini saja = hanya ${tglPanjang(tgl)}.`"
    >
      <template #actions>
        <UButton
          v-if="bisaPenuh"
          :icon="penuh ? 'i-lucide-minimize' : 'i-lucide-maximize'"
          :label="penuh ? 'Keluar layar penuh' : 'Layar penuh'"
          color="neutral"
          variant="outline"
          size="sm"
          @click="layarPenuh"
        />
      </template>
      <div
        ref="kanvas"
        class="bg-default"
        :class="penuh ? 'overflow-auto p-6' : ''"
      >
        <!-- In full screen the panel's own button is outside: a way back, inside. -->
        <UButton
          v-if="penuh"
          icon="i-lucide-minimize"
          label="Keluar layar penuh"
          color="neutral"
          variant="outline"
          size="sm"
          class="mb-3"
          @click="layarPenuh"
        />
        <p
          v-if="status === 'pending' && !denah"
          class="py-10 text-center text-sm text-muted"
        >
          Memuat denah…
        </p>
        <DenahEditor
          v-else-if="denah"
          :key="`${kunci}-${tgl}`"
          :layout="denah"
          :konteks="tglPanjang(tgl)"
          :tanggal="{ date: tgl, lt: lantai }"
          :template-tanggal="layoutName(master, editorTemplat)"
          :bisa-ubah="bolehUbah && !sibuk"
          :jejak="jejak"
          @simpan-templat="simpanKeTemplat"
          @simpan-tanggal="simpanUntukTanggal"
        />
      </div>
    </AppPanel>

    <AppPanel
      title="Jadwal denah per tanggal"
      icon="i-lucide-calendar-cog"
      :description="`${ltCfg(lantai).nama}: tanggal lain otomatis kembali ke bawaan hari. Lantai 1 dan Lantai 2 dijadwalkan sendiri-sendiri.`"
    >
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="space-y-3">
          <UFormField :label="`Denah ${ltCfg(lantai).nama} untuk ${tglPanjang(tgl)}`">
            <USelect
              v-model="pilihTemplat"
              :items="opsiTemplat"
              :disabled="!bolehUbah"
              class="w-full"
            />
          </UFormField>
          <div class="flex flex-wrap items-end gap-2">
            <UButton
              label="Terapkan ke tanggal ini"
              icon="i-lucide-check"
              :disabled="!bolehUbah"
              loading-auto
              @click="simpanJadwal(tgl, pilihTemplat)"
            />
          </div>
          <div class="flex flex-wrap items-end gap-2 border-t border-default pt-3">
            <UFormField
              label="Pakai template yang sama di tanggal lain"
              class="w-60"
            >
              <AppTanggal
                v-model="tglLain"
                :min="hariIni()"
                class="w-full"
              />
            </UFormField>
            <UButton
              label="Tambahkan tanggal"
              color="neutral"
              variant="outline"
              :disabled="!bolehUbah"
              loading-auto
              @click="terapkanKeTanggalLain"
            />
          </div>
        </div>
        <div>
          <AppSectionTitle :title="`Tanggal khusus ${ltCfg(lantai).nama} (hari ini ke depan)`" />
          <p
            v-if="!tanggalKhusus.length"
            class="text-sm text-muted"
          >
            Belum ada tanggal khusus — semua tanggal memakai bawaan harinya.
          </p>
          <div
            v-for="t in tanggalKhusus"
            :key="`${t.tgl}-${t.nama}`"
            class="flex items-center justify-between gap-2 border-b border-default py-2 text-sm last:border-b-0"
          >
            <button
              type="button"
              class="text-left hover:text-gold-deep"
              @click="tgl = t.tgl"
            >
              <b>{{ tglPendek(t.tgl) }}</b> → {{ t.nama }}
            </button>
            <UButton
              label="Kembalikan ke bawaan"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!bolehUbah"
              loading-auto
              @click="bersihkanTanggal(t.tgl)"
            />
          </div>
        </div>
      </div>
    </AppPanel>

    <AppPanel
      title="Database meja"
      icon="i-lucide-armchair"
      :count="database.length"
      :description="`Semua meja dari semua denah, total ±${totalKursi} kursi. Kapasitas yang disimpan di sini berlaku di semua denah yang memuat meja itu, dan dipakai untuk menghitung sisa kursi.`"
    >
      <template #actions>
        <UButton
          :label="jumlahUbah ? `Simpan ${jumlahUbah} perubahan` : 'Samakan daftar meja'"
          icon="i-lucide-save"
          :disabled="!bolehUbah || (!jumlahUbah && !daftarLama)"
          loading-auto
          @click="simpanDatabase"
        />
      </template>
      <p
        v-if="daftarLama"
        class="mb-3 rounded-xl bg-warning/10 p-3 text-sm text-warning"
      >
        Daftar meja tersimpan ({{ (secTables.data.value?.data ?? []).length }} meja) belum sama dengan denah
        ({{ database.length }} meja). Tekan <b>Samakan daftar meja</b> supaya Marketing &amp; modul lain membaca meja yang sama.
      </p>
      <UInput
        v-model="cariMeja"
        icon="i-lucide-search"
        placeholder="Cari meja…"
        class="mb-3 w-full sm:w-64"
      />
      <UTable
        v-if="desktop"
        :data="baris"
        :columns="kolom"
        class="table-fixed"
      >
        <template #id-cell="{ row }">
          <b class="text-highlighted">{{ row.original.id }}</b>
        </template>
        <template #min-cell="{ row }">
          <UInput
            :model-value="kapasitas(row.original).min"
            type="number"
            min="0"
            size="sm"
            class="w-24"
            :disabled="!bolehUbah"
            @update:model-value="setKapasitas(row.original, 'min', $event)"
          />
        </template>
        <template #maks-cell="{ row }">
          <UInput
            :model-value="kapasitas(row.original).maks"
            type="number"
            min="1"
            size="sm"
            class="w-24"
            :color="kapasitas(row.original).maks < 1 ? 'error' : undefined"
            :highlight="kapasitas(row.original).maks < 1"
            :disabled="!bolehUbah"
            @update:model-value="setKapasitas(row.original, 'maks', $event)"
          />
        </template>
        <template #denah-cell="{ row }">
          <span
            class="block truncate text-muted"
            :title="row.original.denah.join(', ')"
          >{{ row.original.denah.join(', ') }}</span>
        </template>
      </UTable>
      <div
        v-else
        class="flex flex-col gap-2"
      >
        <div
          v-for="b in baris"
          :key="b.id"
          class="rounded-xl border border-default p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <b class="text-highlighted">Meja {{ b.id }}</b>
            <span class="text-xs text-muted">Lantai {{ b.lantai }} · {{ b.zona }}</span>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <UFormField label="Kapasitas min">
              <UInput
                :model-value="kapasitas(b).min"
                type="number"
                min="0"
                class="w-full"
                :disabled="!bolehUbah"
                @update:model-value="setKapasitas(b, 'min', $event)"
              />
            </UFormField>
            <UFormField label="Kapasitas maks">
              <UInput
                :model-value="kapasitas(b).maks"
                type="number"
                min="1"
                class="w-full"
                :disabled="!bolehUbah"
                @update:model-value="setKapasitas(b, 'maks', $event)"
              />
            </UFormField>
          </div>
        </div>
      </div>
    </AppPanel>
  </AppPage>
</template>
