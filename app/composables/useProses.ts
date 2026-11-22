/**
 * Background work the user should SEE (owner request, Nov 2026): a sheet closes
 * the moment a button is pressed, while the write — status, moving a table, a
 * walk-in, a DP — still runs. Without a sign the screen looks like nothing
 * happened, and the crew presses again. Each running write puts one line here;
 * <AppProses> shows them as a "Memproses…" pill until the write settles.
 *
 *   const { mulai } = useProses()
 *   const selesai = mulai('Mengubah status Wandi jadi Datang')
 *   try { await … } finally { selesai() }
 *
 * Shared through useState, so a component (walk-in sheet, DP sheet) and the page
 * feed the same pill.
 */
export interface ProsesLatar {
  id: number
  teks: string
}

let urut = 0

export function useProses() {
  const daftar = useState<ProsesLatar[]>('proses-latar', () => [])

  /** Start one line; the returned function ends it (safe to call twice). */
  function mulai(teks: string): () => void {
    const id = ++urut
    daftar.value = [...daftar.value, { id, teks }]
    let sudah = false
    return () => {
      if (sudah) return
      sudah = true
      daftar.value = daftar.value.filter(p => p.id !== id)
    }
  }

  async function proses<T>(teks: string, aksi: () => Promise<T>): Promise<T> {
    const selesai = mulai(teks)
    try {
      return await aksi()
    }
    finally {
      selesai()
    }
  }

  return { daftar, mulai, proses }
}
