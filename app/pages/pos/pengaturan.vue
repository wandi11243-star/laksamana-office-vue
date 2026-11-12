<!--
  POS › Pengaturan (Admin only). Five tabs like the old page: Menu, Pengguna,
  Pajak & Service, Printer, Cadangan & Pindah. Menu/pengguna/pajak write to
  the SHARED server setting (all cashier computers); printer stays on this
  computer only. HPP & Resep are never touched.
-->
<script setup lang="ts">
import type { MenuPos, UserPos } from '~/utils/pos'
import { rupiahPos } from '~/utils/pos'
import type { Envelope } from '~/composables/useApi'
import { apiErrorMessage, useApi } from '~/composables/useApi'
import { gabungMenuPos, mulaiPos, printerPos, pulihkanCadanganPos, simpanPrinterPos, unduhCadanganPos, usePosDb, usePosSetting } from '~/composables/usePos'

definePageMeta({ access: ['pos'] })

const toast = useToast()
const db = usePosDb()
const setting = usePosSetting()

onMounted(() => mulaiPos())

const tab = ref<'menu' | 'pengguna' | 'pajak' | 'printer' | 'cadangan'>('menu')
const simpanBersama = () => {
  const set = setting.value
  if (!set) return
  useApi()<Envelope<{ ts: number }>>('/kompas/pos/setting', {
    method: 'PUT', body: { users: set.users, menu: set.menu, menuBaru: set.menuBaru, sc: set.sc, pb1: set.pb1 },
  }).then((r) => {
    setting.value = { ...set, ts: r.data.ts }
    toast.add({ title: 'Tersimpan', description: 'Berlaku di semua komputer kasir.', color: 'success' })
  }).catch(e => toast.add({ title: 'Gagal menyimpan', description: apiErrorMessage(e), color: 'error' }))
}

// ── menu ──
const cari = ref('')
const menuSemua = computed(() => gabungMenuPos(setting.value))
const menuSaring = computed(() => menuSemua.value.filter(m => !cari.value || m.nama.toLowerCase().includes(cari.value.toLowerCase())))
const menuEdit = ref<{ id: string, nama: string, kat: string, jenis: string, harga: number, asal: string } | null>(null)

function bukaMenu(m?: MenuPos & { asal?: string }): void {
  menuEdit.value = m
    ? { id: m.id, nama: m.nama, kat: m.kat, jenis: m.jenis, harga: m.harga, asal: m.asal || 'hpp' }
    : { id: `pos-${Date.now().toString(36)}`, nama: '', kat: '', jenis: 'food', harga: 0, asal: 'pos' }
}
function simpanMenu(): void {
  const m = menuEdit.value
  const set = setting.value
  if (!m || !set || !m.nama || m.harga <= 0) {
    toast.add({ title: 'Belum lengkap', description: 'Isi nama dan harga yang benar.', color: 'warning' })
    return
  }
  if (m.asal === 'pos') {
    const i = set.menuBaru.findIndex(x => x.id === m.id)
    const baris = { id: m.id, nama: m.nama, kat: m.kat, jenis: m.jenis, harga: m.harga, kode: '' }
    if (i >= 0) set.menuBaru[i] = baris
    else set.menuBaru.push(baris)
  }
  else {
    set.menu[m.id] = { nama: m.nama, kat: m.kat, jenis: m.jenis, harga: m.harga }
  }
  setting.value = { ...set }
  menuEdit.value = null
  simpanBersama()
}

// ── pengguna ──
const userEdit = ref<{ id: string, nama: string, role: 'admin' | 'kasir', pin: string, aktif: boolean } | null>(null)
const menuBuka = computed({
  get: () => !!menuEdit.value,
  set: (v) => { if (!v) menuEdit.value = null },
})
const userBuka = computed({
  get: () => !!userEdit.value,
  set: (v) => { if (!v) userEdit.value = null },
})

function bukaUser(u?: UserPos): void {
  userEdit.value = u
    ? { id: u.id, nama: u.nama, role: u.role, pin: u.pin, aktif: u.aktif !== false }
    : { id: `u-${Date.now().toString(36)}`, nama: '', role: 'kasir', pin: '', aktif: true }
}
function simpanUser(): void {
  const u = userEdit.value
  const set = setting.value
  if (!u || !set || !u.nama || !/^[0-9]{4,6}$/.test(u.pin)) {
    toast.add({ title: 'Belum benar', description: 'Nama wajib diisi, PIN 4–6 angka.', color: 'warning' })
    return
  }
  if (set.users.some(x => x.id !== u.id && x.pin === u.pin)) {
    toast.add({ title: 'PIN dipakai', description: 'PIN tidak boleh sama dengan pengguna lain.', color: 'warning' })
    return
  }
  const i = set.users.findIndex(x => x.id === u.id)
  if (i >= 0) set.users[i] = { ...u }
  else set.users.push({ ...u })
  if (!set.users.some(x => x.role === 'admin' && x.aktif !== false)) {
    toast.add({ title: 'Ditolak', description: 'Harus tetap ada minimal satu Admin aktif.', color: 'error' })
    return
  }
  setting.value = { ...set }
  userEdit.value = null
  simpanBersama()
}

// ── pajak ──
const sc = computed({
  get: () => setting.value?.sc ?? 5,
  set: v => setting.value && (setting.value = { ...setting.value, sc: v }),
})
const pb1 = computed({
  get: () => setting.value?.pb1 ?? 10,
  set: v => setting.value && (setting.value = { ...setting.value, pb1: v }),
})

// ── printer (local only) ──
const printer = ref({ ...printerPos() })
watch(() => setting.value?.printer, (p) => {
  if (p) printer.value = { ...p }
})
function simpanPrinter(): void {
  simpanPrinterPos({ ...printer.value })
  toast.add({ title: 'Tersimpan', description: 'Setelan printer milik komputer ini saja.', color: 'success' })
}
function cetakTes(): void {
  const dok = window.open('', '_blank', 'width=320,height=400')
  if (!dok) return
  dok.document.write(`<html><body style="width:${printer.value.lebar}mm;font-family:monospace;"><pre>CETAK TES POS\nLaksamana Muda\n${'–'.repeat(printer.value.kolom)}\nKolom: ${printer.value.kolom}, salinan: ${printer.value.salinan}</pre><scr` + `ipt>onload=()=>{print();}</scr` + `ipt></body></html>`)
  dok.document.close()
}

// ── cadangan & pindah ──
const antre = computed(() => db.value.filter(o => o._naik === false).length)
const berkas = ref<File | null>(null)
const pulihInfo = ref('')

async function unduh(): Promise<void> {
  try {
    const r = await unduhCadanganPos()
    const blob = new Blob([JSON.stringify(r.data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pos-cadangan-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  catch (e) { toast.add({ title: 'Gagal mengunduh', description: apiErrorMessage(e), color: 'error' }) }
}
async function pulihkan(): Promise<void> {
  if (!berkas.value) return
  try {
    const isi = JSON.parse(await berkas.value.text())
    if (isi.format !== 'lm-pos-cadangan') throw new Error('Bukan berkas cadangan POS.')
    const r = await pulihkanCadanganPos(isi.orders || [], isi.setting || null)
    pulihInfo.value = `Masuk ${r.data.baru}, sudah ada ${r.data.ada}, ditolak ${r.data.tolak}.`
    void mulaiPosSatu()
  }
  catch (e) { toast.add({ title: 'Gagal memulihkan', description: e instanceof Error ? e.message : apiErrorMessage(e), color: 'error' }) }
}
async function mulaiPosSatu(): Promise<void> {
  const { sinkronPos } = await import('~/composables/usePos')
  await sinkronPos()
}

/** Clear this computer's browser copy (queued orders + printer settings). Server data is untouched. */
function bersihkan(): void {
  if (!confirm('Hapus salinan data POS di peramban komputer ini? Order & setelan di server tidak ikut terhapus. Setelan printer kembali ke bawaan.')) return
  try {
    localStorage.removeItem('lm_pos_v1')
    localStorage.removeItem('lm_pos_set_v1')
  }
  catch { /* private mode */ }
  window.location.reload()
}
</script>

<template>
  <AppPage
    title="Pengaturan POS"
    description="Menu, pengguna, dan pajak dipakai semua komputer kasir. Setelan printer milik komputer ini saja."
  >
    <AppPanel>
      <template #head>
        <AppSeg
          v-model="tab"
          :options="[
            { value: 'menu', label: 'Menu', icon: 'i-lucide-utensils' },
            { value: 'pengguna', label: 'Pengguna', icon: 'i-lucide-users' },
            { value: 'pajak', label: 'Pajak & Service', icon: 'i-lucide-percent' },
            { value: 'printer', label: 'Printer', icon: 'i-lucide-printer' },
            { value: 'cadangan', label: 'Cadangan & Pindah', icon: 'i-lucide-hard-drive-download' },
          ]"
          size="sm"
        />
      </template>

      <!-- menu -->
      <div v-if="tab === 'menu'">
        <div class="mb-3 flex flex-wrap gap-2">
          <UInput
            v-model="cari"
            placeholder="Cari menu…"
            icon="i-lucide-search"
            class="min-w-45 flex-1"
          />
          <UButton
            label="Tambah menu"
            icon="i-lucide-plus"
            color="neutral"
            class="bg-ink-900 text-white"
            @click="bukaMenu()"
          />
        </div>
        <UTable
          :columns="[
            { accessorKey: 'nama', header: 'Menu' },
            { accessorKey: 'kat', header: 'Kategori' },
            { accessorKey: 'harga', header: 'Harga', cell: ({ row }: any) => rupiahPos(row.original.harga) },
          ]"
          :data="menuSaring"
          class="hidden lg:block"
        />
        <AppList class="lg:hidden">
          <AppListRow
            v-for="m in menuSaring"
            :key="m.id"
            :title="m.nama"
            :description="`${m.kat} · ${rupiahPos(m.harga)}`"
            @click="bukaMenu(m)"
          />
        </AppList>
      </div>

      <!-- pengguna -->
      <div v-else-if="tab === 'pengguna'">
        <p class="mb-3 text-sm text-muted">
          Admin bisa membuka Laporan & Pengaturan; kasir hanya Kasir, Open Order, dan Riwayat. PIN 4–6 angka, tidak boleh sama.
        </p>
        <div class="mb-3">
          <UButton
            label="Tambah pengguna"
            icon="i-lucide-plus"
            color="neutral"
            class="bg-ink-900 text-white"
            @click="bukaUser()"
          />
        </div>
        <AppList>
          <AppListRow
            v-for="u in setting?.users || []"
            :key="u.id"
            :title="u.nama"
            :description="`${'•'.repeat(u.pin.length)} PIN`"
            @click="bukaUser(u)"
          >
            <template #trailing>
              <AppStatus :color="u.aktif === false ? 'neutral' : u.role === 'admin' ? 'vip' : 'success'">
                {{ u.aktif === false ? 'Nonaktif' : u.role === 'admin' ? 'Admin' : 'Aktif' }}
              </AppStatus>
            </template>
          </AppListRow>
        </AppList>
      </div>

      <!-- pajak -->
      <div v-else-if="tab === 'pajak'">
        <div class="grid max-w-140 gap-3 lg:grid-cols-2">
          <UFormField label="Service charge (%)">
            <UInput
              v-model.number="sc"
              type="number"
              min="0"
              max="50"
            />
          </UFormField>
          <UFormField label="PB1 (%)">
            <UInput
              v-model.number="pb1"
              type="number"
              min="0"
              max="50"
            />
          </UFormField>
        </div>
        <p class="mt-2 text-sm text-muted">
          Berlaku untuk order baru. Transaksi yang sudah dibayar tetap memakai persen saat ia dibuat.
        </p>
        <UButton
          label="Simpan"
          icon="i-lucide-check"
          color="neutral"
          class="mt-3 bg-ink-900 text-white"
          @click="simpanBersama()"
        />
      </div>

      <!-- printer -->
      <div v-else-if="tab === 'printer'">
        <div class="grid max-w-140 gap-3 lg:grid-cols-2">
          <UFormField label="Lebar kertas">
            <USelect
              v-model="printer.lebar"
              :items="[{ label: '80 mm', value: 80 }, { label: '58 mm', value: 58 }]"
            />
          </UFormField>
          <UFormField label="Mode cetak">
            <USelect
              v-model="printer.mode"
              :items="[{ label: 'Teks (cocok untuk semua driver)', value: 'teks' }, { label: 'Grafis + logo (butuh driver printer struk)', value: 'grafis' }]"
            />
          </UFormField>
          <UFormField label="Karakter per baris (mode teks)">
            <UInput
              v-model.number="printer.kolom"
              type="number"
              min="20"
              max="64"
            />
          </UFormField>
          <UFormField label="Jumlah salinan">
            <USelect
              v-model="printer.salinan"
              :items="[1, 2, 3].map(n => ({ label: String(n), value: n }))"
            />
          </UFormField>
          <UCheckbox
            v-model="printer.otomatis"
            label="Cetak otomatis sesudah pembayaran diterapkan"
          />
          <UCheckbox
            v-model="printer.logo"
            label="Cetak logo di kepala struk (mode grafis)"
          />
          <UFormField
            label="Tulisan di kaki struk"
            class="lg:col-span-2"
          >
            <UInput
              v-model="printer.kaki"
              maxlength="80"
            />
          </UFormField>
        </div>
        <div class="mt-3 flex gap-2">
          <UButton
            label="Simpan"
            icon="i-lucide-check"
            color="neutral"
            class="bg-ink-900 text-white"
            @click="simpanPrinter()"
          />
          <UButton
            label="Cetak tes"
            icon="i-lucide-printer"
            color="neutral"
            variant="soft"
            @click="cetakTes()"
          />
        </div>
        <AppPanel
          bersarang
          title="Memakai printer kasir LAN"
          icon="i-lucide-info"
          class="mt-4"
        >
          <ol class="list-decimal space-y-1 pl-5 text-sm">
            <li>Pasang printernya sekali di Windows lewat alamat IP (port 9100) dengan driver printernya atau Generic / Text Only.</li>
            <li>Pilih kertas roll 80 mm (atau 58 mm), lalu cetak test page dari Windows.</li>
            <li>Tekan Cetak tes di atas. Di dialog Chrome pilih printer kasir itu, Margins: None, matikan Headers and footers.</li>
            <li>Untuk cetak tanpa dialog: jadikan printer kasir default, buka POS dari shortcut Chrome dengan --kiosk-printing, lalu nyalakan cetak otomatis.</li>
          </ol>
          <p class="mt-2 text-sm text-muted">
            Peramban tidak bisa mengirim langsung ke alamat IP printer; ia selalu lewat printer yang terpasang di Windows.
          </p>
        </AppPanel>
      </div>

      <!-- cadangan -->
      <div v-else>
        <p class="mb-2 text-sm">
          <b>1. Unduh cadangan POS.</b> Berisi seluruh order dan setelan bersama dari server ini. Tidak berisi data modul lain.
        </p>
        <p
          v-if="antre"
          class="mb-2 text-sm text-error"
        >
          Masih ada {{ antre }} order di komputer ini yang belum terkirim — tunggu sampai berbunyi Tersinkron, kalau tidak order itu tidak ikut di cadangan.
        </p>
        <UButton
          label="Unduh cadangan (.json)"
          icon="i-lucide-download"
          color="neutral"
          @click="unduh()"
        />
        <p class="mt-4 mb-2 text-sm">
          <b>2. Pulihkan di server baru.</b> Hanya menambah: order yang id-nya sudah ada dilewati, setelan dipasang bila server tujuan belum punya.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <UInput
            type="file"
            accept="application/json"
            @change="(e: Event) => berkas = (e.target as HTMLInputElement).files?.[0] || null"
          />
          <UButton
            label="Pulihkan"
            icon="i-lucide-upload"
            color="neutral"
            :disabled="!berkas"
            @click="pulihkan()"
          />
        </div>
        <p
          v-if="pulihInfo"
          class="mt-2 text-sm text-muted"
        >
          {{ pulihInfo }}
        </p>
        <p class="mt-4 mb-2 text-sm">
          <b>3. Bersihkan salinan lokal di domain lama.</b> Sesudah domain baru dipakai, tekan ini di tiap komputer kasir pada alamat lama supaya salinan order &amp; setelan di peramban tidak tertinggal. Data di server tidak ikut terhapus. Tombol aktif bila tidak ada order yang belum terkirim.
        </p>
        <UButton
          label="Bersihkan data POS di komputer ini"
          icon="i-lucide-brush-cleaning"
          color="neutral"
          variant="soft"
          :disabled="!!antre"
          @click="bersihkan()"
        />
      </div>
    </AppPanel>

    <!-- menu editor -->
    <ResponsiveSheet
      v-model:open="menuBuka"
      title="Menu"
    >
      <div
        v-if="menuEdit"
        class="grid gap-3"
      >
        <UFormField label="Nama">
          <UInput v-model="menuEdit.nama" />
        </UFormField>
        <UFormField label="Kategori">
          <UInput v-model="menuEdit.kat" />
        </UFormField>
        <UFormField label="Kelompok">
          <USelect
            v-model="menuEdit.jenis"
            :items="[{ label: 'FOOD', value: 'food' }, { label: 'BEVERAGES', value: 'drink' }, { label: 'OTHERS', value: 'other' }]"
          />
        </UFormField>
        <UFormField label="Harga">
          <UInput
            v-model.number="menuEdit.harga"
            type="number"
            min="0"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="menuBuka = false"
        />
        <UButton
          label="Simpan"
          color="neutral"
          class="bg-ink-900 text-white"
          @click="simpanMenu()"
        />
      </template>
    </ResponsiveSheet>

    <!-- user editor -->
    <ResponsiveSheet
      v-model:open="userBuka"
      title="Pengguna"
    >
      <div
        v-if="userEdit"
        class="grid gap-3"
      >
        <UFormField label="Nama">
          <UInput v-model="userEdit.nama" />
        </UFormField>
        <UFormField label="Peran">
          <USelect
            v-model="userEdit.role"
            :items="[{ label: 'Admin', value: 'admin' }, { label: 'Kasir', value: 'kasir' }]"
          />
        </UFormField>
        <UFormField label="PIN (4–6 angka)">
          <UInput
            v-model="userEdit.pin"
            inputmode="numeric"
            maxlength="6"
          />
        </UFormField>
        <UCheckbox
          v-model="userEdit.aktif"
          label="Aktif"
        />
      </div>
      <template #footer>
        <UButton
          label="Batal"
          color="neutral"
          variant="ghost"
          @click="userBuka = false"
        />
        <UButton
          label="Simpan"
          color="neutral"
          class="bg-ink-900 text-white"
          @click="simpanUser()"
        />
      </template>
    </ResponsiveSheet>
  </AppPage>
</template>
