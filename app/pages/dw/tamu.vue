<!--
  Kalender Tamu (deploy/dw/index.html viewTamu :5340-5454).

  The old page answered "how busy is the day, and is there enough DW yet" by
  merging guest pax from Marketing + Event + Reservasi. In v1 there is no
  aggregate endpoint — gap G-05, laksamana-api#180 — so the guest half of each
  box shows "Segera (G-05)" and the DW half is built from GET /dw/overview
  (approved + waiting counts per day). The mapping for the day the endpoint
  arrives is already ported in app/utils/pax-harian.ts (`satukan`), owned by
  this module; the screen only has to call it.

  Clicking any box still opens the Ajukan DW sheet for that day, so the page
  keeps its one job: see the day and act on it.
-->
<script setup lang="ts">
import type { AjuanDw } from '~/utils/dw'
import { ajuanHidup } from '~/utils/dw'
import { useDwBulan, useDwDasar } from '~/composables/useDw'
import { akhirBulan, geserBulan, labelBulanJadwal, namaDivisiJadwal } from '~/utils/jadwal'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['dw'] })

const { ajuan, peran, error, refresh } = useDwDasar()
const mk = useDwBulan()
const bulanIni = hariIni().slice(0, 7)

const awal = computed(() => `${mk.value}-01`)
const akhir = computed(() => akhirBulan(mk.value))

const ajuanBulan = computed(() => ajuan.value.filter(a => a.tgl >= awal.value && a.tgl <= akhir.value && a.status !== 'BATAL'))
const hariAjuan = (tgl: string): AjuanDw[] => ajuan.value.filter(a => a.tgl === tgl && ajuanHidup(a))

const stat = computed(() => {
  const setuju = ajuanBulan.value.filter(a => a.status === 'DISETUJUI')
  const tunggu = ajuanBulan.value.filter(a => a.status === 'MENUNGGU')
  const hariAda = new Set(setuju.map(a => a.tgl)).size
  const hariTanpa = [...new Set(ajuanBulan.value.filter(a => a.status === 'DISETUJUI' || a.status === 'MENUNGGU').map(a => a.tgl))]
    .filter(t => !setuju.some(a => a.tgl === t)).length
  return { setuju: setuju.length, tunggu: tunggu.length, hariAda, hariTanpa }
})

const ajukanOpen = ref(false)
const ajukanTgl = ref('')
function buka(tgl: string) {
  ajukanTgl.value = tgl
  ajukanOpen.value = true
}
async function selesai() {
  await refresh()
}

/** 42 days of the visible grid clickable; neighbouring-month days too. */
const bisaKlik = () => true
</script>

<template>
  <AppPage
    title="Kalender tamu"
    description="Pax dari Marketing, Event & Reservasi — klik hari untuk ajukan DW."
  >
    <p
      v-if="error"
      class="mb-4 text-error"
      role="alert"
    >
      {{ apiErrorMessage(error) }}
    </p>

    <AppPanel>
      <template #head>
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold text-highlighted">
            {{ labelBulanJadwal(mk) }}
          </h2>
          <AppStatus
            v-if="mk !== bulanIni"
            size="sm"
          >
            bukan bulan ini
          </AppStatus>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Bulan sebelumnya"
            @click="mk = geserBulan(mk, -1)"
          />
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="outline"
            size="sm"
            aria-label="Bulan berikutnya"
            @click="mk = geserBulan(mk, 1)"
          />
          <UButton
            v-if="mk !== bulanIni"
            label="Kembali ke bulan ini"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="mk = bulanIni"
          />
          <UButton
            label="Muat ulang"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="refresh()"
          />
        </div>
      </template>

      <p class="mb-3 rounded-field bg-info/10 px-3 py-2 text-sm">
        <b>Pax tamu: Segera (G-05).</b> Jumlah tamu gabungan Marketing, Event dan Reservasi belum punya endpoint v1
        (laksamana-api#180). Sementara ini kotak menampilkan konteks daily worker; angka pax muncul otomatis begitu
        endpoint-nya tersedia.
      </p>

      <AppStatGrid>
        <AppStat
          label="Total pax"
          icon="i-lucide-users"
          value="—"
          sub="Segera (G-05)"
        />
        <AppStat
          label="Acara"
          icon="i-lucide-mic-vocal"
          value="—"
          sub="Segera (G-05)"
        />
        <AppStat
          label="Reservasi meja"
          icon="i-lucide-armchair"
          value="—"
          sub="Segera (G-05)"
        />
        <AppStat
          label="DW disetujui"
          icon="i-lucide-user-check"
          :value="stat.setuju"
          tone="success"
        />
        <AppStat
          label="DW menunggu"
          icon="i-lucide-hourglass"
          :value="stat.tunggu"
          :tone="stat.tunggu ? 'warning' : 'gold'"
        />
        <AppStat
          label="Hari ada DW"
          icon="i-lucide-calendar-check"
          :value="stat.hariAda"
        />
        <AppStat
          label="Hari tanpa DW"
          icon="i-lucide-calendar-x"
          :value="stat.hariTanpa"
          :tone="stat.hariTanpa ? 'warning' : 'gold'"
        />
      </AppStatGrid>

      <div class="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-success" /> Disetujui</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-warning" /> Menunggu</span>
        <span class="inline-flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-muted" /> Belum ada DW</span>
        <span v-if="!peran.hrd && (peran.divisi || []).length">
          · head hanya melihat divisi {{ peran.divisi.map(namaDivisiJadwal).join(', ') }} untuk pengisian.
        </span>
      </div>

      <DwKisi
        :mk="mk"
        :bisa="bisaKlik"
        @pilih="buka"
      >
        <template #hari="{ tgl, luar }">
          <template v-if="!luar">
            <template v-if="hariAjuan(tgl).length">
              <span class="text-[10px] font-semibold text-muted">
                <template v-if="hariAjuan(tgl).filter(a => a.status === 'DISETUJUI').length">
                  <b class="text-success">{{ hariAjuan(tgl).filter(a => a.status === 'DISETUJUI').length }} DW</b>
                </template>
                <template v-else>belum ada DW</template>
                <template v-if="hariAjuan(tgl).filter(a => a.status === 'MENUNGGU').length">
                  · {{ hariAjuan(tgl).filter(a => a.status === 'MENUNGGU').length }} menunggu
                </template>
              </span>
            </template>
            <span
              v-else
              class="text-[10px] italic text-dimmed"
            >belum ada DW</span>
          </template>
        </template>
      </DwKisi>

      <p class="mt-3 text-sm text-muted">
        Klik hari mana pun untuk mengajukan daily worker di hari itu. Angka pax dibaca langsung dari modul
        <b>Marketing</b>, <b>Event</b>, dan <b>Reservasi</b> — hanya acara yang statusnya sudah pasti jalan, dan
        reservasi yang tidak dibatalkan (<i>no-show</i> dihitung 0 pax). Panduan jumlah DW tetap dihitung dari
        ada-tidaknya acara, bukan dari reservasi.
      </p>
    </AppPanel>

    <DwAjukan
      v-model:open="ajukanOpen"
      :tgl-awal="ajukanTgl"
      @sent="selesai"
    />
  </AppPage>
</template>
