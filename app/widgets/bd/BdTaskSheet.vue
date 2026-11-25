<!--
  Task form (old `taskModal` + `fieldSubDep`, deploy/bd/index.html:1934-2017,
  2105-2173). PIC may be many; `pic` is always `pics[0]`. The Eisenhower
  quadrant is shown as a PREVIEW and never stored — it is derived from the two
  switches (`:1316-1322`).

  Sub-tasks and order live as LOCAL drafts and only enter the task on Save:
  editing `t.subtasks` directly would keep a cancelled edit alive into the
  next save. PUT sends the whole row (`ubahBd`), so reopening also drops
  `doneAt` — a PATCH merge could not remove it.
-->
<script setup lang="ts">
import type { BdLampiran, BdPerson, BdProject, BdSubtask, BdTask } from '~/composables/useBd'
import { LAMPIRAN_TERIMA, buatBd, bdSimpan, bdTulisDiam, capPenugasan, hapusTaskDenganUrutan, lampiranSah, pesanHapusTask, putSetelan, tambalBd, tolakLampiran, ubahBd, unggahLampiranBd, useBdSettings, versiBaris, versiSetelan } from '~/composables/useBd'
import {
  PILIHAN_TANPA, PRIORITAS, STATUS_FLOW, TAG_PALET, TASK_TIPE, ULANG, cekBolehDone, deps, divisiBawaan, gayaTag, jamValid, kruTersedia, kuadran,
  kunciTag, labelUlang, menungguTransitif, opsiDivisi, opsiProject as opsiProjectBd, parseUlang, pesanTunggu, pics, reviewers, segarkanProgress, selesai, semuaTag, setPics, subs, susunUlang, tagsOf, todayISO, uidBd,
  warnaAcakTag, warnaTag,
  type UlangRumus,
} from '~/utils/bd-rumus'
import { WARNA_KUADRAN, WARNA_TASK } from '~/utils/status-bd'
import { rencanaPindah } from '~/utils/bd-pindah'
import { BATAS_TULIS_PARALEL, petaParalel } from '~/utils/paralel'
import BdKonfirmasi from '~/widgets/bd/BdKonfirmasi.vue'
import BdLampiranChip from '~/widgets/bd/BdLampiranChip.vue'
import BdPicPicker from '~/widgets/bd/BdPicPicker.vue'

const props = defineProps<{
  task?: BdTask | null
  presetProject?: string | null
  presetDaily?: boolean
  /** All tasks: order candidates + the waiters named on delete. */
  tasks: BdTask[]
  projects: BdProject[]
  people: BdPerson[]
  aku?: BdPerson | null
}>()
const open = defineModel<boolean>('open', { default: false })
const toast = useToast()

/** Division choices: crew-used divisions first, then every Office Tim.
 * The edited row's own div is unioned in, so a stored legacy division never
 * drops out of the select even when no crew carries it any more. */
const opsiDiv = computed(() => opsiDivisi([...props.people, { div: props.task?.div }]))

const f = reactive({
  name: '',
  desc: '',
  div: '',
  pics: [] as string[],
  reviewers: [] as string[],
  status: 'To Do',
  priority: 'Medium',
  type: 'Ad-hoc',
  start: '',
  deadline: todayISO(),
  /** Optional deadline time ("HH:MM") — info only, never an hour-grid. */
  jam: '',
  project: null as string | null,
  daily: false,
  ulang: '',
  important: true,
  urgent: false,
})
/** Custom recurrence draft (`panelKustom`): read once on save, never redrawn mid-typing. */
const kustom = reactive({ tiap: 1, satuan: 'minggu' as UlangRumus['satuan'], hari: [] as number[], mode: 'tgl' as UlangRumus['mode'], akhir: '' as '' | 'd' | 'x', sampai: '', kali: 13 })
const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
function kustomDari(ulang: string, deadline: string) {
  const r = parseUlang(ulang)
  if (r && !r.preset) {
    kustom.tiap = r.tiap
    kustom.satuan = r.satuan
    kustom.hari = [...r.hari]
    kustom.mode = r.mode
    kustom.akhir = r.akhir.j
    kustom.sampai = r.akhir.j === 'd' ? r.akhir.tgl : ''
    kustom.kali = r.akhir.j === 'x' ? r.akhir.kali : 13
  }
  else {
    kustom.tiap = 1
    kustom.satuan = 'minggu'
    kustom.hari = deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? [new Date(Number(deadline.slice(0, 4)), Number(deadline.slice(5, 7)) - 1, Number(deadline.slice(8, 10))).getDay()] : [1]
    kustom.mode = 'tgl'
    kustom.akhir = ''
    kustom.sampai = ''
    kustom.kali = 13
  }
}
const ulangKustom = computed(() => susunUlang({
  tiap: Math.max(1, Math.min(99, kustom.tiap || 1)),
  satuan: kustom.satuan,
  hari: kustom.satuan === 'minggu' ? [...kustom.hari].sort((a, b) => a - b) : [],
  mode: kustom.mode,
  akhir: kustom.akhir === 'd' ? { j: 'd', tgl: kustom.sampai } : kustom.akhir === 'x' ? { j: 'x', kali: Math.max(1, kustom.kali || 1) } : { j: '' },
  preset: '',
}))
/** Recurrence select items: presets with deadline-aware labels, the stored custom pattern, then Kustom. */
const opsiUlang = computed(() => {
  const items = [{ value: PILIHAN_TANPA, label: 'Tidak berulang' }]
  for (const [v] of ULANG.filter(([vv]) => !!vv)) items.push({ value: v, label: labelUlang(v, f.deadline) || v })
  if (f.ulang.startsWith('k/') && parseUlang(f.ulang)) items.push({ value: f.ulang, label: labelUlang(f.ulang, f.deadline) })
  items.push({ value: '__kustom', label: 'Kustom…' })
  return items
})
const ulangTampilKustom = computed(() => f.ulang === '__kustom' || f.ulang.startsWith('k/'))
/**
 * Sub-task drafts (`_subDraft`): id kept, empty text dropped on save. `p` is the single assignee.
 * `note` + `files` (Nov 2026) are the step's keterangan and attachments; `punya` = the stored
 * sub-task already had them, so an emptied note or a last removed file is still sent (and wins
 * over the server's keep-what-the-old-Panel-omits rule). `buka` = its box is open in this form.
 */
interface DrafSub { id: string, t: string, done: boolean, d: string, p: string, note: string, files: BdLampiran[], punya: boolean, buka: boolean }
const subDraf = ref<DrafSub[]>([])
const subBaruKosong = (t: string): DrafSub => ({ id: uidBd('s'), t, done: false, d: '', p: '', note: '', files: [], punya: false, buka: false })
const subBaru = ref('')
/** Tag drafts: committed on save, so a tag left in the box is never silently lost. */
const tagDraf = ref<string[]>([])
const tagBaru = ref('')
/** Session tags: typed while the form is open — stay choices even when unticked, or the chip vanishes the moment it is pressed. */
const tagSesi = ref<string[]>([])
/** Draft colours (`{lowercaseTag: hex}`): committed to `tagWarna` on save. */
const warnaDraf = ref<Record<string, string>>({})
/** The tag whose palette is open (`tagBukaWarna`). */
const warnaBuka = ref('')
const { data: setelan } = useBdSettings()
/** Stored colours; absent until the API carries the document — readers hash the name. */
const warnaSimpan = computed(() => (setelan.value?.data.tagWarna || {}) as Record<string, string>)
const versiWarna = computed(() => versiSetelan(setelan.value, 'tagWarna'))
/** Colours as the picker shows them: stored overridden by this form's drafts. */
const warnaLihat = computed(() => ({ ...warnaSimpan.value, ...warnaDraf.value }))
/** Every tag on offer: worn by any task, plus this session's, picked ones always. */
const semuaPilih = computed(() => {
  const ada = semuaTag(props.tasks)
  const lihat = new Set(ada.map(kunciTag))
  const out = ada.slice()
  for (const x of [...tagSesi.value, ...tagDraf.value]) {
    if (!lihat.has(kunciTag(x))) {
      lihat.add(kunciTag(x))
      out.push(x.trim())
    }
  }
  return out.sort((a, b) => a.localeCompare(b, 'id'))
})
const tagDipakai = (x: string) => tagDraf.value.some(y => kunciTag(y) === kunciTag(x))
function tagToggle(x: string) {
  const i = tagDraf.value.findIndex(y => kunciTag(y) === kunciTag(x))
  if (i > -1) tagDraf.value.splice(i, 1)
  else {
    tagDraf.value.push(x)
    if (!tagSesi.value.some(y => kunciTag(y) === kunciTag(x))) tagSesi.value.push(x)
  }
}
function tagTambah() {
  String(tagBaru.value || '').split(',').forEach((v) => {
    v = v.trim().replace(/^#+/, '').slice(0, 40)
    if (!v) return
    const k = kunciTag(v)
    const ada = semuaPilih.value.find(y => kunciTag(y) === k)
    // A TRULY new tag (worn by no task, no stored colour, no draft colour
    // yet) draws a random one, preferring an unused colour. Old tags are
    // never redrawn.
    if (!ada && !warnaSimpan.value[k] && !warnaDraf.value[k]) {
      warnaDraf.value[k] = warnaAcakTag(semuaPilih.value.map(x => warnaTag(x, warnaLihat.value)))
    }
    v = ada || v
    if (!tagDraf.value.some(y => kunciTag(y) === k)) tagDraf.value.push(v)
    if (!tagSesi.value.some(y => kunciTag(y) === k)) tagSesi.value.push(v)
  })
  tagBaru.value = ''
}
/** Recolour one tag (`tagSetWarna`): applies to every task wearing it. */
function tagSetWarna(c: string) {
  if (!warnaBuka.value || !TAG_PALET.includes(c)) return
  warnaDraf.value[kunciTag(warnaBuka.value)] = c
}
/** Order drafts (`_depDraft`): waited-on ids, committed on save. */
const depDraf = ref<string[]>([])
const hapusMau = ref(false)

watch(open, (o) => {
  if (!o) return
  const t = props.task
  if (t) {
    f.name = t.name
    f.desc = t.desc || ''
    f.div = t.div || opsiDiv.value[0]!
    f.pics = [...(t.pics || (t.pic ? [t.pic] : []))]
    f.reviewers = [...(t.reviewers || [])]
    f.status = t.status
    f.priority = t.priority
    f.type = t.type || 'Ad-hoc'
    f.start = t.start || ''
    f.deadline = t.deadline || ''
    f.jam = t.jam || ''
    f.project = t.project || null
    f.daily = !!t.daily
    f.ulang = t.ulang || ''
    f.important = !!t.important
    f.urgent = !!t.urgent
    kustomDari(t.ulang || '', t.deadline || '')
    subDraf.value = subs(t).map(x => ({
      id: String(x.id || uidBd('s')), t: String(x.t || ''), done: !!x.done, d: String(x.d || ''), p: String(x.p || ''),
      note: String(x.note || ''), files: lampiranSah(x.files),
      punya: 'note' in x || 'files' in x, buka: false,
    }))
    tagDraf.value = tagsOf(t)
    depDraf.value = deps(t).filter(d => d !== t.id && props.tasks.some(x => x.id === d))
  }
  else {
    const aku = props.aku
    f.name = ''
    f.desc = ''
    f.div = divisiBawaan(aku?.div, opsiDiv.value)
    f.pics = aku ? [aku.id] : []
    f.reviewers = []
    f.status = 'To Do'
    f.priority = 'Medium'
    f.type = 'Ad-hoc'
    f.start = ''
    f.deadline = todayISO()
    f.jam = ''
    f.project = props.presetDaily ? null : (props.presetProject || null)
    f.daily = !!props.presetDaily
    f.ulang = ''
    f.important = true
    f.urgent = false
    kustomDari('', todayISO())
    subDraf.value = []
    tagDraf.value = []
    depDraf.value = []
  }
  subBaru.value = ''
  tagBaru.value = ''
  tagSesi.value = []
  warnaDraf.value = {}
  warnaBuka.value = ''
})

const q = computed(() => kuadran(f))
const opsiProject = computed(() => opsiProjectBd(props.projects, f.project))
const subHitung = computed(() => {
  const n = subDraf.value.length
  return { n, d: subDraf.value.filter(s => s.done).length }
})
/**
 * Order candidates (`depGambar`): same project, self excluded, circle-makers
 * hidden. Already-picked rows always stay, Done ones sink to the bottom.
 */
const depCalon = computed(() => {
  const self = props.task?.id
  const proj = f.project || null
  return props.tasks.filter((x) => {
    if (x.id === self) return false
    if (depDraf.value.includes(x.id)) return true
    if ((x.project || null) !== proj) return false
    if (self && menungguTransitif(props.tasks, x.id, self)) return false
    return true
  }).slice().sort((a, b) => ((selesai(a) ? 1 : 0) - (selesai(b) ? 1 : 0)) || String(a.name).localeCompare(String(b.name)))
})
const ditungguOleh = computed(() => (props.task ? props.tasks.filter(x => deps(x).includes(props.task!.id)) : []))
const pesanHapus = computed(() => (props.task ? pesanHapusTask(props.task, props.tasks) : ''))

function subTambah() {
  const v = subBaru.value.trim()
  if (!v) return
  subDraf.value.push(subBaruKosong(v))
  subBaru.value = ''
}
/** Uploads still running, per sub-task id — Save waits for them (the reference must be in the row). */
const mengunggah = ref<Record<string, number>>({})
const sedangUnggah = computed(() => Object.values(mengunggah.value).some(n => n > 0))
/**
 * Attach the picked files to one sub-task draft: checked here first (type,
 * 8 MB), uploaded at once, the answer kept in the draft. The task row only
 * changes on Save; an upload never saved is cleaned up by the server.
 */
async function lampirkan(s: DrafSub, ev: Event) {
  const input = ev.target as HTMLInputElement
  const daftar = Array.from(input.files ?? [])
  input.value = ''
  for (const file of daftar) {
    const salah = tolakLampiran(file)
    if (salah) {
      toast.add({ title: salah, color: 'warning' })
      continue
    }
    mengunggah.value[s.id] = (mengunggah.value[s.id] ?? 0) + 1
    try {
      s.files.push(await unggahLampiranBd(file))
    }
    catch (e) {
      // Our own refusals (unreadable file, no key back) carry their reason; network/API errors go through apiErrorMessage.
      const pesan = e instanceof Error && e.name !== 'FetchError' ? e.message : apiErrorMessage(e)
      toast.add({ title: `Gagal mengunggah ${file.name}`, description: pesan, color: 'error' })
    }
    finally {
      mengunggah.value[s.id] = Math.max(0, (mengunggah.value[s.id] ?? 1) - 1)
    }
  }
}
/** Assignee choices for one sub-task row: active crew, plus whoever already holds it. */
const opsiSubPic = (p: string) => [
  { value: PILIHAN_TANPA, label: '— assign —' },
  ...kruTersedia(props.people, p || undefined).map(k => ({ value: k.id, label: String(k.name).split(' ')[0] })),
]

async function simpan() {
  if (!f.name.trim()) {
    toast.add({ title: 'Nama task wajib diisi.', color: 'error' })
    return
  }
  if (sedangUnggah.value) {
    toast.add({ title: 'Lampiran masih diunggah — tunggu sebentar lalu simpan lagi.', color: 'warning' })
    return
  }
  const deadline = f.deadline || (f.ulang ? (props.task?.deadline || f.start || todayISO()) : '')
  // A start past the deadline would draw the Timeline bar backwards — refused
  // here, never silently drawn as a diamond.
  if (f.start && deadline && f.start > deadline) {
    toast.add({ title: 'Tanggal mulai tidak boleh sesudah deadline.', color: 'error' })
    return
  }
  // The time box is optional and only rides a deadline — a time without a
  // date would have nowhere to be drawn. The shape is checked too: a
  // hand-typed value bypassing `type=time` must not save verbatim.
  if (f.jam && !jamValid(f.jam)) {
    toast.add({ title: 'Jam tidak valid — pakai format 24 jam, mis. 14:00.', color: 'error' })
    return
  }
  if (f.jam && !deadline) {
    toast.add({ title: 'Jam butuh tanggal deadline dulu.', color: 'error' })
    return
  }
  // Sub-tasks without text are dropped: empty rows keep x/y from ever balancing.
  // `p` rides inside the sub-task, no migration — unassigned stays empty, never guessed.
  const subtasks: BdSubtask[] = subDraf.value
    .map(s => ({
      id: s.id, t: s.t.trim(), done: s.done, ...(s.d ? { d: s.d } : {}), ...(s.p ? { p: s.p } : {}),
      ...(s.note.trim() || s.punya ? { note: s.note.trim() } : {}),
      ...(s.files.length || s.punya ? { files: s.files } : {}),
    }))
    .filter(s => s.t)
  let dependsOn = depDraf.value.filter(d => d !== props.task?.id && props.tasks.some(x => x.id === d))
  // A leftover tag in the box joins: saving without Enter must not silently drop it.
  if (tagBaru.value.trim()) tagTambah()
  // Tag colours ride in the `tagWarna` settings document: this form's drafts
  // over the stored map, replaced when anything changed. A failed colour save
  // never blocks the task itself.
  const gabungWarna = { ...warnaSimpan.value, ...warnaDraf.value }
  if (Object.keys(gabungWarna).some(k => warnaSimpan.value[k] !== gabungWarna[k])) {
    await bdTulisDiam(() => putSetelan('tagWarna', gabungWarna, versiWarna.value))
  }
  const daily = f.daily
  if (daily) f.project = null
  // Changing the project moves the task: an order only holds inside one
  // project, so the ones that would reach across are dropped (same rules as
  // "Pindahkan Task", app/utils/bd-pindah.ts). Untouched when the project stays.
  const projBaru = f.project || null
  const pindah = !!props.task && (props.task.project || null) !== projBaru
  if (pindah) dependsOn = dependsOn.filter(d => projBaru !== null && (props.tasks.find(x => x.id === d)?.project || null) === projBaru)
  // Custom recurrence is read once, on save (`bacaKustom`).
  let ulang = f.ulang
  if (ulang === '__kustom') {
    if (!(kustom.tiap >= 1 && kustom.tiap <= 99)) {
      toast.add({ title: '"Ulangi setiap" harus 1 sampai 99.', color: 'error' })
      return
    }
    if (kustom.satuan === 'minggu' && !kustom.hari.length && /^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      kustom.hari = [new Date(Number(deadline.slice(0, 4)), Number(deadline.slice(5, 7)) - 1, Number(deadline.slice(8, 10))).getDay()]
    }
    if (kustom.akhir === 'd') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(kustom.sampai)) {
        toast.add({ title: 'Isi tanggal berakhirnya.', color: 'error' })
        return
      }
      if (deadline && kustom.sampai < deadline) {
        toast.add({ title: 'Tanggal berakhir tidak boleh sebelum deadline.', color: 'error' })
        return
      }
    }
    if (kustom.akhir === 'x' && !(kustom.kali >= 1 && kustom.kali <= 999)) {
      toast.add({ title: 'Jumlah kali harus 1 sampai 999.', color: 'error' })
      return
    }
    ulang = ulangKustom.value
  }
  const body: Partial<BdTask> = {
    name: f.name.trim(),
    desc: f.desc.trim(),
    div: f.div,
    status: f.status,
    priority: f.priority,
    type: f.type,
    start: f.start || '',
    deadline,
    jam: f.jam || '',
    project: f.project || null,
    daily,
    ulang: ulang || '',
    reviewers: f.reviewers.slice(),
    important: f.important,
    urgent: f.urgent,
    tags: tagDraf.value.slice(),
    subtasks,
    dependsOn,
  }
  if (f.status === 'Done') {
    const cek = cekBolehDone({ id: props.task?.id, name: f.name }, dependsOn, props.tasks)
    if (!cek.boleh) {
      toast.add({ title: pesanTunggu({ name: f.name }, cek.nama), color: 'error' })
      return
    }
  }
  setPics(body, f.pics)
  const lama = props.task
  if (lama) {
    // The full row goes out (PUT replaces): `segarkanProgress` also drops a
    // stale `doneAt` when the task is reopened. A status change through the
    // modal is not a drag, so the bottom-of-column marker is dropped.
    const kirim: Partial<BdTask> = { ...lama, ...body }
    delete kirim.updatedAt
    if (kirim.status !== lama.status) delete kirim.pindahKe
    // Who assigned whom: newly added PICs/reviewers get a stamp, so the added
    // person finds a notification in Undangan & Notifikasi.
    capPenugasan(kirim, pics(lama), reviewers(lama), f.pics, f.reviewers, props.aku?.id)
    segarkanProgress(kirim)
    const ok = await bdSimpan(() => ubahBd<BdTask>('tasks', lama.id, kirim, versiBaris(lama)), 'Task diperbarui')
    if (ok) {
      open.value = false
      if (pindah) await lepaskanPenunggu(lama, projBaru)
    }
  }
  else {
    const kirim: Partial<BdTask> = { id: uidBd('t'), progress: 0, ...body }
    capPenugasan(kirim, [], [], f.pics, f.reviewers, props.aku?.id)
    segarkanProgress(kirim)
    const ok = await bdSimpan(() => buatBd<BdTask>('tasks', kirim), 'Task ditambahkan')
    if (ok) {
      open.value = false
    }
  }
}

/** After a move: tasks left behind that still wait on this one lose that order. */
async function lepaskanPenunggu(lama: BdTask, projBaru: string | null) {
  const lepas = rencanaPindah(props.tasks, [lama.id], projBaru).ubah.filter(u => u.id !== lama.id)
  if (!lepas.length) return
  const hasil = await petaParalel(lepas, BATAS_TULIS_PARALEL, (u) => {
    const t = props.tasks.find(x => x.id === u.id)
    return t ? tambalBd<BdTask>('tasks', u.id, u.fields, versiBaris(t)) : Promise.resolve(null)
  })
  const gagal = hasil.filter(h => h.status === 'rejected').length
  await refreshNuxtData(['bd-state'])
  if (gagal) toast.add({ title: 'Task sudah pindah, tapi ada task lain yang masih menunggunya', description: `${gagal} urutan belum terlepas. Buka task itu dan lepas urutannya.`, color: 'warning' })
}

async function hapus() {
  const lama = props.task
  if (!lama) return
  hapusMau.value = false
  const ok = await hapusTaskDenganUrutan(lama, props.tasks)
  if (ok) open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="task ? 'Edit task' : 'Task baru'"
    description="Prioritas ala Eisenhower — penting × mendesak."
    detail
  >
    <!-- Wide dialog (owner request, 17 Nov 2026): fields sit in aligned rows,
         every explanation goes under its label so the rows line up. -->
    <div class="grid grid-cols-1 gap-5">
      <UFormField label="Nama task">
        <UInput
          v-model="f.name"
          placeholder="Apa yang harus dikerjakan?"
          size="lg"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Deskripsi">
        <UTextarea
          v-model="f.desc"
          placeholder="Detail / catatan…"
          :rows="3"
          autoresize
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Project (opsional)"
        :help="f.daily ? 'Daily Task tidak masuk project mana pun.' : 'Ganti untuk memindahkan task ini ke project lain. Urutan ke task di project lama dilepas saat disimpan.'"
      >
        <USelect
          :model-value="f.daily ? PILIHAN_TANPA : (f.project ?? PILIHAN_TANPA)"
          :items="opsiProject"
          :disabled="f.daily"
          class="w-full"
          @update:model-value="(v: string | undefined) => { f.project = !v || v === PILIHAN_TANPA ? null : v }"
        />
      </UFormField>
      <div class="grid gap-4 *:min-w-0 sm:grid-cols-2 lg:grid-cols-4">
        <UFormField label="Divisi">
          <USelect
            v-model="f.div"
            :items="opsiDiv"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Status">
          <USelect
            v-model="f.status"
            :items="STATUS_FLOW"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Prioritas">
          <USelect
            v-model="f.priority"
            :items="PRIORITAS"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Tipe">
          <USelect
            v-model="f.type"
            :items="TASK_TIPE"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="PIC — boleh lebih dari satu">
        <BdPicPicker
          v-model="f.pics"
          :people="people"
        />
      </UFormField>
      <UFormField
        label="Review oleh (opsional)"
        description="Tag siapa yang memeriksa — task berstatus Review masuk My Task-nya di kelompok &quot;Menunggu review kamu&quot;."
      >
        <BdPicPicker
          v-model="f.reviewers"
          :people="people"
        />
      </UFormField>
      <UFormField label="Tag — task ini untuk siapa (boleh lebih dari satu)">
        <div
          v-if="semuaPilih.length"
          class="flex flex-wrap gap-1.5"
        >
          <button
            v-for="x in semuaPilih"
            :key="kunciTag(x)"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
            :style="gayaTag(warnaTag(x, warnaLihat), tagDipakai(x))"
            :title="tagDipakai(x) ? `Buang tag ${x}` : `Pakai tag ${x}`"
            @click="tagToggle(x)"
          >
            <span
              class="size-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: warnaTag(x, warnaLihat) }"
              title="Ganti warna"
              role="button"
              :aria-label="`Ganti warna tag ${x}`"
              @click.stop="warnaBuka = kunciTag(warnaBuka) === kunciTag(x) ? '' : x"
            />
            #{{ x }}
            <UIcon
              :name="tagDipakai(x) ? 'i-lucide-check' : 'i-lucide-plus'"
              class="size-3.5"
            />
          </button>
        </div>
        <p
          v-else
          class="text-xs text-muted"
        >
          Belum ada tag — ketik yang pertama di bawah.
        </p>
        <div
          v-if="warnaBuka"
          class="mt-2 rounded-panel border border-default p-2.5"
        >
          <p class="mb-2 text-xs font-semibold text-default">
            Warna <b :style="{ color: warnaTag(warnaBuka, warnaLihat) }">#{{ warnaBuka }}</b>
          </p>
          <div class="flex flex-wrap items-center gap-1.5">
            <button
              v-for="c in TAG_PALET"
              :key="c"
              type="button"
              class="flex size-7 items-center justify-center rounded-full border transition-transform"
              :style="{ backgroundColor: c, borderColor: warnaTag(warnaBuka, warnaLihat) === c ? warnaTag(warnaBuka, warnaLihat) : 'transparent' }"
              :title="c"
              :aria-label="`Pakai warna ${c} untuk tag ${warnaBuka}`"
              @click="tagSetWarna(c)"
            >
              <UIcon
                v-if="warnaTag(warnaBuka, warnaLihat) === c"
                name="i-lucide-check"
                class="size-3.5 text-white"
              />
            </button>
            <UButton
              label="Selesai"
              color="neutral"
              variant="outline"
              size="xs"
              @click="warnaBuka = ''"
            />
          </div>
          <p class="mt-1.5 text-[11px] text-muted">
            Berlaku untuk semua task yang memakai tag ini.
          </p>
        </div>
        <div class="mt-1.5 flex gap-1.5">
          <UInput
            v-model="tagBaru"
            placeholder="Ketik tag baru (pisahkan koma), lalu Enter…"
            size="sm"
            class="min-w-0 flex-1 [&_input]:min-w-0"
            @keydown.enter.prevent="tagTambah"
          />
          <UButton
            label="Tambah"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            @click="tagTambah"
          />
        </div>
      </UFormField>
      <div class="grid gap-4 *:min-w-0 sm:grid-cols-3">
        <UFormField label="Mulai (opsional)">
          <AppTanggal
            v-model="f.start"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Deadline">
          <AppTanggal
            v-model="f.deadline"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Jam (opsional)"
          help="Info di samping deadline, mis. 14:00."
        >
          <AppJam
            v-model="f.jam"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="grid gap-4 *:min-w-0 sm:grid-cols-2">
        <UFormField
          label="Berulang"
          :help="`Kosongkan deadline untuk memakai jadwal yang sudah ada, tanggal mulai, atau hari ini. Task masuk Doing pada tanggal jadwalnya dan task berikutnya dibuat setelah Done.${labelUlang(f.ulang === '__kustom' ? ulangKustom : f.ulang, f.deadline) ? ` ${labelUlang(f.ulang === '__kustom' ? ulangKustom : f.ulang, f.deadline)}.` : ''}`"
        >
          <USelect
            :model-value="f.ulang || PILIHAN_TANPA"
            :items="opsiUlang"
            class="w-full"
            @update:model-value="(v: string | undefined) => { f.ulang = !v || v === PILIHAN_TANPA ? '' : v; if (f.ulang === '__kustom' || f.ulang.startsWith('k/')) kustomDari(f.ulang === '__kustom' ? ulangKustom : f.ulang, f.deadline) }"
          />
        </UFormField>
        <UFormField
          label="Daily Task"
          help="Daily Task tidak masuk project mana pun."
        >
          <label class="flex min-h-9 cursor-pointer items-center gap-2 rounded-field border border-default bg-default px-3 py-2 text-sm">
            <UCheckbox v-model="f.daily" />
            Masuk Daily Task
          </label>
        </UFormField>
      </div>
      <div
        v-if="ulangTampilKustom"
        class="rounded-panel border border-default p-3"
      >
        <p class="mb-2 text-xs font-bold text-highlighted">
          Kustom — {{ labelUlang(f.ulang === '__kustom' ? ulangKustom : f.ulang, f.deadline) }}
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-muted">Ulangi setiap</span>
          <UInput
            v-model="kustom.tiap"
            type="number"
            :min="1"
            :max="99"
            class="w-20"
          />
          <USelect
            v-model="kustom.satuan"
            :items="['hari', 'minggu', 'bulan', 'tahun']"
            class="w-32"
          />
        </div>
        <div
          v-if="kustom.satuan === 'minggu'"
          class="mt-2 flex flex-wrap items-center gap-1.5"
        >
          <span class="mr-1 text-sm text-muted">Pada hari</span>
          <button
            v-for="(h, ix) in HARI_SINGKAT"
            :key="h"
            type="button"
            :title="['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][ix]"
            class="flex size-8 items-center justify-center rounded-full border text-xs font-bold transition-colors"
            :class="kustom.hari.includes(ix) ? 'border-yellow-deep bg-yellow-light text-highlighted' : 'border-default text-muted'"
            @click="kustom.hari.includes(ix) ? kustom.hari = kustom.hari.filter(x => x !== ix) : kustom.hari.push(ix)"
          >
            {{ h }}
          </button>
        </div>
        <div
          v-if="kustom.satuan === 'bulan'"
          class="mt-2 flex flex-wrap items-center gap-2"
        >
          <span class="text-sm text-muted">Pada</span>
          <USelect
            v-model="kustom.mode"
            :items="[{ value: 'tgl', label: 'Tanggal yang sama' }, { value: 'ke', label: 'Hari ke-N' }, { value: 'akhir', label: 'Hari terakhir' }]"
            class="w-44"
          />
        </div>
        <div class="mt-2 grid gap-1.5">
          <span class="text-sm font-semibold text-default">Berakhir</span>
          <label class="flex items-center gap-2 text-sm">
            <UCheckbox
              :model-value="kustom.akhir === ''"
              @update:model-value="(v: boolean | 'indeterminate') => { if (v === true) kustom.akhir = '' }"
            />
            Tidak pernah
          </label>
          <label class="flex flex-wrap items-center gap-2 text-sm">
            <UCheckbox
              :model-value="kustom.akhir === 'd'"
              @update:model-value="(v: boolean | 'indeterminate') => { if (v === true) kustom.akhir = 'd' }"
            />
            Pada tanggal
            <AppTanggal
              v-model="kustom.sampai"
              class="w-40"
              @focus="kustom.akhir = 'd'"
            />
          </label>
          <label class="flex flex-wrap items-center gap-2 text-sm">
            <UCheckbox
              :model-value="kustom.akhir === 'x'"
              @update:model-value="(v: boolean | 'indeterminate') => { if (v === true) kustom.akhir = 'x' }"
            />
            Sesudah
            <UInput
              v-model="kustom.kali"
              type="number"
              :min="1"
              :max="999"
              class="w-24"
              @focus="kustom.akhir = 'x'"
            />
            kali
          </label>
        </div>
      </div>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Sub-task{{ subHitung.n ? ` · ${subHitung.d}/${subHitung.n} selesai` : '' }}
        </p>
        <div
          v-if="subDraf.length"
          class="mb-2 divide-y divide-default rounded-panel border border-default"
        >
          <div
            v-for="(s, ix) in subDraf"
            :key="s.id"
          >
            <!-- Phone: the name takes a full line, date / assignee / buttons wrap under it. -->
            <div class="flex flex-wrap items-center gap-2 px-3 py-2">
              <UCheckbox
                :model-value="s.done"
                @update:model-value="(v: boolean | 'indeterminate') => s.done = v === true"
              />
              <UInput
                :model-value="s.t"
                placeholder="Sub-task…"
                size="sm"
                class="min-w-[12rem] flex-1 [&_input]:min-w-0"
                :class="s.done ? 'opacity-60 line-through' : ''"
                @update:model-value="(v: string | number) => s.t = String(v)"
              />
              <AppTanggal
                :model-value="s.d"
                size="sm"
                title="Deadline sub-task (opsional)"
                class="w-36 shrink-0"
                @update:model-value="(v: string | number) => s.d = String(v)"
              />
              <USelect
                :model-value="s.p || PILIHAN_TANPA"
                :items="opsiSubPic(s.p)"
                size="sm"
                title="Di-assign ke (opsional)"
                class="w-40 shrink-0"
                @update:model-value="(v: string | undefined) => s.p = !v || v === PILIHAN_TANPA ? '' : v"
              />
              <UButton
                :icon="s.files.length ? 'i-lucide-paperclip' : (s.note.trim() ? 'i-lucide-message-square-text' : 'i-lucide-message-square-plus')"
                :label="s.files.length ? String(s.files.length) : undefined"
                color="neutral"
                :variant="s.buka ? 'soft' : 'ghost'"
                size="xs"
                :class="s.note.trim() || s.files.length ? 'text-gold-deep' : ''"
                title="Catatan & lampiran"
                :aria-label="`Catatan & lampiran sub-task ${s.t || ix + 1}`"
                :aria-expanded="s.buka"
                @click="s.buka = !s.buka"
              />
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Hapus sub-task"
                @click="subDraf.splice(ix, 1)"
              />
            </div>
            <!-- Keterangan + attachments of this step (Nov 2026). Saved with the task. -->
            <div
              v-if="s.buka"
              class="mx-2 mb-2 flex flex-col gap-2 rounded-xl border border-default bg-muted p-3"
            >
              <UTextarea
                v-model="s.note"
                :rows="2"
                autoresize
                placeholder="Catatan / keterangan sub-task ini…"
                class="w-full"
                :aria-label="`Catatan sub-task ${s.t || ix + 1}`"
              />
              <div
                v-if="s.files.length"
                class="flex flex-wrap gap-2"
              >
                <BdLampiranChip
                  v-for="(fl, fi) in s.files"
                  :key="fl.key"
                  :file="fl"
                  hapus
                  @hapus="s.files.splice(fi, 1)"
                />
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <label
                  class="relative inline-flex cursor-pointer items-center gap-1.5 rounded-field border border-default bg-default px-2.5 py-1.5 text-xs font-semibold text-gold-deep hover:bg-gold-soft/40"
                >
                  <UIcon
                    :name="mengunggah[s.id] ? 'i-lucide-loader' : 'i-lucide-paperclip'"
                    class="size-4"
                    :class="mengunggah[s.id] ? 'animate-spin' : ''"
                  />
                  {{ mengunggah[s.id] ? 'Mengunggah…' : 'Lampirkan berkas / foto' }}
                  <input
                    type="file"
                    multiple
                    :accept="LAMPIRAN_TERIMA"
                    class="sr-only"
                    @change="lampirkan(s, $event)"
                  >
                </label>
                <span class="text-[11px] text-muted">Gambar, PDF, Word, Excel, PowerPoint, TXT/CSV · maks 8 MB</span>
              </div>
            </div>
          </div>
        </div>
        <p
          v-else
          class="mb-2 text-xs text-muted"
        >
          Belum ada sub-task.
        </p>
        <div class="flex gap-2">
          <UInput
            v-model="subBaru"
            placeholder="Tambah sub-task, Enter…"
            size="sm"
            class="min-w-0 flex-1 [&_input]:min-w-0"
            @keydown.enter.prevent="subTambah"
          />
          <UButton
            label="Tambah"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            @click="subTambah"
          />
        </div>
      </div>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Baru bisa Done kalau task ini sudah Done
        </p>
        <div
          v-if="depCalon.length"
          class="grid max-h-44 gap-1 overflow-y-auto rounded-panel border border-default p-2"
        >
          <label
            v-for="x in depCalon"
            :key="x.id"
            class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-elevated/50"
          >
            <UCheckbox
              :model-value="depDraf.includes(x.id)"
              @update:model-value="(v: boolean | 'indeterminate') => { const i = depDraf.indexOf(x.id); if (v === true && i < 0) depDraf.push(x.id); if (v !== true && i > -1) depDraf.splice(i, 1) }"
            />
            <span
              class="min-w-0 flex-1 truncate"
              :class="selesai(x) ? 'text-muted line-through' : 'text-highlighted'"
            >{{ x.name }}</span>
            <AppStatus
              size="sm"
              :color="WARNA_TASK[x.status] || 'neutral'"
            >{{ x.status }}</AppStatus>
          </label>
        </div>
        <p
          v-else
          class="text-xs text-muted"
        >
          {{ f.project ? 'Belum ada task lain di project ini.' : 'Pilih project dulu — urutan diatur antar task di project yang sama.' }}
        </p>
        <p
          v-if="ditungguOleh.length"
          class="mt-1 text-xs text-muted"
        >
          Ditunggu oleh: {{ ditungguOleh.map(x => x.name).join(', ') }}
        </p>
      </div>
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
          Prioritas Eisenhower
        </p>
        <div class="grid gap-3 *:min-w-0 sm:grid-cols-2">
          <AppPilihan
            v-model="f.important"
            name="task-important"
            :options="[{ value: true, label: 'Penting: ya' }, { value: false, label: 'Tidak' }]"
          />
          <AppPilihan
            v-model="f.urgent"
            name="task-urgent"
            :options="[{ value: true, label: 'Mendesak: ya' }, { value: false, label: 'Tidak' }]"
          />
        </div>
        <div class="mt-2">
          <AppStatus
            :color="WARNA_KUADRAN[q.k]"
            size="sm"
          >
            {{ q.l }} — {{ q.d }}
          </AppStatus>
        </div>
      </div>
    </div>

    <!-- The wide (detail) footer lays out left to right: Hapus apart on the left, Batal · Simpan on the right. -->
    <template #footer>
      <UButton
        v-if="task"
        label="Hapus"
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        class="me-auto"
        @click="hapusMau = true"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <!-- Phone sheet footer is a 2-column grid: with Hapus present Simpan takes a full row. -->
      <UButton
        label="Simpan"
        icon="i-lucide-check"
        :class="task ? 'col-span-2' : ''"
        loading-auto
        @click="simpan"
      />
    </template>
  </ResponsiveSheet>

  <BdKonfirmasi
    v-model:open="hapusMau"
    title="Hapus task ini?"
    :description="pesanHapus"
    @konfirmasi="hapus"
  />
</template>
