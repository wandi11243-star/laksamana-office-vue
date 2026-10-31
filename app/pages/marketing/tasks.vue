<!--
  Marketing › Task Divisi — Operational Handover (docs/migrasi/marketing.md
  D.7, F.12, issue #62). Two levels, like renderTasks (:12450): event cards
  (Confirmed/Deal/Event Done, up to H+2), then one event's to-do board at
  ?event=<id>. ONE event = ONE category = its Format F&B; divisions are sub
  categories inside it. No format chosen → "Tugas Bebas". An operational user
  sees only the sub category of their own division.
-->
<script setup lang="ts">
import type { EventMkt } from '~/utils/marketing'
import { hMinusMkt, kategoriEventMkt, tglMkt } from '~/utils/marketing'
import type { ItemTugasMkt, PapanEventMkt, SubKatMkt, TemplateTugasMkt } from '~/utils/marketing-tugas'
import {
  DIV_BEBAS_MKT, eventHandoverMkt, hapusJobMkt, hitungItemMkt, hpStafMkt, itemEventMkt, jobFieldMkt,
  jobSelesaiMkt, jobTambahanMkt, linkWaMkt, pesanTugasMkt, progresDivMkt, progresSubMkt, stafMkt, subSiapMkt,
  subsDariMkt, tambahJobMkt, urutBebasMkt, urutPapanMkt,
} from '~/utils/marketing-tugas'
import { hariIni } from '~/utils/format'

definePageMeta({ access: ['marketing'] })

const toast = useToast()
const route = useRoute()
const router = useRouter()
const { data: st, status } = useStateMkt()
const { can, saya } = useAksesMkt()
const hari = hariIni()
const bisaUbah = computed(() => can('edit_task'))

const formats = computed(() => formatFbMkt(st.value))
const tpl = computed(() => st.value.taskTemplates as unknown as TemplateTugasMkt[])
const subs = computed(() => st.value.fbSubs as SubKatMkt[])
const staf = computed(() => stafMkt(st.value.users).map(u => u.name))
const opDiv = computed(() => (saya.value?.user.role === 'operational' ? String(saya.value.user.div ?? '') : ''))
const namaClient = (id: string) => st.value.clients.find(c => c.id === id)?.nama ?? ''
const namaUser = (id?: string) => st.value.users.find(u => u.id === id)?.name ?? ''

const evs = computed(() => eventHandoverMkt(st.value.events, hari))
const evId = computed(() => String(route.query.event ?? ''))
const ev = computed(() => evs.value.find(e => e.id === evId.value) ?? null)
const kat = (e: EventMkt) => kategoriEventMkt(e, formats.value)

// ---- level 1: cards
function kartu(e: EventMkt) {
  const k = kat(e)[0] ?? ''
  const subNama = opDiv.value ? [opDiv.value] : (k ? subsDariMkt(subs.value, k).map(x => x.nama) : [])
  const d = (e.detail ?? {}) as Record<string, unknown>
  const area = String((d.area === 'Lainnya' ? d.areaLain : d.area) ?? '')
  const rd = hMinusMkt(e.tanggal, hari)
  return {
    jml: hitungItemMkt(e, kat(e), tpl.value),
    kat: k,
    siap: subSiapMkt(e, k, subNama, tpl.value),
    nSub: subNama.length,
    kapan: rd === 'Hari ini' ? 'HARI INI' : rd,
    mendesak: rd === 'Hari ini' || /^H-[0-3]$/.test(rd),
    ringkas: [
      { i: 'i-lucide-building-2', v: namaClient(e.clientId) },
      { i: 'i-lucide-calendar', v: tglMkt(e.tanggal) },
      { i: 'i-lucide-map-pin', v: area },
      { i: 'i-lucide-users', v: e.pax ? `${e.pax} tamu` : '' },
      { i: 'i-lucide-user', v: String(d.picAcara ?? '') || namaUser(e.mktPIC) },
    ].filter(x => x.v && x.v !== '—'),
  }
}
const buka = (id: string) => router.push({ query: { ...route.query, event: id } })
const kembali = () => router.push({ query: { ...route.query, event: undefined } })

// ---- level 2: board
const jml = computed(() => (ev.value ? hitungItemMkt(ev.value, kat(ev.value), tpl.value) : { total: 0, selesai: 0, pct: 0 }))
function kelompok(e: EventMkt, div: string) {
  const items = itemEventMkt(e, div, tpl.value).filter(t => !opDiv.value || t.extra || (t.sub || '') === opDiv.value)
  return {
    items,
    selesai: items.filter(t => jobSelesaiMkt(e, div, t.id)).length,
    pct: opDiv.value ? progresSubMkt(e, div, opDiv.value, tpl.value) : progresDivMkt(e, div, tpl.value),
    grup: urutPapanMkt(items, subs.value),
  }
}
const bebas = computed(() => (ev.value ? jobTambahanMkt(ev.value, DIV_BEBAS_MKT) : []))

async function simpan(fields: Partial<PapanEventMkt>) {
  const e = ev.value
  if (!e) return
  await mktSimpan(() => tambalMkt<EventMkt>('events', e.id, fields as Partial<EventMkt>, e.updatedAt))
}
const idBaru = () => `xj${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
function tambah(div: string, sub = '') {
  if (ev.value) void simpan(tambahJobMkt(ev.value, div, sub, idBaru()))
}
const subBebas = ref('')
function tambahBebas() {
  tambah(DIV_BEBAS_MKT, subBebas.value.trim())
  subBebas.value = ''
}
function hapus(div: string, item: ItemTugasMkt) {
  const e = ev.value
  if (!e) return
  if (!confirm(`Hapus ${div === DIV_BEBAS_MKT ? 'tugas' : 'job'} "${item.task || '(tanpa nama)'}"${div === DIV_BEBAS_MKT ? '' : ` dari ${div}`}? Job ini hanya milik event ini.`)) return
  void simpan(hapusJobMkt(e, div, item.id))
}
function wa(div: string, item: ItemTugasMkt) {
  const e = ev.value
  if (!e) return
  const pic = jobFieldMkt(e, div, item, 'pic')
  if (!pic) return toast.add({ title: 'Belum ada PIC', description: 'Assign PIC dulu di item ini sebelum kirim reminder.', color: 'error' })
  const hp = hpStafMkt(st.value.users, pic)
  if (!hp) return toast.add({ title: 'Nomor PIC belum ada', description: `No. HP "${pic}" masih kosong. Isi di halaman Pegawai & Akses, atau lengkapi No. HP-nya di Office.`, color: 'error' })
  window.open(linkWaMkt(hp, pesanTugasMkt(e, div, item, pic, jobFieldMkt(e, div, item, 'deadline'), jobFieldMkt(e, div, item, 'note'), tglMkt)), '_blank')
}
</script>

<template>
  <AppPage
    :title="ev ? ev.nama : 'Task Divisi — Operational Handover'"
    :description="ev ? `${namaClient(ev.clientId)} · ${tglMkt(ev.tanggal)} · ${hMinusMkt(ev.tanggal, hari) === 'Hari ini' ? 'HARI INI' : hMinusMkt(ev.tanggal, hari)}` : (opDiv ? `Task untuk divisi ${opDiv}. Pilih event untuk update kesiapannya.` : 'Pilih event untuk melihat kesiapan tiap divisinya.')"
  >
    <template
      v-if="ev"
      #actions
    >
      <UButton
        icon="i-lucide-arrow-left"
        label="Semua Event"
        color="neutral"
        variant="outline"
        @click="kembali"
      />
    </template>
    <MarketingGerbang layar="tasks">
      <!-- Level 1 ↔ 2 replaces the working surface, so the swap crossfades. -->
      <Transition
        name="mkt-swap"
        mode="out-in"
      >
        <!-- level 1 -->
        <div
          v-if="!ev"
          key="daftar"
        >
          <div
            v-if="status === 'pending' && !st.events.length"
            class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <USkeleton
              v-for="i in 6"
              :key="i"
              class="h-28 rounded-xl"
            />
          </div>
          <AppPanel v-else-if="!evs.length">
            <div class="py-8 text-center">
              <UIcon
                name="i-lucide-list-checks"
                class="size-8 text-dimmed"
              />
              <p class="mt-2 font-semibold text-highlighted">
                Belum ada handover
              </p>
              <p class="text-sm text-muted">
                Event yang sudah Confirmed akan muncul di sini dengan checklist per divisi.
              </p>
            </div>
          </AppPanel>
          <div
            v-else
            class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <button
              v-for="e in evs"
              :key="e.id"
              type="button"
              class="flex flex-col rounded-xl border border-default bg-default p-4 text-start transition hover:border-primary-400"
              @click="buka(e.id)"
            >
              <span class="flex items-start gap-2">
                <span class="min-w-0 flex-1 font-semibold text-highlighted">{{ e.nama }}</span>
                <UBadge
                  :label="kartu(e).kapan"
                  :color="kartu(e).mendesak ? 'warning' : 'neutral'"
                  variant="soft"
                  size="sm"
                />
              </span>
              <span class="mt-3 grid gap-1.5">
                <span
                  v-for="r in kartu(e).ringkas"
                  :key="r.i"
                  class="flex items-center gap-2 text-xs text-muted"
                >
                  <UIcon
                    :name="r.i"
                    class="size-3.5 shrink-0"
                  />
                  <span class="truncate">{{ r.v }}</span>
                </span>
              </span>
              <span class="mt-4 flex justify-between text-xs text-muted">
                <span>Progres to-do</span>
                <span class="num">{{ kartu(e).jml.selesai }}/{{ kartu(e).jml.total }} · {{ kartu(e).jml.pct }}%</span>
              </span>
              <UProgress
                :model-value="kartu(e).jml.pct"
                size="sm"
                class="mt-1.5"
              />
              <span class="mt-2 text-xs text-muted">{{ kartu(e).kat ? `${kartu(e).siap}/${kartu(e).nSub} sub kategori siap` : 'Format F&B belum dipilih' }}</span>
              <span class="mt-3 flex items-center gap-1 text-xs font-semibold text-primary-700">
                Buka papan to-do
                <UIcon
                  name="i-lucide-chevron-right"
                  class="size-3.5"
                />
              </span>
            </button>
          </div>
        </div>

        <!-- level 2: free board -->
        <AppPanel
          v-else-if="!kat(ev).length"
          key="bebas"
          title="Tugas Bebas"
          :count="bebas.length ? `${bebas.filter(j => jobSelesaiMkt(ev!, DIV_BEBAS_MKT, j.id)).length}/${bebas.length}` : undefined"
          flush
        >
          <p class="border-b border-default px-4 py-3 text-sm text-muted">
            Event ini belum memilih Format F&B, jadi belum ada daftar to-do standar. Susun tugasnya sendiri di sini — sub kategori & isian bebas. (Kalau nanti Format F&B diisi, papan standar muncul otomatis dan tugas bebas ini tetap tersimpan.)
          </p>
          <p
            v-if="!bebas.length"
            class="px-4 py-6 text-center text-sm text-muted"
          >
            Belum ada tugas. Tambahkan di bawah.
          </p>
          <div
            v-else
            class="hidden grid-cols-[2rem_minmax(10rem,1fr)_5rem_10rem_9.5rem_minmax(8rem,1fr)_4.5rem] gap-x-2 border-b border-default px-3 py-2 text-xs font-semibold text-muted lg:grid"
          >
            <span /><span>Item</span><span>Timeline</span><span>PIC</span><span>Deadline</span><span>Catatan</span><span />
          </div>
          <template
            v-for="g in urutBebasMkt(bebas)"
            :key="g.sub"
          >
            <div
              v-if="g.sub"
              class="flex items-center gap-2 bg-muted px-4 py-1.5 text-xs font-semibold"
            >
              {{ g.sub }}
              <UButton
                v-if="bisaUbah"
                icon="i-lucide-plus"
                label="item"
                size="xs"
                color="neutral"
                variant="ghost"
                @click="tambah(DIV_BEBAS_MKT, g.sub)"
              />
            </div>
            <MarketingItemTugas
              v-for="j in g.items"
              :key="j.id"
              :ev="ev"
              :div="DIV_BEBAS_MKT"
              :item="j"
              :bisa-ubah="bisaUbah"
              :staf="staf"
              nama-bebas
              @simpan="simpan"
              @hapus="hapus(DIV_BEBAS_MKT, j)"
              @wa="wa(DIV_BEBAS_MKT, j)"
            />
          </template>
          <div
            v-if="bisaUbah"
            class="flex flex-wrap gap-2 border-t border-default p-4"
          >
            <UInput
              v-model="subBebas"
              placeholder="Sub kategori (mis. Persiapan, Hari-H)…"
              class="min-w-0 flex-1 sm:max-w-72"
              @keydown.enter.prevent="tambahBebas"
            />
            <UButton
              icon="i-lucide-plus"
              label="Tambah tugas"
              color="neutral"
              variant="outline"
              @click="tambahBebas"
            />
          </div>
        </AppPanel>

        <!-- level 2: standard board -->
        <div
          v-else
          key="papan"
        >
          <AppPanel>
            <div class="flex flex-wrap items-center gap-4">
              <div class="min-w-48 flex-1">
                <p class="text-xs font-semibold tracking-wide text-muted uppercase">
                  Progres keseluruhan
                </p>
                <UProgress
                  :model-value="jml.pct"
                  class="mt-2"
                />
              </div>
              <div class="text-end">
                <p class="num text-2xl font-bold text-highlighted">
                  {{ jml.pct }}%
                </p>
                <p class="text-xs text-muted">
                  <b class="num">{{ jml.selesai }}</b>/{{ jml.total }} item selesai
                </p>
              </div>
            </div>
          </AppPanel>
          <AppPanel
            v-for="div in kat(ev)"
            :key="div"
            :title="opDiv ? `${div} · ${opDiv}` : div"
            :count="`${kelompok(ev, div).selesai}/${kelompok(ev, div).items.length} · ${kelompok(ev, div).pct}%`"
            flush
          >
            <p
              v-if="!kelompok(ev, div).items.length"
              class="px-4 py-6 text-center text-sm text-muted"
            >
              Belum ada job. Tambahkan di bawah, atau susun standarnya di Template Task.
            </p>
            <div
              v-else
              class="hidden grid-cols-[2rem_minmax(10rem,1fr)_5rem_10rem_9.5rem_minmax(8rem,1fr)_4.5rem] gap-x-2 border-b border-default px-3 py-2 text-xs font-semibold text-muted lg:grid"
            >
              <span /><span>Item</span><span>Timeline</span><span>PIC</span><span>Deadline</span><span>Catatan</span><span />
            </div>
            <template
              v-for="g in kelompok(ev, div).grup"
              :key="g.sub"
            >
              <div
                v-if="g.sub"
                class="flex items-center gap-2 bg-muted px-4 py-1.5 text-xs font-semibold"
              >
                {{ g.sub }}
                <UButton
                  v-if="bisaUbah"
                  icon="i-lucide-plus"
                  label="item"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :aria-label="`Tambah item ke ${g.sub}`"
                  @click="tambah(div, g.sub)"
                />
              </div>
              <MarketingItemTugas
                v-for="t in g.items"
                :key="t.id"
                :ev="ev"
                :div="div"
                :item="t"
                :bisa-ubah="bisaUbah"
                :staf="staf"
                @simpan="simpan"
                @hapus="hapus(div, t)"
                @wa="wa(div, t)"
              />
            </template>
            <div
              v-if="bisaUbah"
              class="border-t border-default p-3"
            >
              <UButton
                icon="i-lucide-plus"
                label="Tambah item tanpa sub kategori…"
                size="sm"
                color="neutral"
                variant="ghost"
                @click="tambah(div)"
              />
            </div>
          </AppPanel>
        </div>
      </Transition>
    </MarketingGerbang>
  </AppPage>
</template>
