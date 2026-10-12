<!--
  Marketing › schema-driven detail sections (tabs 1–2, EVENT_SCHEMA D.1–D.11).
  One card per section, head as the old renderEventTab: number, title,
  question, fill bar and the "Tampil di PDF" tick (detail._pdfSec). The
  finance section's body comes from the #finance slot.
  Edits the page draft in place ({atas, detail}); the page saves per tab with
  a versioned PATCH. Field shapes match the old collectField(): yn {v},
  timerange "HH:MM - HH:MM", cur/num numbers, multi arrays, files [{key,name}].
-->
<script setup lang="ts">
import type { EventMkt } from '~/utils/marketing'
import type { DrafEventMkt, FieldEventMkt, SeksiEventMkt } from '~/utils/marketing-event'
import {
  KUNCI_ATAS_EVENT_MKT, MAKS_BERKAS_MKT, condTerpenuhiMkt, progresSeksiMkt, ringkasNilaiMkt,
} from '~/utils/marketing-event'
import { berkasKeBase64, unggahBerkasMkt, urlBerkasMkt } from '~/composables/useMarketing'
import { ynBool } from '~/utils/marketing-uang'

const props = defineProps<{
  ev: EventMkt
  seksi: SeksiEventMkt[]
  bisaUbah: boolean
  fbFormats: string[]
  staffNames: string[]
  events: EventMkt[]
}>()

const draft = defineModel<DrafEventMkt>('draft', { required: true })
const toast = useToast()

/** Read like the old detailVal: row first, then detail. */
const baca = (k: string): unknown => {
  const a = draft.value.atas[k]
  if (a !== undefined && a !== null && a !== '') return a
  return draft.value.detail[k]
}
function tulis(k: string, v: unknown) {
  if (KUNCI_ATAS_EVENT_MKT.includes(k)) draft.value.atas[k] = v
  else draft.value.detail[k] = v
}
const evGabung = computed(() => ({ ...props.ev, ...draft.value.atas, detail: draft.value.detail }) as EventMkt)
const terlihat = (f: FieldEventMkt) => condTerpenuhiMkt(f, evGabung.value)
const progres = (s: SeksiEventMkt) => progresSeksiMkt(evGabung.value, s)

/** "Tampil di PDF" per section (old pdfSecOn): never ticked = printed. Saved with the tab. */
const pdfAktif = (id: string) => ((draft.value.detail._pdfSec ?? {}) as Record<string, unknown>)[id] !== false
function pdfSet(id: string, on: boolean) {
  draft.value.detail._pdfSec = { ...((draft.value.detail._pdfSec ?? {}) as Record<string, unknown>), [id]: on }
}
const opsiSel = (f: FieldEventMkt): string[] => (f.o === 'fb' ? [...props.fbFormats, 'Lainnya'] : (f.o as string[]))

const angka = (v: unknown) => {
  const s = String(v ?? '').replace(/\D/g, '')
  return s === '' ? '' : +s
}
function toggleMulti(f: FieldEventMkt, o: string, on: boolean) {
  const skr = (Array.isArray(baca(f.k)) ? (baca(f.k) as string[]) : []).filter(x => x !== o)
  tulis(f.k, on ? [...skr, o] : skr)
}

// ---- files: uploaded at once, like the old dpBuktiPilih ----
const mengunggah = ref<string | null>(null)
async function pilihBerkas(f: FieldEventMkt, files: FileList | null) {
  if (!files?.length) return
  mengunggah.value = f.k
  try {
    const lama = Array.isArray(baca(f.k)) ? [...(baca(f.k) as Record<string, string>[])] : []
    for (const file of [...files]) {
      if (file.size > MAKS_BERKAS_MKT) {
        toast.add({ title: 'File terlalu besar', description: `${file.name}: maksimal 8MB per berkas.`, color: 'error' })
        continue
      }
      const b64 = await berkasKeBase64(file)
      const r = await unggahBerkasMkt({ dataBase64: b64, fileName: file.name, mimeType: file.type || 'application/octet-stream' })
      if (r.data?.key) lama.push({ key: r.data.key, name: r.data.name || file.name })
    }
    tulis(f.k, lama)
  }
  catch (e) {
    toast.add({ title: 'Gagal mengunggah', description: apiErrorMessage(e), color: 'error' })
  }
  finally {
    mengunggah.value = null
  }
}
const berkas = (f: FieldEventMkt): { key: string, name: string }[] =>
  (Array.isArray(baca(f.k)) ? baca(f.k) : []) as { key: string, name: string }[]
function hapusBerkas(f: FieldEventMkt, key: string) {
  tulis(f.k, berkas(f).filter(b => b.key !== key))
}

// ---- salinlayout: copy layoutFile + layoutImgs from another event ----
const salinDari = ref('__pilih')
function salinLayout() {
  const src = props.events.find(e => e.id === salinDari.value)
  if (!src) return
  draft.value.detail.layoutFile = (src.detail ?? {}).layoutFile ?? draft.value.detail.layoutFile
  const imgs = (src.detail ?? {}).layoutImgs
  if (Array.isArray(imgs) && imgs.length) draft.value.detail.layoutImgs = imgs
  toast.add({ title: 'Layout disalin', description: `Catatan layout & gambar diambil dari ${src.nama}.`, color: 'success' })
  salinDari.value = '__pilih'
}

// ---- yn tri-state through USelect (USelect cannot hold '') ----
const KOSONG_YN = '__kosong'
const ynVal = (f: FieldEventMkt) => {
  const v = ynBool(baca(f.k))
  void f
  return v === true ? 'ya' : v === false ? 'tidak' : KOSONG_YN
}
function ynSet(f: FieldEventMkt, v: string) {
  tulis(f.k, v === KOSONG_YN ? undefined : { v: v === 'ya' })
}
const ynnoteV = (f: FieldEventMkt): boolean | undefined => {
  const v = baca(f.k) as { v?: boolean, note?: string } | boolean | undefined
  if (typeof v === 'boolean') return v
  return v?.v
}
const ynnoteN = (f: FieldEventMkt) => String((baca(f.k) as { note?: string } | undefined)?.note ?? '')
function ynnoteSet(f: FieldEventMkt, v: boolean | undefined, note: string) {
  const n = note.trim()
  if (v === undefined && !n) tulis(f.k, undefined)
  else tulis(f.k, { v: v ?? (n ? true : undefined), note: n })
}

// ---- timerange ----
const rentang = (f: FieldEventMkt) => String(baca(f.k) ?? '').split('-').map(s => s.trim())
function rentangSet(f: FieldEventMkt, i: number, v: string) {
  const p = rentang(f)
  p[i] = v
  tulis(f.k, p[0] || p[1] ? `${p[0] || ''} - ${p[1] || ''}`.replace(/^- /, '').replace(/ -$/, '') : '')
}
</script>

<template>
  <div>
    <AppPanel
      v-for="s in seksi"
      :key="s.id"
    >
      <template #head>
        <div class="flex min-w-0 flex-1 basis-72 items-start gap-3">
          <span class="mt-0.5 shrink-0 rounded-md bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700 num">{{ s.n }}</span>
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-highlighted">
              {{ s.title }}
            </h3>
            <p class="mt-0.5 text-sm text-muted">
              {{ s.desc }}
            </p>
          </div>
        </div>
      </template>
      <template #actions>
        <span
          v-if="progres(s).total"
          class="flex items-center gap-2 text-xs text-muted num"
          :title="`${progres(s).isi} dari ${progres(s).total} isian sudah terisi`"
        >
          <span class="h-1.5 w-16 overflow-hidden rounded-full bg-elevated">
            <span
              class="block h-full rounded-full"
              :class="progres(s).isi === progres(s).total ? 'bg-success' : 'bg-primary-400'"
              :style="{ width: `${Math.round(progres(s).isi / progres(s).total * 100)}%` }"
            />
          </span>
          {{ progres(s).isi }}/{{ progres(s).total }}
        </span>
        <UCheckbox
          v-if="bisaUbah"
          :model-value="pdfAktif(s.id)"
          label="Tampil di PDF"
          title="Kalau dimatikan, seksi ini tidak ikut tercetak di Event Brief / PDF"
          @update:model-value="pdfSet(s.id, !!$event)"
        />
      </template>
      <slot
        v-if="s.id === 'finance'"
        name="finance"
      />
      <div
        v-else
        class="grid gap-3 lg:grid-cols-2"
      >
        <template
          v-for="f in s.fields"
          :key="f.k"
        >
          <AppSectionTitle
            v-if="f.t === 'head' && terlihat(f)"
            :title="f.l"
            class="lg:col-span-2"
          />
          <div
            v-else-if="f.t !== 'head' && terlihat(f)"
            :class="f.full ? 'lg:col-span-2' : ''"
          >
            <UFormField
              v-if="!['tog', 'mirror', 'head', 'mejalock', 'salinlayout'].includes(f.t)"
              :label="f.l"
              :required="!!f.req"
              :hint="f.help"
            >
              <UInput
                v-if="f.t === 'text'"
                :model-value="String(baca(f.k) ?? '')"
                :list="f.src === 'staff' ? `dl-staf-${f.k}` : undefined"
                :disabled="!bisaUbah"
                @update:model-value="tulis(f.k, String($event))"
              />
              <datalist
                v-if="f.t === 'text' && f.src === 'staff'"
                :id="`dl-staf-${f.k}`"
              >
                <option
                  v-for="n in staffNames"
                  :key="n"
                  :value="n"
                />
              </datalist>
              <UTextarea
                v-else-if="f.t === 'ta'"
                :model-value="String(baca(f.k) ?? '')"
                :disabled="!bisaUbah"
                autoresize
                @update:model-value="tulis(f.k, String($event))"
              />
              <UInput
                v-else-if="f.t === 'num'"
                :model-value="String(baca(f.k) ?? '')"
                type="number"
                :disabled="!bisaUbah"
                @update:model-value="tulis(f.k, String($event) === '' ? '' : +String($event))"
              />
              <UInput
                v-else-if="f.t === 'cur'"
                :model-value="String(baca(f.k) ?? '')"
                inputmode="numeric"
                :disabled="!bisaUbah"
                @update:model-value="tulis(f.k, angka($event))"
              />
              <UInput
                v-else-if="f.t === 'date'"
                :model-value="String(baca(f.k) ?? '')"
                type="date"
                :disabled="!bisaUbah"
                @update:model-value="tulis(f.k, String($event))"
              />
              <UInput
                v-else-if="f.t === 'time'"
                :model-value="String(baca(f.k) ?? '')"
                type="time"
                :disabled="!bisaUbah"
                @update:model-value="tulis(f.k, String($event))"
              />
              <div
                v-else-if="f.t === 'timerange'"
                class="flex items-center gap-2"
              >
                <UInput
                  :model-value="rentang(f)[0] ?? ''"
                  type="time"
                  aria-label="Jam mulai"
                  :disabled="!bisaUbah"
                  class="min-w-0 flex-1"
                  @update:model-value="rentangSet(f, 0, String($event))"
                />
                <span class="flex-none text-xs text-muted">s/d</span>
                <UInput
                  :model-value="rentang(f)[1] ?? ''"
                  type="time"
                  aria-label="Jam selesai"
                  :disabled="!bisaUbah"
                  class="min-w-0 flex-1"
                  @update:model-value="rentangSet(f, 1, String($event))"
                />
              </div>
              <USelect
                v-else-if="f.t === 'sel'"
                :model-value="String(baca(f.k) ?? '')"
                :items="opsiSel(f)"
                :disabled="!bisaUbah"
                placeholder="Pilih…"
                class="w-full"
                @update:model-value="tulis(f.k, String($event))"
              />
              <div
                v-else-if="f.t === 'multi'"
                class="flex flex-wrap gap-1.5"
              >
                <UCheckbox
                  v-for="o in (f.o as string[])"
                  :key="o"
                  :model-value="(Array.isArray(baca(f.k)) ? (baca(f.k) as string[]) : []).includes(o)"
                  :label="o"
                  :disabled="!bisaUbah"
                  @update:model-value="toggleMulti(f, o, Boolean($event))"
                />
              </div>
              <USelect
                v-else-if="f.t === 'yn'"
                :model-value="ynVal(f)"
                :items="[{ value: KOSONG_YN, label: 'Belum dijawab' }, { value: 'ya', label: 'Ya' }, { value: 'tidak', label: 'Tidak' }]"
                value-key="value"
                label-key="label"
                :disabled="!bisaUbah"
                class="w-full"
                @update:model-value="ynSet(f, String($event))"
              />
              <div
                v-else-if="f.t === 'ynnote'"
                class="flex flex-wrap items-start gap-2.5"
              >
                <AppSeg
                  :model-value="ynnoteV(f)"
                  :options="[{ value: true, label: 'Ya' }, { value: false, label: 'Tidak' }]"
                  size="sm"
                  :class="['shrink-0', bisaUbah ? '' : 'pointer-events-none opacity-70']"
                  @update:model-value="ynnoteSet(f, $event as boolean | undefined, ynnoteN(f))"
                />
                <UTextarea
                  :model-value="ynnoteN(f)"
                  placeholder="Catatan / detail (opsional) — boleh beberapa baris"
                  :disabled="!bisaUbah"
                  :rows="1"
                  autoresize
                  class="min-w-40 flex-1"
                  @update:model-value="ynnoteSet(f, ynnoteV(f), String($event))"
                />
              </div>
              <MarketingBarisTabel
                v-else-if="f.t === 'rundown'"
                v-model="draft.detail[f.k] as never"
                kind="rundown"
              />
              <MarketingBarisTabel
                v-else-if="f.t === 'itemtbl'"
                v-model="draft.detail[f.k] as never"
                kind="item"
              />
              <MarketingBarisTabel
                v-else-if="f.t === 'barangtbl'"
                v-model="draft.detail[f.k] as never"
                kind="barang"
              />
              <MarketingBarisTabel
                v-else-if="f.t === 'menutbl'"
                v-model="draft.detail[f.k] as never"
                kind="menu"
                :groups="f.src === 'komponen' ? ((draft.detail.komponen as string[]) ?? []) : undefined"
                :bar="!!f.bar"
              />
              <div
                v-else-if="f.t === 'files'"
                class="grid gap-2"
              >
                <div
                  v-for="b in berkas(f)"
                  :key="b.key"
                  class="flex items-center gap-2 text-sm"
                >
                  <UIcon
                    name="i-lucide-paperclip"
                    class="size-4 flex-none text-muted"
                  />
                  <a
                    :href="urlBerkasMkt(b.key)"
                    target="_blank"
                    rel="noopener"
                    class="min-w-0 flex-1 truncate text-primary-700 underline"
                  >{{ b.name }}</a>
                  <UButton
                    v-if="bisaUbah"
                    icon="i-lucide-x"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    aria-label="Hapus berkas"
                    @click="hapusBerkas(f, b.key)"
                  />
                </div>
                <UInput
                  v-if="bisaUbah"
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  :disabled="mengunggah === f.k"
                  @change="pilihBerkas(f, ($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''"
                />
                <p
                  v-if="mengunggah === f.k"
                  class="text-xs text-muted"
                >
                  Mengunggah…
                </p>
              </div>
            </UFormField>
            <USwitch
              v-else-if="f.t === 'tog'"
              :model-value="!!baca(f.k)"
              :label="f.l"
              :disabled="!bisaUbah"
              @update:model-value="tulis(f.k, $event)"
            />
            <div
              v-else-if="f.t === 'mirror'"
              class="text-sm"
            >
              <p class="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                {{ f.l }}
              </p>
              <p class="whitespace-pre-line">
                {{ ringkasNilaiMkt('text', (f.from ? (Array.isArray(f.from) ? f.from.map(k => (draft.detail[k] ?? (evGabung as unknown as Record<string, unknown>)[k])) : [draft.detail[f.from as string] ?? (evGabung as unknown as Record<string, unknown>)[f.from as string]]) : []).filter(x => x !== undefined && x !== '').map(x => ringkasNilaiMkt('text', x)).filter(Boolean).join(' · ') || null) ?? '— belum diisi di seksi asalnya —' }}
              </p>
            </div>
            <div v-else-if="f.t === 'mejalock'">
              <p class="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                {{ f.l }}
              </p>
              <MarketingMejaKunci
                :ev="evGabung"
                :tanggal="String(draft.atas.tanggal ?? ev.tanggal ?? '')"
                :jam="String(draft.detail.tamuDatang ?? draft.detail.mulaiSetup ?? '')"
                :bisa-ubah="bisaUbah"
                @kunci="(m, t) => { draft.detail.mejaKunci = m; draft.detail.mejaKunciTgl = t }"
                @lepas="() => { draft.detail.mejaKunci = []; draft.detail.mejaKunciTgl = '' }"
              />
            </div>
            <div
              v-else-if="f.t === 'salinlayout' && bisaUbah"
              class="flex flex-wrap items-end gap-2"
            >
              <UFormField
                :label="f.l"
                class="min-w-0 flex-1"
              >
                <USelect
                  v-model="salinDari"
                  :items="[{ value: '__pilih', label: 'Pilih event…' }, ...events.filter(e => e.id !== ev.id).map(e => ({ value: e.id, label: `${e.nama} · ${e.tanggal ?? ''}` }))]"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                />
              </UFormField>
              <UButton
                label="Salin"
                color="neutral"
                variant="outline"
                :disabled="salinDari === '__pilih'"
                @click="salinLayout"
              />
            </div>
          </div>
        </template>
      </div>
    </AppPanel>
  </div>
</template>
