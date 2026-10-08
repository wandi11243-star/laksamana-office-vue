<!--
  Buat / Edit Event Kunjungan KOL & Medpar (old openVisitForm + saveVisit +
  delVisit + dmInvitee, deploy/konten/index.html:3501-3700; konten.md D.14).

  - "Event / Campaign" required; default date = today + 3 in LOCAL time (the
    old one used UTC, a day short before 07:00 WIB), time 13:00;
  - invitee picker filtered by type (with counts) and by a niche actually in
    use; the ticked ids live outside the list, so changing a filter never
    drops a tick (the old _visitInvSel);
  - `kolId` = first invitee is still written for old readers;
  - edit mode: one DM row per invitee — WhatsApp opens with the invitation
    text, Instagram/TikTok copy it and open the profile.
-->
<script setup lang="ts">
import type { KolKonten, VisitPenuh } from '~/utils/promosi-konten'
import { KOL_TYPES, VISIT_LOCATIONS, kolCats, kolType, nicheKol, nomorWaKol, pesanUndangan, tanpaAt, undanganVisit } from '~/utils/promosi-konten'
import { ROLES_KONTEN, VISIT_STATUS } from '~/utils/konten'
import { fTgl, hariIni, tambahHari } from '~/utils/format'

const props = defineProps<{ visit?: VisitPenuh | null }>()
const open = defineModel<boolean>('open', { default: false })

const { data: st } = useStateKonten()
const { can } = useAksesKonten()
const brandPilih = useBrandKonten()
const toast = useToast()

const KOSONG = '__none__'
const f = reactive({ title: '', date: '', time: '13:00', location: VISIT_LOCATIONS[0]!, brand: '', desc: '', pic: KOSONG, status: 'planned', objective: '' })
const pilih = ref<string[]>([])
const saring = reactive({ type: '', cat: '' })
const sibuk = ref(false)
const hapusBuka = ref(false)
const salah = ref(false)

watch(open, (o) => {
  if (!o) return
  const v = props.visit
  salah.value = false
  Object.assign(f, {
    title: v?.title ?? '', date: v ? (v.date ?? '') : tambahHari(hariIni(), 3), time: v?.time || '13:00',
    location: v?.location || VISIT_LOCATIONS[0], brand: v?.brand || (brandPilih.value !== 'all' ? brandPilih.value : st.value.brands[0]?.id ?? ''),
    desc: v?.desc || v?.note || '', pic: v?.pic || KOSONG, status: v?.status || 'planned', objective: v?.objective ?? '',
  })
  pilih.value = undanganVisit(v).slice()
  Object.assign(saring, { type: '', cat: '' })
}, { immediate: true })

const kols = computed(() => st.value.kols)
const opsiLokasi = computed(() => (f.location && !VISIT_LOCATIONS.includes(f.location) ? [...VISIT_LOCATIONS, f.location] : VISIT_LOCATIONS))
const opsiBrand = computed(() => st.value.brands.map(b => ({ value: b.id, label: b.name })))
const opsiStatus = Object.entries(VISIT_STATUS).map(([value, s]) => ({ value, label: s.label }))
const opsiPic = computed(() => [{ value: KOSONG, label: '- Belum ditentukan -' }, ...st.value.users.map(u => ({
  value: u.id, label: `${u.name} (${(u.roles ?? []).map(r => (ROLES_KONTEN as Record<string, { short: string }>)[r]?.short ?? r).join('+')})`,
}))])
const opsiTipe = computed(() => [{ value: '', label: 'Semua', badge: kols.value.length }, ...KOL_TYPES.map(t => ({ value: t, label: t, badge: kols.value.filter(k => kolType(k) === t).length }))])
const opsiNiche = computed(() => [{ value: '__semua', label: 'Semua kategori konten / niche' }, ...nicheKol(kols.value).map(x => ({ value: x.c, label: `${x.c} (${x.n})` }))])
const cat = computed({
  get: () => saring.cat || '__semua',
  set: (v: string) => {
    saring.cat = v === '__semua' ? '' : v
  },
})
const daftar = computed(() => kols.value.filter(k => (!saring.type || kolType(k) === saring.type) && (!saring.cat || kolCats(k).includes(saring.cat))))
const namaKol = (id: string) => kols.value.find(k => k.id === id)?.name ?? ''
const centang = (id: string, on: boolean | 'indeterminate') => {
  pilih.value = on === true ? [...new Set([...pilih.value, id])] : pilih.value.filter(x => x !== id)
}
const diundang = computed(() => (props.visit ? undanganVisit(props.visit).map(id => kols.value.find(k => k.id === id)).filter(Boolean) as KolKonten[] : []))

async function dm(k: KolKonten, lewat: 'wa' | 'ig' | 'tt') {
  const v = props.visit
  if (!v) return
  const msg = pesanUndangan(v, k.name ?? '', v.date ? fTgl(v.date) : '-')
  if (lewat === 'wa') {
    const d = nomorWaKol(k.whatsapp)
    if (!d) return toast.add({ title: 'Nomor WhatsApp kosong', color: 'error' })
    window.open(`https://wa.me/${d}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
    return
  }
  // IG & TikTok cannot prefill a message: copy the template, then open the profile
  const u = tanpaAt(lewat === 'ig' ? k.instagram : k.tiktok)
  if (!u) return toast.add({ title: `Username ${lewat === 'ig' ? 'Instagram' : 'TikTok'} kosong`, color: 'error' })
  await navigator.clipboard?.writeText(msg).catch(() => {})
  toast.add({ title: `Template disalin - tinggal paste di DM ${lewat === 'ig' ? 'Instagram' : 'TikTok'}`, color: 'success' })
  window.open(lewat === 'ig' ? `https://ig.me/m/${u}` : `https://www.tiktok.com/@${u}`, '_blank', 'noopener')
}

async function simpan() {
  const title = f.title.trim()
  if (!title) {
    salah.value = true
    return
  }
  const invitees = pilih.value.slice()
  const data = {
    title, brand: f.brand, date: f.date, time: f.time, location: f.location, desc: f.desc.trim(), invitees, kolId: invitees[0] || '',
    pic: f.pic === KOSONG ? '' : f.pic, status: f.status || 'planned', objective: f.objective.trim(), note: f.desc.trim(),
  }
  const v = props.visit
  sibuk.value = true
  const ok = v
    ? await kontenSimpan(() => ubahKonten<VisitPenuh>('visits', v.id, { ...v, ...data }, v.updatedAt), 'Event kunjungan diperbarui', { action: 'mengubah event kunjungan', target: title })
    : await kontenSimpan(() => buatKonten<VisitPenuh>('visits', { createdAt: Date.now(), ...data }), 'Event kunjungan dibuat - cek di Kalender', { action: 'membuat event kunjungan', target: title })
  sibuk.value = false
  if (ok) open.value = false
}

async function hapus() {
  const v = props.visit
  if (!v) return
  sibuk.value = true
  const ok = await kontenSimpan(() => hapusKonten('visits', v.id, v.updatedAt), 'Rencana dihapus')
  sibuk.value = false
  if (!ok) return
  hapusBuka.value = false
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="visit ? 'Edit event kunjungan' : 'Buat event kunjungan'"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Event / Campaign"
        required
        class="sm:col-span-2"
        :error="salah ? 'Event / Campaign wajib diisi' : false"
      >
        <UInput
          v-model="f.title"
          placeholder="mis. Grand Launching Menu Baru / Campaign Ramadan"
          class="w-full"
          @update:model-value="salah = false"
        />
      </UFormField>
      <UFormField label="Tanggal event">
        <UInput
          v-model="f.date"
          type="date"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Jam">
        <UInput
          v-model="f.time"
          type="time"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Lokasi">
        <USelect
          v-model="f.location"
          :items="opsiLokasi"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Brand">
        <USelect
          v-model="f.brand"
          :items="opsiBrand"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Deskripsi event"
        class="sm:col-span-2"
      >
        <UTextarea
          v-model="f.desc"
          placeholder="Rangkaian acara, dress code, brief, deliverables…"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Undang KOL & Media Partner"
        help="Tekan Media Partner untuk langsung melihat daftar medpar, atau pilih satu niche. Centangan yang sudah dibuat tetap tersimpan saat penyaringnya diganti."
        class="sm:col-span-2"
      >
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <AppSeg
            v-model="saring.type"
            :options="opsiTipe"
            size="sm"
          />
          <USelect
            v-model="cat"
            :items="opsiNiche"
            class="w-full sm:w-64"
          />
        </div>
        <div class="max-h-64 space-y-1 overflow-auto rounded-lg border border-default p-2">
          <p
            v-if="!daftar.length"
            class="p-1 text-xs text-muted"
          >
            {{ kols.length
              ? `Tidak ada yang cocok dengan penyaring ini${saring.cat ? ` - belum ada ${saring.type || 'partner'} berkategori ${saring.cat}` : ''}. Longgarkan penyaringnya, atau tambahkan datanya di Database KOL.`
              : 'Belum ada KOL / Medpar di database.' }}
          </p>
          <div
            v-for="k in daftar"
            :key="k.id"
            class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted"
          >
            <UCheckbox
              :model-value="pilih.includes(k.id)"
              :aria-label="k.name"
              @update:model-value="centang(k.id, $event)"
            />
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold">{{ k.name }}</span>
              <span
                v-if="kolCats(k).length"
                class="block text-[11px] text-muted"
              >{{ kolCats(k).join(' - ') }}</span>
            </span>
            <UBadge
              :label="kolType(k)"
              color="neutral"
              variant="soft"
              size="sm"
            />
          </div>
        </div>
        <p class="mt-1.5 text-xs text-muted">
          {{ pilih.length ? `${pilih.length} dipilih: ${pilih.map(namaKol).join(', ')}` : 'Belum ada yang dicentang.' }}
        </p>
      </UFormField>
      <UFormField label="PIC pendamping">
        <USelect
          v-model="f.pic"
          :items="opsiPic"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Status kehadiran">
        <USelect
          v-model="f.status"
          :items="opsiStatus"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Objective / deliverables"
        class="sm:col-span-2"
      >
        <UInput
          v-model="f.objective"
          placeholder="mis. 1 Reels + 3 Story per undangan"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-if="visit"
        label="Direct message undangan (template otomatis)"
        help="Sekali klik - template acara (nama, tanggal, jam, lokasi, deskripsi) langsung terisi. WhatsApp otomatis; IG & TikTok template disalin ke clipboard."
        class="sm:col-span-2"
      >
        <p
          v-if="!diundang.length"
          class="text-xs text-muted"
        >
          Belum ada undangan yang dicentang.
        </p>
        <div
          v-for="k in diundang"
          :key="k.id"
          class="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-default px-3 py-2"
        >
          <span class="min-w-0 flex-1 text-sm font-semibold">{{ k.name }} <UBadge
            :label="kolType(k)"
            color="neutral"
            variant="soft"
            size="sm"
          /></span>
          <UButton
            label="WhatsApp"
            icon="i-lucide-message-circle"
            size="xs"
            color="success"
            variant="soft"
            :disabled="!k.whatsapp"
            @click="dm(k, 'wa')"
          />
          <UButton
            label="Instagram"
            icon="i-lucide-instagram"
            size="xs"
            color="neutral"
            variant="soft"
            :disabled="!k.instagram"
            @click="dm(k, 'ig')"
          />
          <UButton
            label="TikTok"
            icon="i-lucide-music"
            size="xs"
            color="neutral"
            variant="soft"
            :disabled="!k.tiktok"
            @click="dm(k, 'tt')"
          />
        </div>
      </UFormField>
    </div>
    <template #footer>
      <UButton
        v-if="can('kol')"
        :label="visit ? 'Simpan perubahan' : 'Simpan event'"
        :loading="sibuk"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton
        v-if="visit && can('kol')"
        label="Hapus"
        color="error"
        variant="outline"
        @click="hapusBuka = true"
      />
    </template>
  </ResponsiveSheet>
  <KontenKonfirmasi
    v-model:open="hapusBuka"
    title="Hapus rencana kunjungan ini?"
    confirm-label="Hapus"
    color="error"
    :loading="sibuk"
    @konfirmasi="hapus"
  />
</template>
