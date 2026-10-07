<!--
  Pengaturan DW (deploy/dw/index.html viewPengaturan :7805-7934 + panel
  Posisi :8184-8299). Tarif per position, preset hours, base/long shift,
  the day quota guide, and the danger zone for module admins.

  Every change writes the whole setting blob (PUT /dw/settings) — the server
  keeps `hr`/`akses` unless the caller is a module admin. Tariffs are shared
  BETWEEN divisions: Dishwasher in Bar and Kitchen is one number, and the
  panel says so (:8198). `jamBatas` warns, it never changes the price (F.14).
-->
<script setup lang="ts">
import { bolehBukaDw, divPekerja, durasiJamDw, KONTEKS, KONTEKS_LBL, KOSONG_SANDI, posisiDivisiDw, tambahanPanjangDw, tarifPosisiDw } from '~/utils/dw'
import { DIVISI, namaDivisiJadwal } from '~/utils/jadwal'
import { kosongkanDw, simpanSettingDw, useDwDasar } from '~/composables/useDw'
import { angka, rupiahVal } from '~/utils/format'

definePageMeta({ access: ['dw'] })

const toast = useToast()
const { set, pekerja, peran, pending, error, refresh } = useDwDasar()

/** Matrix-aware gate (T-10); default is HRD + admin. */
const bolehHalaman = computed(() => bolehBukaDw(set.value, peran.value, 'pengaturan'))

const sibuk = ref(false)
/** Save the blob and report; the old page wrote on every control change (:2223). */
async function simpan(pesan?: string) {
  if (sibuk.value) return
  sibuk.value = true
  try {
    await simpanSettingDw(set.value)
    if (pesan) toast.add({ title: pesan, color: 'success' })
  }
  catch (e) {
    toast.add({ title: `Gagal menyimpan pengaturan: ${apiErrorMessage(e)}`, color: 'error' })
  }
  finally {
    sibuk.value = false
  }
}

// ---- Posisi per divisi
const posBaru = reactive<Record<string, string>>({})
function tambahPosisi(div: string) {
  const v = String(posBaru[div] ?? '').trim()
  if (!v) return
  const list = posisiDivisiDw(set.value, div)
  if (list.includes(v)) {
    posBaru[div] = ''
    return toast.add({ title: `"${v}" sudah ada di ${namaDivisiJadwal(div)}`, color: 'warning' })
  }
  set.value.posisiDivisi = { ...set.value.posisiDivisi, [div]: [...list, v] }
  posBaru[div] = ''
  simpan(`Posisi "${v}" ditambahkan ke ${namaDivisiJadwal(div)}`)
}
const buang = ref<{ div: string, pos: string } | null>(null)
const buangOpen = ref(false)
function tanyaHapusPosisi(div: string, pos: string) {
  buang.value = { div, pos }
  buangOpen.value = true
}
const dipakaiPosisi = computed(() => {
  if (!buang.value) return 0
  return pekerja.value.filter(p => divPekerja(p).includes(buang.value!.div)
    && (p.posisi || '').split(',').map(x => x.trim()).includes(buang.value!.pos)).length
})
async function jalanHapusPosisi() {
  if (!buang.value) return
  const { div, pos } = buang.value
  set.value.posisiDivisi = { ...set.value.posisiDivisi, [div]: posisiDivisiDw(set.value, div).filter(x => x !== pos) }
  buangOpen.value = false
  await simpan(`Posisi "${pos}" dihapus dari ${namaDivisiJadwal(div)}`)
}
function ubahTarif(pos: string, v: string) {
  set.value.tarif = { ...set.value.tarif, [pos]: Math.max(0, rupiahVal(v)) }
  simpan(`Tarif ${pos} disimpan: ${rupiah(set.value.tarif[pos]!)}`)
}

// ---- Jam siap pakai
function tambahJam() {
  set.value.jam = [...set.value.jam, { n: 'Shift baru', m: '16:00', s: '23:00' }]
  simpan('Jam siap pakai ditambahkan')
}
function ubahJam(i: number, f: 'n' | 'm' | 's', v: string) {
  const j = set.value.jam[i]
  if (!j) return
  set.value.jam = set.value.jam.map((x, n) => (n === i ? { ...x, [f]: v } : x))
  simpan()
}
function hapusJam(i: number) {
  set.value.jam = set.value.jam.filter((_, n) => n !== i)
  simpan('Jam dihapus')
}

// ---- Shift dasar & panjang
function ubahAngka(kunci: 'jamDasar' | 'jamBatas' | 'tambahanPanjang', v: string) {
  if (kunci === 'tambahanPanjang') set.value.tambahanPanjang = Math.max(0, rupiahVal(v))
  else set.value[kunci] = Math.max(0.5, Math.min(24, Number(String(v).replace(/[^\d.]/g, '')) || (kunci === 'jamBatas' ? 12 : 6)))
  simpan(kunci === 'tambahanPanjang'
    ? `Tambahan shift panjang: ${rupiah(set.value.tambahanPanjang)}`
    : kunci === 'jamBatas' ? `Batas kewajaran: ${set.value.jamBatas} jam` : `Shift dasar: ${set.value.jamDasar} jam`)
}

// ---- Kuota
function ubahKuota(div: string, konteks: typeof KONTEKS[number], v: string) {
  const kuota = { ...set.value.kuota }
  kuota[div] = { ...kuota[div]!, [konteks]: Math.max(0, Number(v) || 0) }
  set.value.kuota = kuota
  simpan()
}

// ---- Danger zone
const kosongOpen = ref(false)
const ikutPekerja = ref(false)
const sandi = ref('')
async function jalanKosongkan() {
  if (sandi.value.trim().toUpperCase() !== KOSONG_SANDI) {
    return toast.add({ title: `Ketik ${KOSONG_SANDI} persis untuk melanjutkan`, color: 'error' })
  }
  try {
    await kosongkanDw(ikutPekerja.value)
    kosongOpen.value = false
    sandi.value = ''
    ikutPekerja.value = false
    toast.add({ title: 'Data modul dikosongkan', color: 'success' })
    await refresh()
  }
  catch (e) {
    toast.add({ title: `Gagal mengosongkan: ${apiErrorMessage(e)}`, color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Pengaturan"
    description="Tarif, jam bawaan, dan panduan jumlah DW per divisi."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel
      v-if="!pending && !bolehHalaman"
      title="Halaman ini untuk HRD dan admin modul"
      icon="i-lucide-lock"
    >
      <p class="text-sm text-muted">
        Yang menyetel tarif, kuota, dan jam bawaan memang HRD; minta admin modul membuka aksesnya di
        <b>Pengaturan → Hak Akses</b>.
      </p>
    </AppPanel>

    <template v-else>
      <AppPanel
        title="Posisi per divisi"
        icon="i-lucide-list"
        description="Menentukan pilihan posisi di form permintaan & Database DW."
      >
        <p class="mb-2 text-sm text-muted">
          Head hanya bisa meminta posisi yang terdaftar di divisinya. Menghapus posisi <b>tidak</b> mengubah data DW
          atau shift yang sudah tersimpan — yang lama tetap terbaca, ditandai <b>(lama)</b>, dan tetap dibayar
          menurut tarifnya.
        </p>
        <p class="mb-4 text-sm text-muted">
          <b>Tarif dipakai bersama.</b> <b>Dishwasher</b> di Bar dan di Kitchen dibayar sama — mengubah salah
          satunya mengubah keduanya.
        </p>

        <div class="grid gap-4 lg:grid-cols-2">
          <div
            v-for="d in DIVISI"
            :key="d.k"
            class="rounded-panel border border-default p-3"
          >
            <p class="mb-2 flex items-center justify-between text-sm font-bold text-highlighted">
              {{ d.n }}
              <span class="text-xs font-medium text-muted">{{ posisiDivisiDw(set, d.k).length }} posisi</span>
            </p>
            <div
              v-if="posisiDivisiDw(set, d.k).length"
              class="space-y-2"
            >
              <div
                v-for="x in posisiDivisiDw(set, d.k)"
                :key="x"
                class="flex items-center gap-2"
              >
                <span class="min-w-0 flex-1 truncate text-sm">{{ x }}</span>
                <span class="text-xs text-muted">Rp</span>
                <UInput
                  :model-value="angka(tarifPosisiDw(set, x))"
                  inputmode="numeric"
                  :title="`Tarif per shift untuk ${x}`"
                  class="w-28"
                  @change="ubahTarif(x, ($event.target as HTMLInputElement).value)"
                />
                <UButton
                  icon="i-lucide-x"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :aria-label="`Hapus ${x} dari ${d.n}`"
                  @click="tanyaHapusPosisi(d.k, x)"
                />
              </div>
            </div>
            <p
              v-else
              class="text-sm text-muted"
            >
              Belum ada — head divisi ini tidak bisa meminta DW sampai diisi.
            </p>
            <div class="mt-3 flex items-center gap-2">
              <UInput
                v-model="posBaru[d.k]"
                :placeholder="`Tambah posisi…`"
                class="flex-1"
                @keydown.enter.prevent="tambahPosisi(d.k)"
              />
              <UButton
                label="Tambah"
                color="neutral"
                variant="outline"
                size="sm"
                @click="tambahPosisi(d.k)"
              />
            </div>
          </div>
        </div>
      </AppPanel>

      <AppPanel
        title="Jam siap pakai"
        icon="i-lucide-clock"
        description="Tombol pintas di form ajuan. Jangan memakai 24:00 — server memvalidasi jam 00:00–23:59."
      >
        <div class="space-y-2">
          <div
            v-for="(j, i) in set.jam"
            :key="`${j.n}-${i}`"
            class="flex flex-wrap items-center gap-2"
          >
            <UInput
              :model-value="j.n"
              class="w-40"
              @change="ubahJam(i, 'n', ($event.target as HTMLInputElement).value)"
            />
            <UInput
              :model-value="j.m"
              type="time"
              class="w-32"
              @change="ubahJam(i, 'm', ($event.target as HTMLInputElement).value)"
            />
            <span class="text-muted">—</span>
            <UInput
              :model-value="j.s"
              type="time"
              class="w-32"
              @change="ubahJam(i, 's', ($event.target as HTMLInputElement).value)"
            />
            <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted num">{{ durasiJamDw(j.m, j.s) }} jam</span>
            <div class="flex-1" />
            <UButton
              label="Hapus"
              color="error"
              variant="ghost"
              size="sm"
              @click="hapusJam(i)"
            />
          </div>
        </div>
        <template #actions>
          <UButton
            label="Tambah"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            @click="tambahJam"
          />
        </template>
      </AppPanel>

      <AppPanel
        title="Shift dasar & shift panjang"
        icon="i-lucide-timer"
      >
        <p class="mb-3 text-sm text-muted">
          Tarif per posisi adalah harga <b>satu shift dasar</b>. Permintaan yang jam mulainya <b>di luar shift siap
            pakai</b> langsung diisikan jam selesainya sepanjang shift dasar — supaya tidak ada jam warisan shift
          sebelumnya yang tertinggal di kotak dan ditagih berbeda.
        </p>
        <div class="grid gap-3 sm:grid-cols-3">
          <UFormField label="Shift dasar (jam)">
            <UInput
              :model-value="String(set.jamDasar)"
              type="number"
              min="1"
              max="24"
              step="0.5"
              class="w-full"
              @change="ubahAngka('jamDasar', ($event.target as HTMLInputElement).value)"
            />
          </UFormField>
          <UFormField label="Tambahan shift panjang">
            <UInput
              :model-value="angka(tambahanPanjangDw(set))"
              inputmode="numeric"
              class="w-full"
              @change="ubahAngka('tambahanPanjang', ($event.target as HTMLInputElement).value)"
            />
          </UFormField>
          <UFormField label="Batas kewajaran (jam)">
            <UInput
              :model-value="String(set.jamBatas)"
              type="number"
              min="1"
              max="24"
              step="0.5"
              class="w-full"
              @change="ubahAngka('jamBatas', ($event.target as HTMLInputElement).value)"
            />
          </UFormField>
        </div>
        <p class="mt-3 text-sm text-muted">
          Shift yang <b>lebih panjang dari shift dasar</b> dihitung <b>tarif posisi + tambahan</b>, berapa pun
          panjangnya. Tambahannya sengaja tidak berhenti di batas kewajaran: kalau di atasnya tarifnya kembali
          polos, shift 13 jam jadi lebih murah daripada shift 7 jam.
        </p>
        <p class="mt-2 text-sm text-muted">
          <b>Batas kewajaran</b> tidak mengubah harga. Ia memunculkan peringatan di form permintaan bahwa shift
          sepanjang itu sebaiknya dipecah jadi dua shift dengan orang berbeda.
        </p>
      </AppPanel>

      <AppPanel
        title="Panduan jumlah DW per hari"
        icon="i-lucide-compass"
      >
        <p class="mb-3 text-sm text-muted">
          Panduan, <b>bukan penguncian</b>. Melebihinya hanya memunculkan satu pertanyaan yang bisa dilanjutkan.
          <b>Hari event</b> = hari yang ada acaranya di Marketing atau Event; <b>akhir pekan</b> = Sabtu & Minggu.
          Isi <b>0</b> untuk divisi yang tidak perlu dipandu.
        </p>
        <div class="overflow-x-auto">
          <table class="w-full min-w-80 text-sm">
            <thead>
              <tr>
                <th class="py-2 text-start text-[11px] font-bold uppercase tracking-wider text-muted">
                  Divisi
                </th>
                <th
                  v-for="k in KONTEKS"
                  :key="k"
                  class="py-2 text-end text-[11px] font-bold uppercase tracking-wider text-muted"
                >
                  {{ KONTEKS_LBL[k] }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="d in DIVISI"
                :key="d.k"
              >
                <td class="py-2 font-semibold">
                  {{ d.n }}
                </td>
                <td
                  v-for="k in KONTEKS"
                  :key="k"
                  class="py-2 text-end"
                >
                  <UInput
                    :model-value="String(set.kuota[d.k]?.[k] ?? 0)"
                    type="number"
                    min="0"
                    class="w-20"
                    @change="ubahKuota(d.k, k, ($event.target as HTMLInputElement).value)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </AppPanel>

      <AppPanel
        v-if="peran.admin"
        title="Mulai dari nol"
        icon="i-lucide-trash-2"
      >
        <p class="mb-2 text-sm text-muted">
          Menghapus <b>seluruh permintaan head</b> dan <b>seluruh pengajuan/penugasan DW</b> di server, supaya modul
          bisa dipakai ulang dari kosong. Tarif, kuota, jam siap pakai, posisi per divisi, dan daftar HRD <b>tidak</b>
          ikut terhapus.
        </p>
        <p class="mb-2 text-sm text-muted">
          <b>Talent pool tidak ikut kecuali dicentang</b> di kotak konfirmasi. Isinya nama, nomor HP, dan rekam jejak
          puluhan part-timer yang dikumpulkan berbulan-bulan — mengumpulkannya lagi berarti menelepon satu per satu.
        </p>
        <p class="mb-3 text-sm text-muted">
          Tidak ada pembatalan.
        </p>
        <UButton
          label="Kosongkan data modul"
          color="error"
          variant="soft"
          size="sm"
          @click="kosongOpen = true"
        />
      </AppPanel>
    </template>

    <ResponsiveSheet
      v-model:open="buangOpen"
      :title="buang ? `Hapus posisi &quot;${buang.pos}&quot; dari ${namaDivisiJadwal(buang.div)}?` : 'Hapus posisi?'"
    >
      <p class="text-sm">
        <template v-if="dipakaiPosisi">
          {{ dipakaiPosisi }} daily worker masih tercatat di posisi ini. Datanya TIDAK berubah — posisinya tetap
          terbaca (ditandai "lama") dan tetap dibayar menurut tarifnya.
        </template>
        <template v-else>
          Belum ada daily worker di posisi ini.
        </template>
        Yang berubah: posisi ini tidak bisa dipilih lagi untuk permintaan baru.
      </p>
      <template #footer>
        <UButton
          label="Ya, hapus posisi"
          color="error"
          @click="jalanHapusPosisi"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="buangOpen = false"
        />
      </template>
    </ResponsiveSheet>

    <ResponsiveSheet
      v-model:open="kosongOpen"
      title="Kosongkan data Daily Worker?"
    >
      <div class="space-y-3">
        <p class="text-sm text-muted">
          Seluruh <b>permintaan</b> dan <b>pengajuan/penugasan DW</b> — semua tanggal, semua divisi — akan dihapus
          dari server. Pengaturan modul tetap.
        </p>
        <label class="flex cursor-pointer items-start gap-2 text-sm">
          <input
            v-model="ikutPekerja"
            type="checkbox"
            class="mt-1"
          >
          <span>Hapus <b>talent pool</b> juga (nama, no HP, dan rekam jejak seluruh pekerja)</span>
        </label>
        <UFormField :label="`Ketik ${KOSONG_SANDI} untuk melanjutkan`">
          <UInput
            v-model="sandi"
            :placeholder="KOSONG_SANDI"
            autocomplete="off"
            class="w-full"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Kosongkan"
          color="error"
          @click="jalanKosongkan"
        />
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="kosongOpen = false"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
