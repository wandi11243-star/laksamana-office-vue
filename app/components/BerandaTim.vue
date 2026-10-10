<!--
  Beranda: "Tim hari ini". Who of the viewer's team works today, read from the
  Roster (GET /jadwal/roster + /jadwal/cells), so it shows only for holders of
  `jadwal`. The team is the server-resolved shift Divisi when the viewer has one
  (bar/kitchen/floor/cashier), else everyone sharing one of the viewer's teams
  (`tim`, resolved by the API). Requests waiting for a decision are in BerandaTindakan.
-->
<script setup lang="ts">
import { DIVISI, jamSel, labelSel, petaSel, kunciSel, shiftDef } from '~/utils/jadwal'
import { setim } from '~/utils/beranda-tim'
import { angka, hariIni } from '~/utils/format'

const hari = ref(hariIni())
const { me, set, kru, pending, error } = useJadwalDasar()
const cells = useJadwalCells('beranda-sel-hari-ini', hari, hari)

const aku = computed(() => kru.value.find(u => u.id === me.value?.id) ?? null)
const divShift = computed(() => DIVISI.some(d => d.k === aku.value?.divisi) ? aku.value!.divisi : null)

const tim = computed(() => kru.value
  .filter(u => u.active !== false)
  .filter(u => divShift.value
    ? u.divisi === divShift.value
    : setim(me.value?.tim?.map(t => t.key), u.tim)))

const sel = computed(() => petaSel(cells.data.value ?? []))
const baris = computed(() => tim.value.map((u) => {
  const c = sel.value.get(kunciSel(u.id, hari.value)) ?? null
  const jam = jamSel(set.value, c)
  return { u, c, jam, label: labelSel(set.value, c), libur: !!c && !!shiftDef(set.value, c.t).libur }
}))
const bertugas = computed(() => baris.value
  .filter(b => b.c && !b.libur)
  .sort((a, b) => (a.jam?.m ?? '99').localeCompare(b.jam?.m ?? '99') || a.u.name.localeCompare(b.u.name)))
const libur = computed(() => baris.value.filter(b => b.libur).length)
const kosong = computed(() => baris.value.filter(b => !b.c).length)

const saya = computed(() => baris.value.find(b => b.u.id === me.value?.id)
  ?? { c: null, jam: null, label: '', libur: false })
const shiftSaya = computed(() => {
  const s = saya.value
  if (!s.c) return { value: '—', sub: 'Belum dijadwalkan' }
  if (s.libur) return { value: s.label, sub: 'Tidak bertugas' }
  return { value: s.label, sub: s.jam ? `${s.jam.m}–${s.jam.s}` : '' }
})

const judul = computed(() => divShift.value
  ? `Tim ${DIVISI.find(d => d.k === divShift.value)!.n} hari ini`
  : 'Tim hari ini')
const MAKS = 8
</script>

<template>
  <section
    v-if="!error && (pending || tim.length)"
    class="mb-7"
  >
    <AppSectionTitle
      :title="judul"
      icon="i-lucide-users"
    />
    <USkeleton
      v-if="pending || cells.status.value === 'pending'"
      class="mb-5 h-24 w-full rounded-panel"
    />
    <template v-else>
      <AppStatGrid>
        <AppStat
          label="Shift saya"
          :value="shiftSaya.value"
          :sub="shiftSaya.sub"
          icon="i-lucide-clock"
        />
        <AppStat
          label="Bertugas"
          :value="angka(bertugas.length)"
          :satuan="`/ ${angka(tim.length)}`"
          sub="orang hari ini"
          icon="i-lucide-user-check"
          tone="success"
        />
        <AppStat
          label="Libur & izin"
          :value="angka(libur)"
          sub="off, izin, cuti"
          icon="i-lucide-coffee"
          tone="info"
        />
        <AppStat
          v-if="kosong"
          label="Belum dijadwalkan"
          :value="angka(kosong)"
          sub="belum ada shift"
          icon="i-lucide-calendar-x"
          tone="warning"
        />
      </AppStatGrid>

      <AppList
        v-if="bertugas.length"
        title="Yang bertugas"
        :action="{ label: 'Lihat jadwal', to: '/jadwal' }"
      >
        <AppListRow
          v-for="b in bertugas.slice(0, MAKS)"
          :key="b.u.id"
          :title="b.u.name"
          :description="b.u.keterangan"
          icon="i-lucide-user"
        >
          <template #trailing>
            <span class="text-sm">
              <span class="font-semibold text-highlighted">{{ b.label }}</span>
              <span
                v-if="b.jam"
                class="text-muted num"
              > · {{ b.jam.m }}–{{ b.jam.s }}</span>
            </span>
          </template>
        </AppListRow>
        <AppListRow
          v-if="bertugas.length > MAKS"
          :title="`dan ${angka(bertugas.length - MAKS)} orang lagi`"
          to="/jadwal"
          dim
        />
      </AppList>
    </template>
  </section>
</template>
