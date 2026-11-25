// The automatic "Cek Google" of the review page: it runs by itself once the
// claims are loaded and the viewer's role is known to be admin, and again on
// demand ("Cek ulang") or after a claim is saved. Only results that changed are
// written back, under the list's version; a conflict reloads and tries once more.
import type { FetchError } from 'ofetch'
import type { Review } from '~/composables/useServiceExcellent'
import { getGoogleClaimCandidates } from '~/composables/useServiceExcellent'
import { putSection } from '~/composables/useReservasi'
import { terapkanCekGoogle } from '~/utils/cek-google'
import { hariIni } from '~/utils/format'
import { isKonflik, type Versi } from '~/utils/versi'

export interface InfoCekGoogle {
  /** Last Google pull on the server, ms; 0 = never. */
  syncAt: number
  /** Only the Places API feeds the data: a few reviews per place. */
  lemah: boolean
  /** When this check ran, ms. */
  pada: number
}

export function useCekGoogle(o: {
  /** The viewer may run it (role admin). */
  aktif: Ref<boolean>
  /** Claims AND roles are loaded: before the roles arrive everyone reads as admin. */
  siap: Ref<boolean>
  daftar: Ref<Review[]>
  versi: Ref<Versi | undefined>
  muatUlang: () => Promise<unknown>
  nama: Ref<string>
}) {
  const memuat = ref(false)
  const galat = ref('')
  const info = ref<InfoCekGoogle | null>(null)

  /** Returns how many claims got a new result, or null when the check failed. */
  async function cek(manual = false): Promise<number | null> {
    if (!o.aktif.value || !o.siap.value || memuat.value) return null
    memuat.value = true
    galat.value = ''
    try {
      const data = (await getGoogleClaimCandidates()).data
      const simpan = async () => {
        const { next, jumlah } = terapkanCekGoogle(o.daftar.value, data, {
          hariIni: hariIni(), oleh: o.nama.value, kini: Date.now(), denganSync: manual,
        })
        if (jumlah) {
          await putSection('reviews', next, o.versi.value)
          await o.muatUlang()
        }
        return jumlah
      }
      let jumlah: number
      try {
        jumlah = await simpan()
      }
      catch (e) {
        if (!isKonflik(e)) throw e
        // Someone saved in between: work again on the fresh list, never overwrite it.
        await o.muatUlang()
        jumlah = await simpan()
      }
      info.value = { syncAt: Number(data.syncAt) || 0, lemah: !data.sumber.includes('gbp'), pada: Date.now() }
      return jumlah
    }
    catch (e) {
      galat.value = (e as FetchError)?.statusCode === 404
        ? 'Layanan Cek Google belum ada di server ini (API-nya belum di-deploy).'
        : apiErrorMessage(e)
      return null
    }
    finally {
      memuat.value = false
    }
  }

  let sudah = false
  // `post`: the module chrome has copied the loaded roles into the shared state by then.
  watch([o.aktif, o.siap], ([aktif, siap]) => {
    if (aktif && siap && !sudah) {
      sudah = true
      void cek()
    }
  }, { immediate: true, flush: 'post' })

  return { memuat, galat, info, cek }
}
