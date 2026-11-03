<!--
  Agenda form (old `agendaModal`, deploy/bd/index.html:6161-6197). The data field
  is `date`; the SQL column is `tanggal` — the API keeps the app's own field name.

  Peserta may come from the whole Tim, not just BD crew: outsiders are stored
  as `o:<officeUserId>` with their name snapshotted in `pesertaNama`, never as
  DB people rows — so they are invited as guests and cannot answer (see
  `bisaJawab`). RSVP answers ride in `resp`; an empty map reads back as `[]`
  from PHP, so both the read (`normState`) and this form normalize defensively.

  Inviting is per-division AND per-person: a division button toggles every
  matched person at once, but only the person ids are stored. A division with
  nobody in the roster is drawn disabled with its reason, never hidden.
-->
<script setup lang="ts">
import type { BdAgenda, BdPerson } from '~/composables/useBd'
import { bdSimpan, buatBd, hapusBd, tambalBd, ubahBd, versiBaris } from '~/composables/useBd'
import { isAdminOf } from '~/composables/useMe'
import { useRoster } from '~/composables/useRoster'
import {
  AGENDA_TIPE, RSVP_OPSI, TIM_UNDANG, agBisaUbah, alasanTakBisaJawab, bisaJawab, calonUndang, divisiBawaan,
  idOrangLuar, inisial, jamAgendaBerubah, namaPeserta, normResp, officeIdDari, opsiDivisi, rentangJamSah, ringkasRsvp, todayISO,
  type RsvpNilai,
} from '~/utils/bd-rumus'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'

const props = defineProps<{
  agenda?: BdAgenda | null
  people: BdPerson[]
  aku?: BdPerson | null
  /** Prefill for a fresh agenda drawn on the hour grid (date + start/end). */
  awal?: { date?: string, start?: string, end?: string } | null
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()
const me = useMe()
const { data: roster } = useRoster()

/**
 * Only the organiser, a module admin, or (for team agendas) anyone may edit.
 * Everyone else gets the detail + their own answer — never a dead form.
 */
const bolehUbah = computed(() => agBisaUbah(props.agenda, props.aku?.id, isAdminOf(me.value, 'bd')))

/** Division choices: crew-used divisions first, then every Office Tim.
 * The edited row's own div is unioned in, so a stored legacy division never
 * drops out of the select even when no crew carries it any more. */
const opsiDiv = computed(() => opsiDivisi([...props.people, { div: props.agenda?.div }]))

const f = reactive({
  title: '',
  date: todayISO(),
  start: '',
  end: '',
  type: 'Meeting',
  div: '',
  lokasi: '',
  ket: '',
  peserta: [] as string[],
  pesertaNama: {} as Record<string, string>,
  resp: {} as Record<string, RsvpNilai>,
})
const cariLuar = ref('')
const hapusMau = ref(false)

/** Invite buttons: every Office team plus Office staff, each with its candidates. */
const undang = computed(() => TIM_UNDANG.map(t => ({
  ...t,
  calon: calonUndang(t.label, props.people, roster.value ?? []),
})))
const diundangSemua = (label: string) => {
  const calon = undang.value.find(u => u.label === label)?.calon ?? []
  return calon.length > 0 && calon.every(c => f.peserta.includes(c.id))
}
/** A division button toggles its people, but only person ids are stored. */
function undangToggle(label: string) {
  const calon = undang.value.find(u => u.label === label)?.calon ?? []
  if (!calon.length) return
  if (diundangSemua(label)) {
    const ids = new Set(calon.map(c => c.id))
    f.peserta = f.peserta.filter(id => !ids.has(id))
    buangSisa([...ids])
  }
  else {
    for (const c of calon) {
      if (!f.peserta.includes(c.id)) f.peserta.push(c.id)
      if (c.luar && !String(f.pesertaNama[c.id] || '').trim()) f.pesertaNama[c.id] = c.nama
    }
  }
}

/** Crew not yet invited — revoked crew stays pickable, marked "tanpa akses". */
const kruBelum = computed(() => props.people.filter(p => !f.peserta.includes(p.id)))
const namaRendah = (s: unknown) => String(s || '').trim().toLowerCase()
/** Whole-Tim outsiders by name search: already-invited people never reappear. */
const luarHasil = computed(() => {
  const q = cariLuar.value.trim().toLowerCase()
  if (q.length < 2) return []
  return (roster.value ?? []).filter((r) => {
    if (!namaRendah(r.name).includes(q)) return false
    const kru = props.people.find(p =>
      (p.officeUserId && String(p.officeUserId) === String(r.id)) || namaRendah(p.name) === namaRendah(r.name))
    return kru ? !f.peserta.includes(kru.id) : !f.peserta.includes(`o:${r.id}`)
  }).slice(0, 8)
})
function tambahKru(id: string) {
  if (!f.peserta.includes(id)) f.peserta.push(id)
}
function tambahLuar(r: { id: string, name: string }) {
  const id = `o:${r.id}`
  if (!f.peserta.includes(id)) {
    f.peserta.push(id)
    f.pesertaNama[id] = r.name
  }
  cariLuar.value = ''
}
function buangPeserta(id: string) {
  f.peserta = f.peserta.filter(x => x !== id)
  buangSisa([id])
}
/**
 * Drop the traces of removed peserta — answers AND name snapshots — so a
 * re-invite starts clean instead of resurrecting stale RSVP answers.
 */
function buangSisa(ids: string[]) {
  if (ids.some(id => f.resp[id])) {
    const next = { ...f.resp }
    for (const id of ids) Reflect.deleteProperty(next, id)
    f.resp = next
  }
  if (ids.some(id => id in f.pesertaNama)) {
    const next = { ...f.pesertaNama }
    for (const id of ids) Reflect.deleteProperty(next, id)
    f.pesertaNama = next
  }
}
/** Record one RSVP answer; clicking the same answer again clears it. Outsiders and revoked crew cannot answer. */
function jawab(id: string, v: RsvpNilai) {
  if (!bisaJawab(props.people, id)) return
  const next = { ...f.resp }
  if (next[id] === v) Reflect.deleteProperty(next, id)
  else next[id] = v
  f.resp = next
}
const ringkas = computed(() => ringkasRsvp(f.resp))

watch(open, (o) => {
  if (!o) return
  const e = props.agenda
  if (e) {
    f.title = e.title
    f.date = e.date || todayISO()
    f.start = e.start || ''
    f.end = e.end || ''
    f.type = e.type || 'Meeting'
    f.div = e.div || opsiDiv.value[0]!
    f.lokasi = e.lokasi || ''
    f.ket = e.ket || ''
    f.peserta = Array.isArray(e.peserta) ? [...e.peserta] : []
    f.pesertaNama = e.pesertaNama && typeof e.pesertaNama === 'object' ? { ...e.pesertaNama } : {}
    f.resp = normResp(e.resp)
  }
  else {
    const aku = props.aku
    f.title = ''
    f.date = props.awal?.date || todayISO()
    f.start = props.awal?.start || ''
    f.end = props.awal?.end || ''
    f.type = 'Meeting'
    f.div = divisiBawaan(aku?.div, opsiDiv.value)
    f.lokasi = ''
    f.ket = ''
    f.peserta = []
    f.pesertaNama = {}
    f.resp = {}
  }
  cariLuar.value = ''
})

async function simpan() {
  // Without edit rights the only thing saved is my own answer (see below).
  if (!bolehUbah.value) {
    await simpanJawabanSendiri()
    return
  }
  if (!f.title.trim()) {
    toast.add({ title: 'Judul agenda wajib diisi.', color: 'error' })
    return
  }
  if (!f.date) {
    toast.add({ title: 'Tanggal agenda wajib diisi.', color: 'error' })
    return
  }
  if (f.start && !f.end) {
    toast.add({ title: 'Jam selesai butuh jam mulai.', color: 'error' })
    return
  }
  if (!rentangJamSah(f.start, f.end)) {
    toast.add({ title: 'Jam selesai harus sesudah jam mulai.', color: 'error' })
    return
  }
  // The organiser never invites themselves.
  const milik = props.aku?.id
  const peserta = f.peserta.filter(id => id && id !== milik)
  const body: Partial<BdAgenda> = {
    title: f.title.trim(),
    date: f.date,
    start: f.start || '',
    end: f.start ? f.end || '' : '',
    type: f.type,
    div: f.div,
    lokasi: f.lokasi.trim(),
    ket: f.ket.trim(),
    peserta,
    pesertaNama: { ...f.pesertaNama },
    resp: { ...f.resp },
  }
  const lama = props.agenda
  const ok = lama
    ? await bdSimpan(() => {
      // A moved schedule drops every answer: "hadir" for 10:00 is not
      // "hadir" for 14:00. Invitees are stamped again and asked anew.
        const geser = jamAgendaBerubah(lama, body as BdAgenda)
        const undang = { ...(lama.undang || {}) }
        const resp = { ...f.resp }
        const now = Date.now()
        for (const p of peserta) {
          if (!(p in undang)) undang[p] = { at: now }
          else if (geser) {
            undang[p] = { at: now, ubah: 1 }
            Reflect.deleteProperty(resp, p)
          }
        }
        return ubahBd<BdAgenda>('agenda', lama.id, { ...body, id: lama.id, owner: lama.owner || '', resp, undang }, versiBaris(lama))
      }, geserPesan(lama, body as BdAgenda))
    : await bdSimpan(() => {
        const now = Date.now()
        const undang: Record<string, { at: number }> = {}
        for (const p of peserta) undang[p] = { at: now }
        return buatBd<BdAgenda>('agenda', { ...body, owner: milik || '', undang, resp: {} })
      }, peserta.length ? `Agenda ditambahkan · ${peserta.length} peserta diundang` : 'Agenda ditambahkan')
  if (ok) open.value = false
}

/** Save toast: a moved schedule says the invitees are asked again. */
function geserPesan(lama: BdAgenda, baru: Partial<BdAgenda>): string {
  return jamAgendaBerubah(lama, baru as BdAgenda)
    ? 'Agenda diperbarui — jadwal berubah, peserta diminta menjawab ulang'
    : 'Agenda diperbarui'
}

/** Am I an invitee who may answer this agenda, but not edit it? */
const bisaKirimJawaban = computed(() => {
  const idku = props.aku?.id
  const e = props.agenda
  return !!e && !bolehUbah.value && !!idku && bisaJawab(props.people, idku)
    && Array.isArray(e.peserta) && e.peserta.includes(idku)
})

/**
 * An invitee's own answer, saved alone: a PATCH carrying ONLY my key merged
 * onto the live row, so another invitee's concurrent answer survives. The
 * membership check lives here, not just on the button — an invitee may never
 * write anyone else's key. The version guard reloads on conflict; an
 * unchanged answer just closes.
 */
async function simpanJawabanSendiri() {
  const idku = props.aku?.id
  const e = props.agenda
  if (!idku || !e || !bisaJawab(props.people, idku) || !(e.peserta || []).includes(idku)) {
    open.value = false
    return
  }
  const jawabanku = f.resp[idku]
  if (jawabanku === (e.resp || {})[idku]) {
    open.value = false
    return
  }
  const next = { ...(e.resp || {}) }
  if (jawabanku) next[idku] = jawabanku
  else Reflect.deleteProperty(next, idku)
  const ok = await bdSimpan(() => tambalBd<BdAgenda>('agenda', e.id, { resp: next }, versiBaris(e)), 'Jawaban terkirim')
  if (ok) open.value = false
}

async function hapus() {
  const lama = props.agenda
  if (!lama) return
  hapusMau.value = false
  const ok = await bdSimpan(() => hapusBd('agenda', lama.id, versiBaris(lama)), 'Agenda dihapus')
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="agenda ? (bolehUbah ? 'Edit agenda' : 'Detail agenda') : 'Agenda baru'"
    description="Agenda internal tim BD."
  >
    <p
      v-if="agenda && !bolehUbah"
      class="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-muted"
    >
      Hanya penyelenggara yang bisa mengubah agenda ini. Kamu tetap bisa menjawab undangan di bawah.
    </p>
    <div class="grid gap-4">
      <p
        v-if="agenda"
        class="text-xs text-muted"
      >
        Penyelenggara: <b class="text-highlighted">{{ agenda.owner ? (people.find(p => p.id === agenda!.owner)?.name || '—') : 'Agenda tim (tanpa undangan)' }}</b>
      </p>
      <UFormField label="Judul agenda">
        <UInput
          v-model="f.title"
          placeholder="mis. Meeting mingguan tim BD"
          class="w-full"
          :disabled="!bolehUbah"
        />
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Tanggal">
          <UInput
            v-model="f.date"
            type="date"
            class="w-full"
            :disabled="!bolehUbah"
          />
        </UFormField>
        <UFormField label="Mulai (kosong = sepanjang hari)">
          <UInput
            v-model="f.start"
            type="time"
            class="w-full"
            :disabled="!bolehUbah"
          />
        </UFormField>
        <UFormField label="Selesai">
          <UInput
            v-model="f.end"
            type="time"
            class="w-full"
            :disabled="!bolehUbah"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <UFormField label="Jenis">
          <USelect
            v-model="f.type"
            :items="AGENDA_TIPE"
            class="w-full"
            :disabled="!bolehUbah"
          />
        </UFormField>
        <UFormField label="Divisi">
          <USelect
            v-model="f.div"
            :items="opsiDiv"
            class="w-full"
            :disabled="!bolehUbah"
          />
        </UFormField>
        <UFormField label="Lokasi / tautan">
          <UInput
            v-model="f.lokasi"
            placeholder="mis. Ruang meeting lt.2"
            class="w-full"
            :disabled="!bolehUbah"
          />
        </UFormField>
      </div>
      <UFormField
        v-if="bolehUbah || f.ket"
        label="Catatan"
      >
        <UTextarea
          v-model="f.ket"
          placeholder="Agenda rapat, yang perlu disiapkan…"
          class="w-full"
          :disabled="!bolehUbah"
        />
      </UFormField>
      <div v-if="bolehUbah">
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Undang per divisi
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="u in undang"
            :key="u.key"
            type="button"
            :disabled="!u.calon.length"
            :title="u.calon.length
              ? (diundangSemua(u.label) ? `Batalkan undangan ${u.label} (${u.calon.length} orang)` : `Undang seluruh ${u.label} (${u.calon.length} orang)`)
              : `${u.label}: belum ada kru Tim ini di roster — tombol mati, bukan hilang`"
            class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors"
            :class="[
              !u.calon.length
                ? 'cursor-not-allowed border-default bg-muted text-dimmed opacity-60'
                : diundangSemua(u.label)
                  ? 'border-yellow-deep bg-yellow-light text-highlighted'
                  : 'border-default bg-default text-muted hover:border-accented',
            ]"
            @click="undangToggle(u.label)"
          >
            <UIcon
              :name="diundangSemua(u.label) ? 'i-lucide-check' : 'i-lucide-plus'"
              class="size-3.5"
            />
            {{ u.label }} · {{ u.calon.length }}
          </button>
        </div>
        <p class="mt-1 text-[11px] text-dimmed">
          Divisi 0 kru tampil mati dengan alasan — yang tersimpan tetap per orang di bawah.
        </p>
      </div>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Peserta{{ f.peserta.length ? ` · ${f.peserta.length} orang` : '' }}{{ ringkas ? ` · ${ringkas}` : '' }}
        </p>
        <div
          v-if="f.peserta.length"
          class="flex flex-wrap gap-1.5"
        >
          <span
            v-for="id in f.peserta"
            :key="id"
            class="inline-flex items-center gap-1.5 rounded-full border border-yellow-deep bg-yellow-light py-1 pl-2.5 pr-1.5 text-xs font-semibold text-highlighted"
            :title="idOrangLuar(id) ? `Tamu dari Tim (Office ${officeIdDari(id)})` : (props.people.find(p => p.id === id)?.name || id)"
          >
            <span class="flex size-5 items-center justify-center rounded-full bg-yellow-light text-[10px] font-bold text-yellow-dark">
              {{ inisial(namaPeserta(props.people, f.pesertaNama, id)) }}
            </span>
            {{ namaPeserta(props.people, f.pesertaNama, id) }}
            <span
              v-if="idOrangLuar(id)"
              class="text-[10px] font-bold uppercase text-muted"
            >tamu</span>
            <span
              v-else-if="props.people.find(p => p.id === id)?.tanpaAkses"
              class="text-[10px] font-bold uppercase text-error"
            >tanpa akses</span>
            <UButton
              v-if="bolehUbah"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`Batalkan undangan ${namaPeserta(props.people, f.pesertaNama, id)}`"
              @click="buangPeserta(id)"
            />
          </span>
        </div>
        <p
          v-else
          class="text-xs text-muted"
        >
          Belum ada peserta — undang per divisi di atas, atau tambah satu per satu di bawah.
        </p>
      </div>
      <div v-if="bolehUbah && kruBelum.length">
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Tambah kru BD
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="p in kruBelum"
            :key="p.id"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-default bg-default px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:border-accented"
            :title="p.tanpaAkses ? `${p.name} — aksesnya dicabut, diundang tapi tidak bisa menjawab` : `Undang ${p.name}`"
            @click="tambahKru(p.id)"
          >
            {{ p.name }}
            <span
              v-if="p.tanpaAkses"
              class="text-[10px] font-bold uppercase text-error"
            >tanpa akses</span>
          </button>
        </div>
      </div>
      <div v-if="bolehUbah">
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Tambah dari seluruh Tim
        </p>
        <UInput
          v-model="cariLuar"
          placeholder="Ketik nama — mis. kasir atau office…"
          size="sm"
          class="w-full"
        />
        <p
          v-if="cariLuar.trim().length >= 2"
          class="mt-1 text-[11px] text-dimmed"
        >
          {{ luarHasil.length ? `${luarHasil.length} cocok — klik untuk mengundang sebagai tamu.` : 'Tidak ada nama yang cocok di Tim.' }}
        </p>
        <div
          v-if="luarHasil.length"
          class="mt-1.5 grid gap-1"
        >
          <button
            v-for="r in luarHasil"
            :key="r.id"
            type="button"
            class="flex items-center gap-2 rounded-lg border border-default px-2 py-1.5 text-left text-xs hover:border-accented"
            :title="`${r.name} — ${r.keterangan || 'tanpa keterangan Tim'}. Diundang sebagai tamu (o:${r.id}), tidak bisa menjawab.`"
            @click="tambahLuar(r)"
          >
            <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-yellow-light text-[10px] font-bold text-yellow-dark">
              {{ inisial(r.name) }}
            </span>
            <span class="min-w-0 flex-1 truncate font-semibold text-highlighted">{{ r.name }}</span>
            <span class="shrink-0 text-[10px] text-dimmed">{{ r.keterangan || 'tanpa Tim' }}</span>
            <span class="shrink-0 text-[10px] font-bold uppercase text-muted">tamu</span>
          </button>
        </div>
      </div>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          RSVP{{ ringkas ? ` · ${ringkas}` : '' }}
        </p>
        <div
          v-if="f.peserta.length"
          class="grid gap-1"
        >
          <div
            v-for="id in f.peserta"
            :key="id"
            class="flex flex-wrap items-center gap-2 rounded-lg border border-default px-2 py-1.5"
            :title="bisaJawab(props.people, id) ? '' : alasanTakBisaJawab(id)"
          >
            <span class="min-w-0 flex-1 truncate text-xs font-semibold text-highlighted">
              {{ namaPeserta(props.people, f.pesertaNama, id) }}
              <span
                v-if="idOrangLuar(id)"
                class="font-normal text-dimmed"
              >· tamu</span>
            </span>
            <div
              v-if="bisaJawab(props.people, id)"
              class="flex gap-1"
            >
              <button
                v-for="o in RSVP_OPSI"
                :key="o.value"
                type="button"
                :aria-pressed="f.resp[id] === o.value"
                :disabled="!bolehUbah && id !== props.aku?.id"
                :title="`${o.label} — ${namaPeserta(props.people, f.pesertaNama, id)}`"
                class="rounded-full border px-2 py-0.5 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                :class="f.resp[id] === o.value
                  ? o.value === 'hadir' ? 'border-success bg-success text-white'
                    : o.value === 'mungkin' ? 'border-yellow-deep bg-yellow-light text-highlighted'
                      : 'border-error bg-error text-white'
                  : 'border-default bg-default text-muted hover:border-accented'"
                @click="jawab(id, o.value)"
              >
                {{ o.label }}
              </button>
            </div>
            <span
              v-else
              class="text-[11px] text-dimmed"
            >{{ alasanTakBisaJawab(id) }}</span>
          </div>
        </div>
        <p
          v-else
          class="text-xs text-muted"
        >
          Undang peserta dulu — jawabannya menempel di sini dan tersimpan.
        </p>
      </div>
      <p class="rounded-xl border border-default bg-muted p-3 text-xs text-muted">
        Agenda di sini adalah agenda <b>internal tim BD</b>. Acara perusahaan (event klien, jadwal talent)
        tetap dikelola di modul Marketing dan Event — jadwal gabungannya dibaca di modul Radar.
        Agenda tanpa peserta adalah agenda <b>tim</b> — terlihat semua kru tanpa undangan.
        Mengubah tanggal atau jam membuat peserta diminta menjawab ulang.
      </p>
    </div>

    <template #footer>
      <UButton
        v-if="bolehUbah"
        label="Simpan"
        icon="i-lucide-check"
        @click="simpan"
      />
      <UButton
        v-if="!bolehUbah && bisaKirimJawaban"
        label="Kirim jawaban"
        icon="i-lucide-check"
        @click="simpan"
      />
      <UButton
        :label="bolehUbah ? 'Batal' : 'Tutup'"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="agenda && bolehUbah"
        label="Hapus"
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        @click="hapusMau = true"
      />
    </template>
  </ResponsiveSheet>

  <BdKonfirmasi
    v-model:open="hapusMau"
    title="Hapus agenda ini?"
    @konfirmasi="hapus"
  />
</template>
