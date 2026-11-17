<!--
  The reservation detail header of the old `openDetail()` modal
  (deploy/reservasi/index.html:7829-7899): status + DP badges, the info grid
  (phone, date, time, pax, table, category, source, PIC, guest type), the DP
  total with the receipt slot, notes and menu requests.

  Shared by the dashboard quick-action sheet (with day-of actions below) and
  the riwayat archive sheet (read-only + edit). Day-of actions stay on the
  callers: an archived row is never "Tandai datang".
-->
<script setup lang="ts">
import type { Reservasi } from '~/composables/useReservasi'
import { getFile, getReservation, patchReservation, postAudit, versiReservasi } from '~/composables/useReservasi'
import { apiErrorMessage } from '~/composables/useApi'
import { tanganiKonflik } from '~/utils/versi'
import { arrivalsOf, arrivedPax, fmtMenit, isSeated, remainingPax } from '~/utils/kunci-meja'
import {
  buktiAdalahGambar, dpTotal, dpsTampilan, normPhone, rekeningDp, tampilPhone,
} from '~/utils/dp-reservasi'
import { rupiah, tglPanjang, tglPendek } from '~/utils/format'
import { STATUS_IKON, STATUS_WARNA } from '~/utils/status-reservasi'
import type { ProfilTamu } from '~/utils/riwayat'
import { durasiDuduk, keterlambatanDatang } from '~/utils/riwayat'

const props = withDefaults(defineProps<{
  r: Reservasi
  profil: ProfilTamu | null
  bolehMintaKwitansi?: boolean
  bolehLangsungKwitansi?: boolean
  /** May arrival waves be removed here (old per-wave undo). The caller gates it by role. */
  bolehUbahGelombang?: boolean
  /** The dashboard caller opens its existing DP instalment sheet. Shown to
   *  anyone who may edit the booking (old `canEdit`); the sheet itself still
   *  gates who may save. */
  bolehTambahDp?: boolean
  /** Status is rendered beside the record name by the dashboard detail header. */
  showReservationStatus?: boolean
}>(), {
  bolehMintaKwitansi: false,
  bolehLangsungKwitansi: false,
  bolehUbahGelombang: false,
  bolehTambahDp: false,
  showReservationStatus: true,
})

const emit = defineEmits<{
  /** The row changed (or conflicted): the caller reloads its list. */
  berubah: []
  /** Open the caller's existing DP instalment flow. */
  tambahDp: []
}>()

const toast = useToast()

/** Money in: the instalment total wins over the flat field, like the table's DP cell. */
const dpNominal = computed(() => dpTotal(props.r) || props.r.dpAmount || 0)
const duduk = computed(() => isSeated(props.r))
/** Instalments as displayed (a flat legacy deposit reads as DP pertama). */
const cicilan = computed(() => dpsTampilan(props.r))
/** Arrival waves, normalised for display (old rows stamp `ts`, the type knows `at`). */
const capWaktu = (ts?: number | null) => (ts
  ? new Date(ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—')
const gelombang = computed(() => arrivalsOf(props.r).map(a => ({
  pax: Number(a.pax) || 0,
  oleh: typeof a.by === 'string' ? a.by : '',
  waktu: capWaktu(typeof (a.ts ?? a.at) === 'number' ? (a.ts ?? a.at) as number : null),
})))
const durasi = computed(() => durasiDuduk(props.r))
/** Minutes past the booking time: positive = late, negative = early. */
const telat = computed(() => keterlambatanDatang(props.r))
/** Deep link to Dana Masuk pre-filtered to this booking (name/HP search, whole table). */
const urlDanaMasuk = computed(() => `/reservasi/finance?q=${encodeURIComponent(props.r.phone || props.r.name)}`)

/** Remove one arrival wave (old per-wave undo): a mistyped count is corrected, not stacked. */
async function hapusGelombang(idx: number) {
  const r = props.r
  if (!r || !props.bolehUbahGelombang) return
  const target = arrivalsOf(r)[idx]
  if (!target) return
  const paxHapus = Number(target.pax) || 0
  const total = arrivalsOf(r).filter((_, i) => i !== idx).reduce((a, x) => a + (Number(x.pax) || 0), 0)
  if (!window.confirm(`Hapus catatan ${paxHapus} orang masuk? Total masuk jadi ${total} dari ${r.pax} pax.`)) return
  try {
    // Fresh row first: drop by position only when nothing changed in between.
    const env = await getReservation(r.id)
    const segar = env.data
    if (arrivalsOf(segar).length !== arrivalsOf(r).length) {
      toast.add({ title: 'Catatan berubah — daftar dimuat ulang, coba hapus lagi', color: 'warning' })
      emit('berubah')
      return
    }
    const gelombangBaru = arrivalsOf(segar).filter((_, i) => i !== idx)
    const totalBaru = gelombangBaru.reduce((a, x) => a + (Number(x.pax) || 0), 0)
    await patchReservation(segar.id, {
      arrivals: gelombangBaru,
      actualPax: totalBaru,
    }, versiReservasi(env, segar) ?? segar.updatedAt)
    try {
      await postAudit({
        action: 'Hapus Gelombang',
        detail: `${segar.name}: hapus ${paxHapus} orang masuk — total ${totalBaru}/${segar.pax}`,
        res: segar.id,
      })
    }
    catch {
      // The removal itself is saved; a missing audit line must not be
      // reported as a failure of the write.
    }
    toast.add({ title: `Catatan ${paxHapus} orang dihapus`, color: 'success' })
    emit('berubah')
  }
  catch (e) {
    if (!(await tanganiKonflik(e, async () => emit('berubah')))) {
      toast.add({ title: apiErrorMessage(e), color: 'error' })
    }
  }
}
const badgeTf = (s: string): 'success' | 'error' | 'warning' => (s === 'verified' ? 'success' : s === 'rejected' ? 'error' : 'warning')
const teksTf = (s: string) => (s === 'verified' ? 'Terverifikasi' : s === 'rejected' ? 'Ditolak' : 'Belum diverifikasi')

// --- proof viewer (a stored file as a data URI: inline as-is, `@f:` from the file endpoint)
const buktiBuka = ref(false)
const buktiJudul = ref('')
const buktiData = ref('')
const buktiPdf = ref(false)
const buktiMemuat = ref(false)
const buktiGalat = ref('')

async function lihatBukti(dataRef: string | undefined, nama: string | undefined) {
  buktiBuka.value = true
  buktiJudul.value = nama || 'Bukti'
  buktiData.value = ''
  buktiPdf.value = false
  buktiMemuat.value = true
  buktiGalat.value = ''
  try {
    const ref = dataRef ?? ''
    const data = ref.startsWith('@f:') ? (await getFile(ref.replace(/^@f:/, ''))).data.data : ref
    if (!data) throw new Error('Bukti tidak ditemukan di database')
    buktiPdf.value = !buktiAdalahGambar(data, nama)
    buktiData.value = data
  }
  catch (e) {
    buktiGalat.value = apiErrorMessage(e)
  }
  finally {
    buktiMemuat.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-1.5">
      <AppStatus
        v-if="showReservationStatus"
        :color="STATUS_WARNA[r.status] ?? 'neutral'"
        :icon="STATUS_IKON[r.status]"
      >
        {{ r.status }}
      </AppStatus>
      <AppStatus :color="r.dpStatus === 'Sudah' ? 'success' : 'gold'">
        {{ r.dpStatus === 'Sudah' ? (dpNominal ? rupiah(dpNominal) : 'Sudah DP') : 'Belum DP' }}
      </AppStatus>
      <AppStatus
        v-if="r.sharing"
        color="vip"
        icon="i-lucide-handshake"
        size="sm"
      >
        Sharing
      </AppStatus>
      <AppStatus
        v-if="r.vip"
        color="vip"
        icon="i-lucide-crown"
        size="sm"
      >
        VIP
      </AppStatus>
      <AppStatus
        v-if="profil?.member"
        size="sm"
      >
        Member{{ profil?.memberNo ? ` ${profil.memberNo}` : '' }}
      </AppStatus>
    </div>

    <div class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      <div>
        <p class="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <UIcon
            name="i-lucide-phone"
            class="size-3.5"
          />No. HP
        </p>
        <a
          :href="`https://wa.me/${normPhone(r.phone)}`"
          target="_blank"
          rel="noopener"
          class="text-sm font-semibold text-primary-700 underline"
        >{{ tampilPhone(r.phone) || '—' }}</a>
      </div>
      <div>
        <p class="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <UIcon
            name="i-lucide-calendar"
            class="size-3.5"
          />Tanggal
        </p>
        <p class="text-sm text-default">
          {{ tglPanjang(r.date) }}
        </p>
      </div>
      <div>
        <p class="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <UIcon
            name="i-lucide-clock"
            class="size-3.5"
          />Jam
        </p>
        <p class="text-sm text-default">
          {{ r.time }} WIB
        </p>
      </div>
      <div>
        <p class="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <UIcon
            name="i-lucide-users"
            class="size-3.5"
          />Pax
        </p>
        <p class="text-sm text-default">
          {{ r.pax }} orang
          <span
            v-if="duduk"
            class="text-muted"
          > · masuk {{ arrivedPax(r) }}<template v-if="remainingPax(r)"> · sisa {{ remainingPax(r) }}</template></span>
        </p>
      </div>
      <div>
        <p class="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <UIcon
            name="i-lucide-armchair"
            class="size-3.5"
          />Meja
        </p>
        <p class="text-sm text-default">
          {{ r.table || '—' }}
        </p>
      </div>
      <div>
        <p class="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <UIcon
            name="i-lucide-tag"
            class="size-3.5"
          />Jenis reservasi
        </p>
        <p class="text-sm text-default">
          <AppStatus
            v-if="r.category"
            color="gold"
            size="sm"
          >
            {{ r.category }}
          </AppStatus>
          <span v-else>—</span>
        </p>
      </div>
      <div>
        <p class="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <UIcon
            name="i-lucide-megaphone"
            class="size-3.5"
          />Sumber
        </p>
        <p class="text-sm text-default">
          {{ r.source || '—' }}
        </p>
      </div>
      <div>
        <p class="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <UIcon
            name="i-lucide-user-round"
            class="size-3.5"
          />PIC
        </p>
        <p class="text-sm text-default">
          {{ r.picName || '—' }}<span v-if="r.picType === 'Marketing'"> (Marketing)</span>
        </p>
      </div>
      <div>
        <p class="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <UIcon
            name="i-lucide-history"
            class="size-3.5"
          />Tipe tamu
        </p>
        <p
          v-if="profil"
          class="text-sm text-default"
        >
          {{ profil.tipe }}, {{ profil.kunjungan }}× kunjungan<span v-if="profil.kunjunganTerakhir">, terakhir {{ tglPendek(profil.kunjunganTerakhir) }}</span>
        </p>
        <p
          v-else
          class="text-sm text-default"
        >
          —
        </p>
      </div>
    </div>

    <div
      v-if="r.foodReq || r.drinkReq"
    >
      <AppSectionTitle
        title="Menu request"
        icon="i-lucide-utensils"
      />
      <div class="grid gap-3 sm:grid-cols-2">
        <div v-if="r.foodReq">
          <p class="text-xs font-semibold text-muted">
            Makanan
          </p>
          <p class="text-sm text-default">
            {{ r.foodReq }}
          </p>
        </div>
        <div v-if="r.drinkReq">
          <p class="text-xs font-semibold text-muted">
            Minuman
          </p>
          <p class="text-sm text-default">
            {{ r.drinkReq }}
          </p>
        </div>
      </div>
    </div>

    <div>
      <AppSectionTitle
        title="Down payment"
        icon="i-lucide-wallet"
      />
      <div class="rounded-lg border border-default p-3 text-sm">
        <div class="flex items-center justify-between gap-2">
          <span class="text-muted">Total DP masuk</span>
          <b class="text-highlighted">{{ dpNominal ? rupiah(dpNominal) : 'Belum DP' }}</b>
        </div>
        <p
          v-if="dpNominal"
          class="mt-1 text-xs text-muted"
        >
          {{ rekeningDp(r).join(' · ') || 'rekening belum diisi' }}<template v-if="(r.dps?.length ?? 0) > 1">
            · dicicil {{ r.dps.length }}×
          </template>
        </p>
        <UButton
          v-if="bolehTambahDp"
          label="Tambah bukti TF DP"
          icon="i-lucide-plus"
          color="neutral"
          variant="outline"
          size="sm"
          class="mt-2 min-h-11"
          @click="emit('tambahDp')"
        />
        <div
          v-if="dpNominal"
          class="mt-2"
        >
          <KwitansiSlot
            :res-id="r.id"
            :reservasi="r"
            :boleh-minta="bolehMintaKwitansi"
            :boleh-langsung="bolehLangsungKwitansi"
          />
        </div>
        <div
          v-if="cicilan.length"
          class="mt-2 space-y-2"
        >
          <div
            v-for="(p, i) in cicilan"
            :key="p.id || i"
            class="rounded-lg bg-muted p-2.5 text-sm"
          >
            <p class="flex flex-wrap items-center gap-1.5">
              <b class="text-highlighted">DP {{ i + 1 }} · {{ rupiah(Number(p.amount) || 0) }}</b>
              <AppStatus
                :color="badgeTf(p.tfStatus)"
                size="sm"
              >
                {{ teksTf(p.tfStatus) }}
              </AppStatus>
            </p>
            <p class="mt-0.5 text-xs text-muted">
              {{ p.method || '—' }}{{ p.tfName ? ` · a.n. ${p.tfName}` : '' }}{{ p.tfDate ? ` · ${p.tfDate}${p.tfTime ? ` ${p.tfTime}` : ''}` : '' }} · dicatat {{ p.by || '—' }}{{ p.at ? `, ${capWaktu(p.at)}` : '' }}
            </p>
            <div class="mt-1.5">
              <UButton
                v-if="p.proofData"
                label="Lihat bukti"
                icon="i-lucide-image"
                color="neutral"
                variant="ghost"
                size="xs"
                loading-auto
                @click="lihatBukti(p.proofData, p.proofName)"
              />
              <span
                v-else
                class="text-xs text-muted"
              >tanpa bukti</span>
            </div>
          </div>
          <p class="text-xs text-muted">
            Verifikasi dan koreksi transfer di halaman Dana Masuk (DP).
          </p>
          <UButton
            label="Cek di Dana Masuk"
            icon="i-lucide-arrow-up-right"
            color="neutral"
            variant="ghost"
            size="xs"
            :to="urlDanaMasuk"
          />
        </div>
      </div>
    </div>

    <div
      v-if="r.notes"
      class="rounded-lg border border-default p-3 text-sm"
    >
      <p class="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
        Catatan khusus
      </p>
      <p class="whitespace-pre-wrap text-default">
        {{ r.notes }}
      </p>
    </div>
    <div
      v-if="r.docReqData"
      class="rounded-lg border border-default p-3 text-sm"
    >
      <p class="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
        Dokumen special request
      </p>
      <UButton
        :label="`Lihat (${r.docReqName || 'dokumen'})`"
        icon="i-lucide-file-text"
        color="neutral"
        variant="ghost"
        size="xs"
        loading-auto
        @click="lihatBukti(r.docReqData, r.docReqName)"
      />
    </div>

    <div v-if="gelombang.length">
      <AppSectionTitle
        title="Gelombang kedatangan"
        icon="i-lucide-users"
      />
      <div class="space-y-1.5 text-sm">
        <div
          v-for="(g, i) in gelombang"
          :key="i"
          class="flex items-center justify-between gap-2 border-b border-default pb-1.5"
        >
          <span><b class="text-highlighted">{{ g.pax }} orang</b> masuk <span class="text-xs text-muted">{{ g.waktu }}{{ g.oleh ? ` · ${g.oleh}` : '' }}</span></span>
          <UButton
            v-if="bolehUbahGelombang"
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            title="Hapus catatan gelombang ini"
            :aria-label="`Hapus catatan ${g.pax} orang masuk`"
            loading-auto
            @click="hapusGelombang(i)"
          />
        </div>
        <p class="text-xs text-muted">
          Total masuk: <b class="text-highlighted">{{ arrivedPax(r) }}</b> dari {{ r.pax }} pax<template v-if="remainingPax(r)">
            — sisa <b class="text-highlighted">{{ remainingPax(r) }}</b> orang
          </template><template v-else>
            — lengkap
          </template>
        </p>
      </div>
    </div>

    <div v-if="(r.followups ?? []).length">
      <AppSectionTitle
        title="Riwayat follow up"
        icon="i-lucide-phone"
      />
      <div class="space-y-1.5 text-sm">
        <div
          v-for="(f, i) in r.followups"
          :key="i"
          class="rounded-lg bg-muted p-2.5"
        >
          <p class="text-default">
            {{ f.note }}
          </p>
          <p class="mt-0.5 text-xs text-muted">
            {{ f.by }}, {{ capWaktu(f.ts) }}
          </p>
        </div>
      </div>
    </div>

    <div>
      <AppSectionTitle
        title="Jejak & waktu duduk"
        icon="i-lucide-history"
      />
      <div class="space-y-1.5 text-sm">
        <div class="flex justify-between gap-3 border-b border-default pb-1.5">
          <span class="text-muted">Diinput oleh</span>
          <span class="text-right">{{ r.createdBy || '—' }}{{ r.createdAt ? `, ${capWaktu(r.createdAt)}` : '' }}</span>
        </div>
        <div
          v-if="r.checkinAt"
          class="flex justify-between gap-3 border-b border-default pb-1.5"
        >
          <span class="text-muted">Mulai duduk</span>
          <span class="text-right">{{ capWaktu(r.checkinAt) }}<template v-if="telat !== null"> · {{ telat <= 10 ? 'tepat waktu' : `telat ${fmtMenit(telat)}` }}</template></span>
        </div>
        <div
          v-if="r.leftAt"
          class="flex justify-between gap-3 border-b border-default pb-1.5"
        >
          <span class="text-muted">Selesai / pulang</span>
          <span class="text-right">{{ capWaktu(r.leftAt) }}</span>
        </div>
        <div
          v-else-if="duduk"
          class="flex justify-between gap-3 border-b border-default pb-1.5"
        >
          <span class="text-muted">Sedang duduk</span>
          <span class="text-right">masih di meja</span>
        </div>
        <div
          v-if="r.leftAt"
          class="flex justify-between gap-3 border-b border-default pb-1.5"
        >
          <span class="text-muted">Durasi duduk</span>
          <span class="text-right">{{ durasi !== null ? fmtMenit(durasi) : 'tak diketahui' }}</span>
        </div>
        <p
          v-if="r.datangDiasumsikan"
          class="text-xs text-muted"
        >
          Tidak pernah ditandai datang satu per satu — dianggap datang penuh saat tutup malam.
        </p>
      </div>
    </div>

    <div
      v-if="r.cancelReason"
      class="rounded-lg border border-error/40 p-3 text-sm"
    >
      <p class="mb-1 text-[11px] font-bold uppercase tracking-wide text-error">
        Alasan batal
      </p>
      <p class="text-default">
        {{ r.cancelReason }}
      </p>
    </div>

    <div>
      <AppSectionTitle
        title="Riwayat aktivitas"
        icon="i-lucide-list"
      />
      <p
        v-if="!(r.log ?? []).length"
        class="rounded-lg bg-muted p-3 text-sm text-muted"
      >
        Belum ada aktivitas yang tercatat untuk reservasi ini.
      </p>
      <template v-else>
        <UButton
          label="Lihat di Audit Log"
          icon="i-lucide-arrow-up-right"
          color="neutral"
          variant="ghost"
          size="sm"
          to="/reservasi/audit"
        />
        <div class="mt-2 space-y-1.5 text-sm">
          <div
            v-for="(l, i) in r.log"
            :key="i"
            class="rounded-lg bg-muted p-2.5"
          >
            <p class="font-semibold text-highlighted">
              {{ l.action }}
            </p>
            <p
              v-if="l.detail"
              class="text-default"
            >
              {{ l.detail }}
            </p>
            <p class="mt-0.5 text-xs text-muted">
              {{ l.by || '—' }}{{ l.role ? ` (${l.role})` : '' }}, {{ capWaktu(l.ts) }}
            </p>
          </div>
        </div>
      </template>
    </div>
  </div>

  <ResponsiveSheet
    v-model:open="buktiBuka"
    :title="buktiJudul"
  >
    <p
      v-if="buktiMemuat"
      class="text-sm text-muted"
    >
      Memuat bukti…
    </p>
    <p
      v-else-if="buktiGalat"
      class="text-sm"
    >
      {{ buktiGalat }}
    </p>
    <img
      v-else-if="!buktiPdf && buktiData"
      :src="buktiData"
      :alt="buktiJudul"
      class="w-full rounded-lg border border-default"
    >
    <object
      v-else-if="buktiPdf && buktiData"
      :data="buktiData"
      type="application/pdf"
      class="h-96 w-full rounded-lg border border-default"
    />
    <template #footer>
      <UButton
        label="Tutup"
        color="neutral"
        variant="soft"
        size="xl"
        @click="buktiBuka = false"
      />
    </template>
  </ResponsiveSheet>
</template>
