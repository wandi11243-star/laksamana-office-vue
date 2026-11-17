// Print / "Simpan sebagai PDF" with a meaningful file name.
//
// Browsers name a printed PDF after `document.title`, which is the app's
// generic page title ("Laksamana Office"). `cetakPdf(nama)` swaps the title
// for the document being printed ("PR-19 — 16 Nov – 22 Nov 2026") while the
// print dialog is open, then puts the old title back. Characters a file name
// cannot hold are replaced, so the suggested name is always valid.

/** A safe file name from the parts given (empty parts are skipped). */
export function namaBerkas(...bagian: (string | number | null | undefined)[]): string {
  return bagian
    .map(b => String(b ?? '').trim())
    .filter(Boolean)
    .join(' - ')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 150)
    .trim() || 'Laksamana Muda'
}

/** `window.print()` with `document.title` set to `nama` for the dialog's PDF file name. */
export function cetakPdf(nama: string): void {
  if (typeof window === 'undefined') return
  const lama = document.title
  let pulih = false
  const kembalikan = () => {
    if (pulih) return
    pulih = true
    document.title = lama
    window.removeEventListener('afterprint', kembalikan)
  }
  document.title = nama
  window.addEventListener('afterprint', kembalikan)
  window.print()
  // Some browsers never fire `afterprint`; print() blocks until the dialog
  // closes in most, so restoring on the next tick is a safe fallback.
  setTimeout(kembalikan, 1000)
}
