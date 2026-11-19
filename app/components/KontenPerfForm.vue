<!--
  Input Performa form for one posted item (old openPerf + savePerf,
  deploy/konten/index.html:4508-4584; konten.md D.11).

  One block per listed platform, the nine boxes of PK_FIELD. Empty = 0, but a
  platform whose boxes are ALL empty counts as "not filled", never as zeros.
  Saving sends one PUT /content/{id}/performance per filled platform (the
  server stamps at/by; we keep firstAt/firstBy so a later fix does not erase
  who typed it first — perfRencana).

  Clearing every box of a platform that HAD figures deletes its record, with a
  confirmation that NAMES the platform (F.10). G-01 (laksamana-api#177) made
  that possible: `metrics: null` removes just that platform (hapusPerformaKonten).
  A platform that never had figures and stays empty is left untouched.
-->
<script setup lang="ts">
import type { KontenItem } from '~/utils/konten'
import { contentPlatforms } from '~/utils/konten'
import { PK_FIELD, perfRencana } from '~/utils/performa-konten'

const props = defineProps<{ item: KontenItem | null }>()
const open = defineModel<boolean>('open', { default: false })

const { data: st } = useStateKonten()
const { saya, can } = useAksesKonten()
// the old title link opened the form for anyone; saving needs the `analytics` row (stricter, like #48's forms)
const boleh = computed(() => can('analytics'))

const plats = computed(() => contentPlatforms(props.item))
const isi = ref<Record<string, Record<string, string>>>({})
const sibuk = ref(false)

watch(open, (v) => {
  if (!v || !props.item) return
  const perf = props.item.perf && typeof props.item.perf === 'object' ? props.item.perf : {}
  isi.value = Object.fromEntries(plats.value.map(p => [p, Object.fromEntries(PK_FIELD.map((f) => {
    const n = Number(perf[p]?.[f.k]) || 0
    return [f.k, n ? String(n) : '']
  }))]))
})

const namaUser = (v?: unknown) => {
  const s = String(v ?? '')
  return st.value.users.find(u => u.id === s)?.name ?? s
}
const waktu = (v?: unknown) => (v ? new Date(Number(v)).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')
const jejak = (p: string) => {
  const m = props.item?.perf?.[p]
  return m?.at ? `diisi ${namaUser(m.by)} · ${waktu(m.at)}` : 'belum pernah diisi'
}

const rencana = computed(() => (props.item ? perfRencana(props.item, isi.value, saya.value?.user.name ?? '') : { kirim: {}, hapus: [] as string[] }))
const nKirim = computed(() => Object.keys(rencana.value.kirim).length)
const legacy = computed(() => !!props.item?.metrics && !Object.keys(props.item?.perf ?? {}).length)

async function simpan() {
  const c = props.item
  if (!c || (!nKirim.value && !rencana.value.hapus.length) || !boleh.value) return
  const hapus = rencana.value.hapus
  // Clearing every box of a platform DELETES that platform's figures, so ask
  // first and name it — a confirmation without content just trains people to
  // press OK (old savePerf, :4368-4372).
  if (hapus.length && !confirm(`Catatan performa untuk ${hapus.join(', ')} akan DIHAPUS karena seluruh kotaknya kosong.\n\nLanjutkan?`)) return
  sibuk.value = true
  const ok = await kontenSimpan(async () => {
    for (const [p, m] of Object.entries(rencana.value.kirim)) await simpanPerformaKonten(c.id, p, m)
    for (const p of hapus) await hapusPerformaKonten(c.id, p)
  }, 'Performa tersimpan', { action: 'mengisi performa konten', target: c.title })
  sibuk.value = false
  if (!ok) return
  open.value = false
}
</script>

<template>
  <ResponsiveSheet
    v-model:open="open"
    :title="`Performa: ${item?.title || '(tanpa judul)'}`"
    lebar
  >
    <div class="space-y-4">
      <p class="text-sm text-muted">
        Salin angkanya dari <b>Insight</b> tiap platform. Kosong sama dengan nol — dan platform yang SELURUH angkanya
        kosong dianggap belum diisi, bukan diisi nol: nol berarti "dilihat sekian orang dan tidak satu pun bereaksi",
        dan itu kesimpulan tentang angka yang belum pernah dibuka siapa pun.
      </p>
      <p
        v-if="!boleh"
        class="text-xs text-muted"
      >
        Hanya bisa dilihat — mengisi angka performa butuh izin ubah Performa.
      </p>
      <UAlert
        v-if="legacy"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        description="Konten ini punya catatan performa lama yang tidak dipecah per platform. Catatan itu TIDAK ditimpa dan tidak ditebak pembagiannya — begitu kamu mengisi angka per platform di bawah, yang dipakai seluruh laporan adalah yang baru."
      />
      <section
        v-for="p in plats"
        :key="p"
        class="rounded-lg border border-default p-3"
      >
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <UBadge
            :label="p"
            color="neutral"
            variant="soft"
          />
          <span class="text-xs text-muted">{{ jejak(p) }}</span>
          <UBadge
            v-if="rencana.hapus.includes(p)"
            label="Akan dihapus"
            color="warning"
            variant="subtle"
            size="sm"
          />
        </div>
        <p
          v-if="rencana.hapus.includes(p)"
          class="mb-3 text-xs text-warning"
        >
          Seluruh kotak {{ p }} kosong. Menyimpan akan MENGHAPUS catatan platform ini — ditanya dulu dengan menyebut
          namanya. Isi lagi salah satu angkanya kalau tidak ingin menghapus apa-apa.
        </p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <UFormField
            v-for="f in PK_FIELD"
            :key="f.k"
            :label="f.t"
            :help="f.ket"
            :ui="{ help: 'text-[11px]' }"
          >
            <UInput
              v-if="isi[p]"
              v-model="isi[p]![f.k]"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              placeholder="0"
              :disabled="!boleh"
              class="w-full"
            />
          </UFormField>
        </div>
      </section>
    </div>
    <template #footer>
      <UButton
        v-if="boleh"
        label="Simpan performa"
        :loading="sibuk"
        :disabled="!nKirim && !rencana.hapus.length"
        @click="simpan"
      />
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
    </template>
  </ResponsiveSheet>
</template>
