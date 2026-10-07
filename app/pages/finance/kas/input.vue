<!--
  Finance › Kas Kecil › Input Transaksi (old `viewInput` + `simpanSemua`, deploy/finance/kas/index.html:5600-5910).

  One row = one transaction; rows are added freely and saved one by one (the old
  screen sent `simpanTrx` sequentially too — a bulk endpoint does not exist).
  Each row has ONE side (debet or kredit) and a value per pos; the split rows
  are built here: pos with a value becomes `{pos_id, debet|kredit}`. Successful
  rows leave the draft; failures stay with their message.

  DEFERRED (BD panel): the old page also listed purchase orders from BD to be
  paid, with `poTulisRealisasi` writing the realisation back. The BD module is
  migrated but the PO panel is out of this sub-issue; rows can be typed by hand.
-->
<script setup lang="ts">
import { createKkTrx, getKk, getKkTrxSatu, updateKkTrx } from '~/composables/useFinance'
import { fmtRp, num } from '~/utils/cashier'
import { hariIni } from '~/utils/format'
import { tanganiKonflik } from '~/utils/versi'

definePageMeta({ access: ['finance'] })

const izin = useKasIzin()
const toast = useToast()
const route = useRoute()

const { data, status, error, refresh } = useAsyncData('kas-kk-input', () => getKk())

const pos = computed(() => (data.value?.data.pos ?? []).filter(p => p.aktif !== false))
const kategori = computed(() => (data.value?.data.kategori ?? []).filter(k => k.aktif !== false))

interface Draft {
  key: number
  id?: string
  tgl: string
  keterangan: string
  kategori_id: string
  jenis: 'debet' | 'kredit'
  nilai: Record<string, string>
  input: boolean
  bon: boolean
}
let seq = 0
const draft = ref<Draft[]>([])
const salah = ref<Record<number, string[]>>({})
const sibuk = ref(false)

function barisKosong(): Draft {
  return { key: ++seq, tgl: hariIni(), keterangan: '', kategori_id: '__kosong', jenis: 'debet', nilai: {}, input: false, bon: false }
}
function tambahBaris() {
  draft.value.push(barisKosong())
}
function buangBaris(i: number) {
  draft.value.splice(i, 1)
}
function totalDraft(d: Draft) {
  return pos.value.reduce((s, p) => s + num(d.nilai[String(p.id)]), 0)
}
const ubah = (d: Draft, posId: string, v: string | number) => {
  d.nilai[posId] = String(v)
}

/** Prefill the edit row from `?ubah=` once the state has landed. */
const sudahPre = ref(false)
watch([data, () => route.query.ubah], () => {
  if (sudahPre.value || !data.value) return
  const id = String(route.query.ubah ?? '')
  if (!id) {
    if (!draft.value.length) tambahBaris()
    sudahPre.value = true
    return
  }
  const t = data.value.data.trx.find(x => String(x.id) === id)
  if (!t) return
  const d = barisKosong()
  d.id = String(t.id)
  d.tgl = t.tgl
  d.keterangan = t.keterangan
  d.kategori_id = t.kategori_id ? String(t.kategori_id) : '__kosong'
  d.input = !!t.input
  d.bon = !!t.bon
  const debet = t.baris.some(b => Number(b.debet) > 0)
  d.jenis = debet ? 'debet' : 'kredit'
  for (const b of t.baris) d.nilai[String(b.pos_id)] = String(debet ? b.debet : b.kredit)
  draft.value = [d]
  sudahPre.value = true
}, { immediate: true })

function validasi(d: Draft): string[] {
  const s: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.tgl)) s.push('Tanggal tidak sah.')
  if (!d.keterangan.trim()) s.push('Keterangan wajib diisi.')
  if (!pos.value.some(p => num(d.nilai[String(p.id)]) > 0)) s.push('Belum ada nominal di satu pos pun.')
  return s
}

async function simpanSemua() {
  if (!izin.ubah('kk_input')) return
  if (sibuk.value || !draft.value.length) {
    if (!draft.value.length) toast.add({ title: 'Belum ada baris yang bisa disimpan — semuanya masih kosong.', color: 'error' })
    return
  }
  sibuk.value = true
  salah.value = {}
  const gagal: Draft[] = []
  let sukses = 0
  let pertamaPesan = ''
  for (const d of draft.value) {
    const errs = validasi(d)
    if (errs.length) {
      salah.value = { ...salah.value, [d.key]: errs }
      gagal.push(d)
      if (!pertamaPesan) pertamaPesan = errs.join(' ')
      continue
    }
    const baris = pos.value
      .map(p => ({ pos_id: String(p.id), n: num(d.nilai[String(p.id)]) }))
      .filter(x => x.n > 0)
      .map(x => ({ pos_id: x.pos_id, debet: d.jenis === 'debet' ? x.n : 0, kredit: d.jenis === 'kredit' ? x.n : 0 }))
    const body = { tgl: d.tgl, keterangan: d.keterangan.trim(), kategori_id: d.kategori_id === '__kosong' ? null : d.kategori_id, input: d.input, bon: d.bon, baris }
    try {
      if (d.id) {
        const { version } = await getKkTrxSatu(d.id)
        await updateKkTrx(d.id, body, version ?? '')
      }
      else {
        await createKkTrx(body)
      }
      sukses++
    }
    catch (e) {
      if (!(await tanganiKonflik(e, refresh))) {
        salah.value = { ...salah.value, [d.key]: [apiErrorMessage(e)] }
        gagal.push(d)
        if (!pertamaPesan) pertamaPesan = apiErrorMessage(e)
      }
      else {
        gagal.push(d)
      }
    }
  }
  draft.value = gagal
  await refresh()
  sibuk.value = false
  if (sukses && !gagal.length) toast.add({ title: `${sukses} baris tersimpan.`, color: 'success' })
  else if (sukses) toast.add({ title: `${sukses} baris tersimpan, ${gagal.length} gagal: ${pertamaPesan}`, color: 'warning' })
  else toast.add({ title: `Tidak ada yang tersimpan: ${pertamaPesan || 'periksa barisnya'}`, color: 'error' })
}
</script>

<template>
  <AppPage
    title="Input transaksi kas kecil"
    description="Satu baris = satu transaksi; tambah baris sebanyak yang perlu lalu simpan sekaligus."
  >
    <template #actions>
      <UButton
        label="Ke buku kas kecil"
        icon="i-lucide-book-open"
        color="neutral"
        variant="outline"
        size="sm"
        to="/finance/kas"
      />
    </template>

    <UAlert
      v-if="!izin.ubah('kk_input')"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="Halaman ini hanya bisa dilihat."
      description="Peranmu tidak boleh mengubah transaksi Kas Kecil. Hubungi admin modul Finance kalau memang perlu."
      class="mb-4"
    />
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Gagal memuat: ${apiErrorMessage(error)}`"
      class="mb-4"
    />
    <UAlert
      v-if="!pos.length && status !== 'pending'"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Belum ada pos pembayaran."
      description="Tambahkan dulu di halaman Pos & Kategori."
      class="mb-4"
    />

    <AppPanel
      v-if="izin.ubah('kk_input')"
      :title="draft.some(d => d.id) ? 'Ubah transaksi' : 'Transaksi baru'"
      description="Debet menambah saldo pos, kredit mengurangi. Isi nominal hanya di pos yang dipakai baris ini."
    >
      <div
        v-for="(d, i) in draft"
        :key="d.key"
        class="mb-4 rounded-field border border-default p-3"
      >
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <UFormField label="Tanggal *">
            <UInput
              v-model="d.tgl"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Keterangan *"
            class="lg:col-span-2"
          >
            <UInput
              v-model="d.keterangan"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Kategori">
            <USelect
              v-model="d.kategori_id"
              :items="[{ label: '— tanpa kategori —', value: '__kosong' }, ...kategori.map(k => ({ label: k.nama, value: String(k.id) }))]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Jenis">
            <USelect
              v-model="d.jenis"
              :items="[{ label: 'Debet (uang keluar)', value: 'debet' }, { label: 'Kredit (uang masuk)', value: 'kredit' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Nominal per pos">
            <div class="grid gap-2 sm:grid-cols-2 lg:col-span-2">
              <div
                v-for="p in pos"
                :key="p.id"
                class="flex items-center gap-2"
              >
                <span class="w-28 shrink-0 truncate text-xs text-muted">{{ p.nama }}</span>
                <UInput
                  :model-value="d.nilai[String(p.id)] ?? ''"
                  inputmode="numeric"
                  placeholder="0"
                  class="w-full"
                  @update:model-value="(v: string | number) => ubah(d, String(p.id), v)"
                />
              </div>
            </div>
          </UFormField>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-4 text-sm">
          <span class="text-muted">Total baris: <b class="text-highlighted num">{{ fmtRp(totalDraft(d)) }}</b></span>
          <UCheckbox
            v-model="d.input"
            label="Sudah masuk pembukuan (Input)"
          />
          <UCheckbox
            v-model="d.bon"
            label="Nota fisik ada (Bon)"
          />
          <div class="flex-1" />
          <UButton
            label="Buang baris"
            color="error"
            variant="ghost"
            size="xs"
            @click="buangBaris(i)"
          />
        </div>
        <p
          v-for="s in salah[d.key] ?? []"
          :key="s"
          class="mt-1 text-sm text-error"
        >
          {{ s }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          label="+ Tambah baris"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          @click="tambahBaris"
        />
        <UButton
          label="Simpan semua baris"
          icon="i-lucide-save"
          size="sm"
          :loading="sibuk"
          @click="simpanSemua"
        />
        <UButton
          v-if="route.query.ubah"
          label="Batal ubah"
          color="neutral"
          variant="ghost"
          size="sm"
          to="/finance/kas/input"
        />
      </div>
      <p
        v-if="status === 'pending'"
        class="mt-2 text-sm text-muted"
      >
        Memuat…
      </p>
    </AppPanel>
  </AppPage>
</template>
