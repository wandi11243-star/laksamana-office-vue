<!--
  Marketing › editable row tables for the event detail form: rundown,
  itemtbl (name + nominal), barangtbl (what + when it comes in) and menutbl
  (groups with a shared jam & qty, rows borrowing them when left empty).
  One layout for phone and desktop: stacked field groups, never sideways scroll.
-->
<script setup lang="ts">
import { selesaiRundownMkt } from '~/utils/marketing-event'
import { rupiah } from '~/utils/format'

const props = defineProps<{
  kind: 'rundown' | 'item' | 'barang' | 'menu'
  /** Menu groups (the checked komponen) for kind=menu. */
  groups?: string[]
  bar?: boolean
}>()

export interface BarisMenuMkt { kat?: string, menu?: string, qty?: string, jam?: string }
export interface GrupMenuMkt { jam?: string, qty?: string, rows?: BarisMenuMkt[] }
export type NilaiTabelMkt = Record<string, unknown>[] | Record<string, GrupMenuMkt>

const model = defineModel<NilaiTabelMkt>({ default: () => [] })
const uid = () => `b${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

// ---- flat rows (rundown / item / barang) ----
const baris = computed<Record<string, string>[]>(() => (Array.isArray(model.value) ? model.value : []) as Record<string, string>[])
function setBaris(rows: Record<string, string>[]) {
  model.value = rows.filter(r => Object.values(r).some(v => String(v ?? '').trim() !== ''))
}
function tambahBaris() {
  setBaris([...baris.value, { _id: uid(), mulai: '', durasi: '', selesai: '', kegiatan: '', nama: '', nominal: '', tgl: '', jam: '' }])
}
function hapusBaris(id?: string) {
  setBaris(baris.value.filter(r => (r._id ?? r.nama ?? r.menu) !== id))
}
function ubahBaris(id: string | undefined, k: string, v: string) {
  const rows = baris.value.map(r => ((r._id ?? r.nama ?? r.menu) === id ? { ...r, [k]: v } : r))
  if (k === 'mulai' || k === 'durasi') {
    const r = rows.find(x => (x._id ?? x.nama ?? x.menu) === id)
    if (r && !String(r.selesai ?? '').trim()) {
      const hitung = selesaiRundownMkt(String(r.mulai ?? ''), k === 'durasi' ? v : String(r.durasi ?? ''))
      if (hitung) r.selesai = hitung
    }
    else if (r && k === 'durasi' && v) {
      r.selesai = selesaiRundownMkt(String(r.mulai ?? ''), v)
    }
  }
  model.value = rows
}

// ---- menu groups ----
const grup = computed<Record<string, GrupMenuMkt>>(() => (!Array.isArray(model.value) && model.value && typeof model.value === 'object' ? model.value : {}) as Record<string, GrupMenuMkt>)
const grupAktif = computed(() => {
  const ada = Object.keys(grup.value).filter(g => g !== '_teks')
  const mau = (props.groups ?? []).filter(g => g && !ada.includes(g))
  return [...ada, ...mau]
})
function setGrup(nama: string, g: GrupMenuMkt) {
  const semua = { ...grup.value }
  const rows = (g.rows ?? []).filter(r => r.menu || r.qty || r.kat)
  if (!rows.length && !g.jam && !g.qty && !(props.groups ?? []).includes(nama)) {
    const { [nama]: _buang, ...sisanya } = semua
    void _buang
    model.value = sisanya
    return
  }
  semua[nama] = { ...g, rows }
  model.value = semua
}
function tambahMenu(nama: string) {
  const g = grup.value[nama] ?? {}
  setGrup(nama, { ...g, rows: [...(g.rows ?? []), { menu: '', qty: '', jam: '', kat: '' }] })
}
function hapusMenu(nama: string, i: number) {
  const g = grup.value[nama] ?? {}
  setGrup(nama, { ...g, rows: (g.rows ?? []).filter((_, j) => j !== i) })
}
function salinDari(nama: string, dari: string) {
  if (!dari || dari === nama) return
  const src = grup.value[dari]
  if (!src?.rows?.length) return
  const g = grup.value[nama] ?? {}
  setGrup(nama, { ...g, rows: [...(g.rows ?? []), ...src.rows.map(r => ({ ...r }))] })
}
const nominal = (v: unknown) => {
  const n = +(v as number) || 0
  return n ? rupiah(n) : ''
}
</script>

<template>
  <div
    v-if="kind !== 'menu'"
    class="grid grid-cols-1 gap-2"
  >
    <div
      v-for="r in baris"
      :key="String(r._id ?? r.nama ?? r.menu ?? Math.random())"
      class="grid gap-2 rounded-xl border border-default bg-default p-2.5"
    >
      <template v-if="kind === 'rundown'">
        <div class="grid grid-cols-3 gap-2">
          <UFormField label="Mulai">
            <UInput
              :model-value="String(r.mulai ?? '')"
              type="time"
              @update:model-value="ubahBaris(String(r._id), 'mulai', String($event))"
            />
          </UFormField>
          <UFormField label="Durasi (mnt)">
            <UInput
              :model-value="String(r.durasi ?? '')"
              inputmode="numeric"
              placeholder="30"
              @update:model-value="ubahBaris(String(r._id), 'durasi', String($event))"
            />
          </UFormField>
          <UFormField label="Selesai">
            <UInput
              :model-value="String(r.selesai ?? '')"
              type="time"
              @update:model-value="ubahBaris(String(r._id), 'selesai', String($event))"
            />
          </UFormField>
        </div>
        <div class="grid grid-cols-[1fr_auto] items-end gap-2">
          <UFormField label="Kegiatan">
            <UInput
              :model-value="String(r.kegiatan ?? '')"
              placeholder="Sambutan, makan malam…"
              @update:model-value="ubahBaris(String(r._id), 'kegiatan', String($event))"
            />
          </UFormField>
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            aria-label="Hapus baris"
            @click="hapusBaris(String(r._id))"
          />
        </div>
      </template>
      <template v-else-if="kind === 'item'">
        <div class="grid grid-cols-[1fr_auto] items-end gap-2">
          <UFormField label="Nama item">
            <UInput
              :model-value="String(r.nama ?? '')"
              placeholder="Entertainment charge…"
              @update:model-value="ubahBaris(String(r._id ?? r.nama), 'nama', String($event))"
            />
          </UFormField>
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            aria-label="Hapus baris"
            @click="hapusBaris(String(r._id ?? r.nama))"
          />
        </div>
        <UFormField
          label="Nominal (Rp)"
          :hint="nominal(r.nominal)"
        >
          <UInput
            :model-value="String(r.nominal ?? '')"
            inputmode="numeric"
            @update:model-value="ubahBaris(String(r._id ?? r.nama), 'nominal', String($event).replace(/\D/g, ''))"
          />
        </UFormField>
      </template>
      <template v-else>
        <UFormField label="Barang">
          <UInput
            :model-value="String(r.nama ?? '')"
            placeholder="Backdrop 6 m…"
            @update:model-value="ubahBaris(String(r._id ?? r.nama), 'nama', String($event))"
          />
        </UFormField>
        <div class="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <UFormField label="Tanggal">
            <UInput
              :model-value="String(r.tgl ?? '')"
              type="date"
              @update:model-value="ubahBaris(String(r._id ?? r.nama), 'tgl', String($event))"
            />
          </UFormField>
          <UFormField label="Jam">
            <UInput
              :model-value="String(r.jam ?? '')"
              type="time"
              @update:model-value="ubahBaris(String(r._id ?? r.nama), 'jam', String($event))"
            />
          </UFormField>
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            aria-label="Hapus baris"
            @click="hapusBaris(String(r._id ?? r.nama))"
          />
        </div>
      </template>
    </div>
    <UButton
      icon="i-lucide-plus"
      color="neutral"
      variant="outline"
      :label="kind === 'rundown' ? 'Tambah baris rundown' : kind === 'item' ? 'Tambah item' : 'Tambah barang'"
      @click="tambahBaris"
    />
  </div>

  <div
    v-else
    class="grid grid-cols-1 gap-3"
  >
    <div
      v-for="g in grupAktif"
      :key="g"
      class="rounded-xl border border-default p-2.5"
    >
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <p class="text-sm font-semibold">
          {{ g }}
        </p>
        <select
          v-if="grupAktif.length > 1"
          class="ml-auto rounded-field border border-default bg-default px-2 py-1 text-xs text-muted"
          aria-label="Salin daftar menu dari kelompok lain"
          @change="salinDari(g, ($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''"
        >
          <option value="">
            Salin dari…
          </option>
          <option
            v-for="lain in grupAktif.filter(x => x !== g && (grup[x]?.rows?.length ?? 0) > 0)"
            :key="lain"
            :value="lain"
          >
            {{ lain }}
          </option>
        </select>
      </div>
      <div class="mb-2 grid grid-cols-2 gap-2">
        <UFormField label="Jam kelompok">
          <UInput
            :model-value="String(grup[g]?.jam ?? '')"
            placeholder="mis. 09.00"
            @update:model-value="setGrup(g, { ...(grup[g] ?? {}), jam: String($event) })"
          />
        </UFormField>
        <UFormField label="Jumlah kelompok">
          <UInput
            :model-value="String(grup[g]?.qty ?? '')"
            placeholder="mis. 100"
            inputmode="numeric"
            @update:model-value="setGrup(g, { ...(grup[g] ?? {}), qty: String($event) })"
          />
        </UFormField>
      </div>
      <div class="grid grid-cols-1 gap-2">
        <div
          v-for="(r, i) in (grup[g]?.rows ?? [])"
          :key="i"
          class="grid gap-2 rounded-xl bg-muted p-2"
        >
          <div
            v-if="!bar"
            class="grid grid-cols-[1fr_auto] items-end gap-2"
          >
            <UFormField label="Jenis">
              <UInput
                :model-value="String(r.kat ?? '')"
                placeholder="pilih / ketik"
                @update:model-value="setGrup(g, { ...(grup[g] ?? {}), rows: (grup[g]?.rows ?? []).map((x, j) => j === i ? { ...x, kat: String($event) } : x) })"
              />
            </UFormField>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              aria-label="Hapus baris"
              @click="hapusMenu(g, i)"
            />
          </div>
          <UFormField label="Menu">
            <UInput
              :model-value="String(r.menu ?? '')"
              placeholder="nama menu"
              @update:model-value="setGrup(g, { ...(grup[g] ?? {}), rows: (grup[g]?.rows ?? []).map((x, j) => j === i ? { ...x, menu: String($event) } : x) })"
            />
          </UFormField>
          <div class="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <UFormField :label="`Jumlah${grup[g]?.qty ? ` (kelompok: ${grup[g]?.qty})` : ''}`">
              <UInput
                :model-value="String(r.qty ?? '')"
                :placeholder="String(grup[g]?.qty || 'ikut kelompok')"
                inputmode="numeric"
                @update:model-value="setGrup(g, { ...(grup[g] ?? {}), rows: (grup[g]?.rows ?? []).map((x, j) => j === i ? { ...x, qty: String($event) } : x) })"
              />
            </UFormField>
            <UFormField :label="`Jam${grup[g]?.jam ? ` (kelompok: ${grup[g]?.jam})` : ''}`">
              <UInput
                :model-value="String(r.jam ?? '')"
                :placeholder="String(grup[g]?.jam || 'ikut kelompok')"
                @update:model-value="setGrup(g, { ...(grup[g] ?? {}), rows: (grup[g]?.rows ?? []).map((x, j) => j === i ? { ...x, jam: String($event) } : x) })"
              />
            </UFormField>
            <UButton
              v-if="bar"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              aria-label="Hapus baris"
              @click="hapusMenu(g, i)"
            />
          </div>
        </div>
        <UButton
          icon="i-lucide-plus"
          color="neutral"
          variant="ghost"
          size="sm"
          label="Tambah baris"
          @click="tambahMenu(g)"
        />
      </div>
    </div>
  </div>
</template>
