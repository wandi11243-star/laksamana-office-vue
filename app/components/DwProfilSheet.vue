<!--
  Database DW — profil & riwayat kerja (deploy/dw/index.html bukaProfil :6468).
  HRD may edit/delete from here, a head may read and start a request for the
  person ("Minta orang ini"); staff who only hold the page see the profile.
  money is HRD-only (F.12).
-->
<script setup lang="ts">
import type { AjuanDw, PekerjaDw } from '~/utils/dw'
import { bolehLihatUangDw, divPekerja, durasiJamDw, labelTujuanDw, posPekerja, statistikDw, biayaAjuanDw } from '~/utils/dw'
import { namaDivisiJadwal } from '~/utils/jadwal'
import { useDwDasar } from '~/composables/useDw'
import { fTglP, rupiah } from '~/utils/format'

const props = defineProps<{ p: PekerjaDw | null }>()
const emit = defineEmits<{ sunting: [], hapus: [], minta: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { set, ajuan, peran } = useDwDasar()

const st = computed(() => (props.p ? statistikDw(ajuan.value, props.p.id) : { total: 0, jam: 0, menunggu: 0 }))
const riwayat = computed<AjuanDw[]>(() => (props.p
  ? ajuan.value.filter(a => a.dwId === props.p!.id).sort((a, b) => b.tgl.localeCompare(a.tgl)).slice(0, 12)
  : []))
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="p?.nama ?? 'Profil DW'"
  >
    <div
      v-if="p"
      class="space-y-4"
    >
      <div class="flex flex-wrap items-center gap-2">
        <AppStatus
          size="sm"
          :color="p.status === 'AKTIF' ? 'success' : 'neutral'"
          :icon="p.status === 'AKTIF' ? 'i-lucide-circle-check' : 'i-lucide-circle-slash'"
        >
          {{ p.status === 'AKTIF' ? 'Aktif' : 'Nonaktif' }}
        </AppStatus>
        <span class="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted num">{{ p.hp }}</span>
        <span
          v-for="k in divPekerja(p)"
          :key="k"
          class="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted"
        >{{ namaDivisiJadwal(k) }}</span>
        <span class="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted">{{ posPekerja(p).join(', ') || '—' }}</span>
      </div>

      <div class="rounded-field bg-muted px-3 py-2 text-sm">
        <b class="text-highlighted">Tujuan pembayaran</b>
        <p class="text-muted">
          {{ labelTujuanDw(p) }}
        </p>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-panel border border-default p-3 text-center">
          <p class="font-display text-2xl font-bold text-highlighted num">
            {{ st.total }}
          </p>
          <p class="text-xs text-muted">
            Kali kerja
          </p>
        </div>
        <div class="rounded-panel border border-default p-3 text-center">
          <p class="font-display text-2xl font-bold text-highlighted num">
            {{ st.jam }}
          </p>
          <p class="text-xs text-muted">
            Total jam
          </p>
        </div>
        <div class="rounded-panel border border-default p-3 text-center">
          <p class="font-display text-2xl font-bold text-highlighted num">
            {{ st.menunggu }}
          </p>
          <p class="text-xs text-muted">
            Ajuan menunggu
          </p>
        </div>
      </div>

      <p
        v-if="p.bank && !p.bayarNomor"
        class="rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        Catatan rekening lama: <b>{{ p.bank }}</b>
      </p>
      <p
        v-if="p.skill"
        class="text-sm"
      >
        <b class="text-highlighted">Skill</b> · <span class="text-muted">{{ p.skill }}</span>
      </p>
      <p
        v-if="p.catatan"
        class="rounded-field bg-warning/12 px-3 py-2 text-sm"
      >
        {{ p.catatan }}
      </p>

      <div>
        <p class="mb-2 text-sm font-semibold text-highlighted">
          Riwayat terakhir
        </p>
        <div
          v-if="riwayat.length"
          class="divide-y divide-default rounded-panel border border-default"
        >
          <div
            v-for="a in riwayat"
            :key="a.id"
            class="flex items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <div class="min-w-0">
              <p class="font-semibold text-highlighted num">
                {{ fTglP(a.tgl) }} · {{ a.m }}–{{ a.s }}
              </p>
              <p class="text-muted">
                {{ namaDivisiJadwal(a.divisi) }} · {{ a.posisi || '—' }} · {{ durasiJamDw(a.m, a.s) }} jam
              </p>
            </div>
            <div class="shrink-0 text-end">
              <DwStatus
                :status="a.status"
                size="sm"
              />
              <p
                v-if="bolehLihatUangDw(peran) && a.status === 'DISETUJUI'"
                class="mt-0.5 text-xs text-muted num"
              >
                {{ rupiah(biayaAjuanDw(set, a)) }}
              </p>
            </div>
          </div>
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          Belum pernah dijadwalkan.
        </p>
      </div>
    </div>

    <template #footer>
      <UButton
        v-if="peran.hrd || peran.head"
        label="Minta orang ini"
        icon="i-lucide-send"
        @click="emit('minta')"
      />
      <UButton
        v-if="peran.hrd"
        label="Sunting"
        color="neutral"
        variant="ghost"
        icon="i-lucide-pencil"
        @click="emit('sunting')"
      />
      <UButton
        v-if="peran.hrd"
        label="Hapus"
        color="error"
        variant="ghost"
        @click="emit('hapus')"
      />
    </template>
  </ResponsiveSheet>
</template>
