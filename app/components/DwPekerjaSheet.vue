<!--
  Database DW — form Daily Worker (deploy/dw/index.html bukaPekerja/simpanPekerja
  :6221-6428).

  One person may hold several divisions and several positions (F.11); the
  FIRST one checked is the main one, and the order of checking is kept
  (`data-urut`, :6124). Positions follow the divisions that are checked, and a
  stored position that no longer fits any of them stays visible as "(lama)"
  so opening the form and saving cannot silently remove it — that would also
  change the tariff it is paid by (:6146).

  Deactivating does not touch approved shifts (the sheet checks the person's
  status nowhere); after saving, the remaining future shifts are named and
  offered for cancellation (`tanyaShiftTertinggal`, :6433).
-->
<script setup lang="ts">
import type { AjuanDw, PekerjaDw } from '~/utils/dw'
import {
  bankDipakaiDw, BAYAR, bayarJenisSah, divPekerja, normalHp, posPekerja, posisiDivisiDw,
  STATUS_DW,
} from '~/utils/dw'
import { DIVISI } from '~/utils/jadwal'
import { hapusWorkerDw, putusAjuanDw, saveWorkerDw, useDwDasar } from '~/composables/useDw'
import { hariIni } from '~/utils/format'

const props = defineProps<{ p: PekerjaDw | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const { set, ajuan, pekerja, peran } = useDwDasar()

const nama = ref('')
const hp = ref('')
const div = ref<string[]>([])
const pos = ref<string[]>([])
const gender = ref('__kosong__')
const area = ref('')
const bayarJenis = ref('BANK')
const bayarBank = ref('')
const bayarNomor = ref('')
const skill = ref('')
const status = ref('AKTIF')
const catatan = ref('')
const sibuk = ref(false)

const KOSONG = '__kosong__'

watch(open, (v) => {
  if (!v) return
  const p = props.p
  nama.value = p?.nama ?? ''
  hp.value = p?.hp ?? ''
  div.value = p ? divPekerja(p) : []
  pos.value = p ? posPekerja(p) : []
  gender.value = p?.gender || KOSONG
  area.value = p?.area ?? ''
  bayarJenis.value = p ? bayarJenisSah(p.bayarJenis) : 'BANK'
  bayarBank.value = p?.bayarBank ?? ''
  bayarNomor.value = p?.bayarNomor ?? ''
  skill.value = p?.skill ?? ''
  status.value = p?.status ?? 'AKTIF'
  catatan.value = p?.catatan ?? ''
}, { immediate: true })

function toggleDiv(k: string) {
  const i = div.value.indexOf(k)
  if (i > -1) div.value.splice(i, 1)
  else div.value.push(k)
  // Positions that no longer fit any checked division stay as (lama).
}
function togglePos(x: string) {
  const i = pos.value.indexOf(x)
  if (i > -1) pos.value.splice(i, 1)
  else pos.value.push(x)
}
const grupPosisi = computed(() => div.value.map(k => ({ k, list: posisiDivisiDw(set.value, k) })).filter(g => g.list.length))
const posLama = computed(() => {
  const sah = new Set(grupPosisi.value.flatMap(g => g.list))
  return pos.value.filter(x => !sah.has(x))
})
const ketBayar = computed(() => BAYAR[bayarJenisSah(bayarJenis.value)] ?? BAYAR.BANK!)
const bankOpsi = computed(() => bankDipakaiDw(pekerja.value))

async function simpan() {
  if (sibuk.value) return
  const nm = nama.value.trim()
  if (!nm) return toast.add({ title: 'Nama wajib diisi', color: 'error' })
  const noHp = normalHp(hp.value)
  if (!noHp) return toast.add({ title: 'No. HP wajib diisi', color: 'error' })
  if (!div.value.length) return toast.add({ title: 'Centang minimal satu divisi', color: 'error' })
  const lama = props.p
  const jadiNonaktif = !!(lama && lama.status !== 'NONAKTIF' && status.value === 'NONAKTIF')
  sibuk.value = true
  try {
    await saveWorkerDw({
      id: lama?.id,
      nama: nm,
      hp: noHp,
      divisi: div.value.join(','),
      posisi: pos.value.join(','),
      gender: gender.value === KOSONG ? '' : gender.value,
      area: area.value,
      bank: lama?.bank ?? '',
      bayarJenis: bayarJenisSah(bayarJenis.value),
      bayarBank: bayarJenisSah(bayarJenis.value) === 'BANK' ? bayarBank.value.trim() : '',
      bayarNomor: bayarNomor.value.trim(),
      bayarNama: lama?.bayarNama ?? '',
      skill: skill.value,
      status: status.value,
      catatan: catatan.value,
    })
    open.value = false
    toast.add({ title: lama ? 'Data DW diperbarui' : 'Daily worker didaftarkan', color: 'success' })
    emit('saved')
    if (jadiNonaktif) {
      const nanti = ajuan.value.filter(a => a.dwId === lama!.id && a.status === 'DISETUJUI' && a.tgl >= hariIni())
      if (nanti.length) {
        sisa.value = nanti
        konfirmNonaktif.value = true
      }
    }
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

// Deactivating with approved shifts still standing.
const konfirmNonaktif = ref(false)
const sisa = ref<AjuanDw[]>([])
async function batalkanSisa() {
  let gagal = 0
  for (const a of sisa.value) {
    try {
      await putusAjuanDw(a.id, 'BATAL', 'Dinonaktifkan')
    }
    catch {
      gagal++
    }
  }
  konfirmNonaktif.value = false
  toast.add({ title: gagal ? `${gagal} shift gagal dibatalkan — coba lagi` : `${sisa.value.length} shift dibatalkan`, color: gagal ? 'error' : 'success' })
  emit('saved')
}

async function hapus() {
  if (!props.p) return
  try {
    await hapusWorkerDw(props.p.id)
    open.value = false
    toast.add({ title: `${props.p.nama} dihapus dari database`, color: 'success' })
    emit('saved')
  }
  catch (e) {
    toast.add({ title: `Gagal menghapus: ${apiErrorMessage(e)}`, color: 'error' })
  }
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="p ? 'Sunting Daily Worker' : 'Daftarkan Daily Worker'"
  >
    <div class="space-y-4">
      <UFormField label="Nama lengkap *">
        <UInput
          v-model="nama"
          placeholder="Nama sesuai KTP"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="No. HP *"
        help="Nomor ini adalah identitas DW sekaligus cara ia dikabari. Satu nomor hanya boleh dipakai satu orang."
      >
        <UInput
          v-model="hp"
          type="tel"
          inputmode="numeric"
          placeholder="08xxxxxxxxxx"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Divisi"
        help="Boleh lebih dari satu. Yang pertama dipilih jadi divisi utamanya."
      >
        <div class="flex flex-wrap gap-2">
          <label
            v-for="d in DIVISI"
            :key="d.k"
            class="flex cursor-pointer items-center gap-1.5 rounded-field border px-3 py-2 text-sm"
            :class="div.includes(d.k) ? 'border-primary-400 bg-primary-100/60' : 'border-default'"
          >
            <input
              type="checkbox"
              :checked="div.includes(d.k)"
              @change="toggleDiv(d.k)"
            >
            <span class="font-semibold">{{ d.n }}</span>
            <span
              v-if="div.indexOf(d.k) === 0"
              class="text-[11px] font-bold uppercase text-primary-700"
            >utama</span>
          </label>
        </div>
      </UFormField>

      <UFormField label="Posisi">
        <div
          v-if="!grupPosisi.length"
          class="text-sm text-muted"
        >
          Centang divisinya dulu — posisi mengikuti divisi.
        </div>
        <div
          v-else
          class="space-y-2"
        >
          <div
            v-for="g in grupPosisi"
            :key="g.k"
          >
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              {{ g.k }}
            </p>
            <div class="mt-1 flex flex-wrap gap-2">
              <label
                v-for="x in g.list"
                :key="`${g.k}-${x}`"
                class="flex cursor-pointer items-center gap-1.5 rounded-field border px-3 py-1.5 text-sm"
                :class="pos.includes(x) ? 'border-primary-400 bg-primary-100/60' : 'border-default'"
              >
                <input
                  type="checkbox"
                  :checked="pos.includes(x)"
                  @change="togglePos(x)"
                >
                {{ x }}
              </label>
            </div>
          </div>
          <div v-if="posLama.length">
            <p class="text-[11px] font-bold uppercase tracking-wide text-muted">
              Posisi lama
            </p>
            <div class="mt-1 flex flex-wrap gap-2">
              <label
                v-for="x in posLama"
                :key="`lama-${x}`"
                class="flex cursor-pointer items-center gap-1.5 rounded-field border border-default px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  :checked="pos.includes(x)"
                  @change="togglePos(x)"
                >
                {{ x }} <span class="text-muted">(lama)</span>
              </label>
            </div>
          </div>
        </div>
      </UFormField>

      <div class="grid grid-cols-2 gap-3">
        <UFormField label="Gender">
          <USelect
            v-model="gender"
            :items="[{ value: KOSONG, label: '—' }, { value: 'Pria', label: 'Pria' }, { value: 'Wanita', label: 'Wanita' }]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Area tinggal">
          <UInput
            v-model="area"
            placeholder="Mis. Pekanbaru"
            class="w-full"
          />
        </UFormField>
      </div>

      <UFormField label="Bayar lewat">
        <USelect
          v-model="bayarJenis"
          :items="Object.keys(BAYAR).map(k => ({ value: k, label: BAYAR[k]!.n }))"
          class="w-full"
        />
      </UFormField>
      <div
        v-if="bayarJenisSah(bayarJenis) === 'BANK'"
        class="grid grid-cols-2 gap-3"
      >
        <UFormField
          label="Nama bank"
          help="Belum ada di daftar? Ketik saja — bank itu ikut jadi pilihan berikutnya."
        >
          <UInput
            v-model="bayarBank"
            list="dlBankDw"
            autocomplete="off"
            placeholder="Pilih atau ketik…"
            class="w-full"
          />
          <datalist id="dlBankDw">
            <option
              v-for="b in bankOpsi"
              :key="b"
              :value="b"
            />
          </datalist>
        </UFormField>
        <UFormField :label="ketBayar.ket">
          <UInput
            v-model="bayarNomor"
            inputmode="numeric"
            class="w-full"
          />
          <template #help>
            {{ ketBayar.hint }}
          </template>
        </UFormField>
      </div>
      <UFormField
        v-else
        :label="ketBayar.ket"
      >
        <UInput
          v-model="bayarNomor"
          inputmode="numeric"
          class="w-full"
        />
        <template #help>
          {{ ketBayar.hint }}
        </template>
      </UFormField>
      <p
        v-if="p && p.bank && !p.bayarNomor"
        class="rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        Catatan rekening lama: <b>{{ p.bank }}</b> — nama banknya ke kolom Nama bank, angkanya ke kolom di atas.
        Baris ini hilang sendiri sesudahnya.
      </p>

      <UFormField label="Skill">
        <UInput
          v-model="skill"
          placeholder="Dipisah koma: Bar, Runner"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Status">
        <USelect
          v-model="status"
          :items="Object.keys(STATUS_DW).map(k => ({ value: k, label: `${STATUS_DW[k]!.n} — ${STATUS_DW[k]!.k}` }))"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Catatan HR">
        <UTextarea
          v-model="catatan"
          :rows="2"
          placeholder="Hanya dilihat staf Office"
          class="w-full"
        />
      </UFormField>
    </div>

    <template #footer>
      <UButton
        :label="sibuk ? 'Menyimpan…' : (p ? 'Simpan' : 'Daftarkan')"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        v-if="p && peran.hrd"
        label="Hapus"
        color="error"
        variant="ghost"
        @click="hapus"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>

  <ResponsiveSheet
    v-model:open="konfirmNonaktif"
    :title="`${p?.nama ?? 'DW'} masih punya shift di kalender`"
  >
    <p class="text-sm">
      <b>{{ sisa.length }} shift yang sudah disetujui</b> masih berdiri di kalender Jadwal Shift:
    </p>
    <p class="mt-2 text-sm text-muted">
      {{ sisa.map(a => `${a.tgl} ${a.m}–${a.s}`).join(', ') }}
    </p>
    <p class="mt-2 rounded-field bg-warning/12 px-3 py-2 text-sm">
      Status tidak aktif hanya menahan ajuan BARU — yang terlanjur disetujui tetap digambar, dan head divisi
      tetap menghitungnya sebagai orang yang akan datang.
    </p>
    <template #footer>
      <UButton
        :label="`Batalkan ${sisa.length} shift itu`"
        color="error"
        @click="batalkanSisa"
      />
      <UButton
        label="Biarkan"
        color="neutral"
        variant="ghost"
        @click="konfirmNonaktif = false"
      />
    </template>
  </ResponsiveSheet>
</template>
