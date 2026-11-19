// Auto-scroll while dragging a card (owner request, Nov 2026: on a kanban wider
// than the screen a ticket could not be carried to the far column — native
// HTML5 drag & drop does not scroll an overflow box by itself).
//
// One listener for the whole app, so every board gets it: AppKanban / BdKanban
// and the hand-made boards (BD Koordinasi & Project, H-Life). The nearest
// sideways-scrolling ancestor of the dragged card (or, failing that, of what
// the pointer is over) scrolls while the pointer is near its left / right edge
// — faster the closer, full speed past the edge. Near the top / bottom of the
// window the page scrolls too, for long columns.
//
// The loop runs until the drag ends, NOT until dragover goes quiet: a browser
// fires dragover only every ~350 ms while the pointer rests, so a timeout
// stopped the scroll as soon as the hand stopped moving ("harus arahin kursor
// dulu", Nov 2026). Leaving the window pauses it.
const MAX = 28

function gulirSamping(el: Element | null): HTMLElement | null {
  for (let n = el instanceof HTMLElement ? el : el?.parentElement ?? null; n && n !== document.body; n = n.parentElement) {
    const ox = getComputedStyle(n).overflowX
    if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return n
  }
  return null
}

/** Speed for a pointer `jarak` px inside an edge zone of width `zona` (0 = outside). */
const laju = (jarak: number, zona: number) => (jarak < zona ? Math.ceil(MAX * Math.min(1, 1 - jarak / zona)) : 0)

export default defineNuxtPlugin(() => {
  let kotak: HTMLElement | null = null
  let x = 0
  let y = 0
  let aktif = false
  let luar = false
  let raf = 0

  function langkah() {
    raf = 0
    if (!aktif) return
    if (!luar) {
      if (kotak) {
        const r = kotak.getBoundingClientRect()
        // A wide zone (15% of the board, 100–180 px) so the card needs no precise aim.
        const zona = Math.min(180, Math.max(100, r.width * 0.15))
        if (y >= r.top - zona && y <= r.bottom + zona) {
          const kanan = laju(r.right - x, zona)
          const kiri = laju(x - r.left, zona)
          if (kanan && kotak.scrollLeft + kotak.clientWidth < kotak.scrollWidth) kotak.scrollLeft += kanan
          else if (kiri && kotak.scrollLeft > 0) kotak.scrollLeft -= kiri
        }
      }
      const bawah = laju(window.innerHeight - y, 70)
      const atas = laju(y, 70)
      if (bawah) window.scrollBy(0, bawah)
      else if (atas) window.scrollBy(0, -atas)
    }
    raf = requestAnimationFrame(langkah)
  }

  function berhenti() {
    aktif = false
    kotak = null
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  document.addEventListener('dragstart', (e) => {
    kotak = gulirSamping(e.target as Element | null)
    aktif = true
    luar = false
    x = e.clientX
    y = e.clientY
  })
  document.addEventListener('dragover', (e) => {
    if (!aktif) return
    x = e.clientX
    y = e.clientY
    luar = false
    kotak ??= gulirSamping(e.target as Element | null)
    if (!raf) raf = requestAnimationFrame(langkah)
  })
  // relatedTarget null = the pointer left the window.
  document.addEventListener('dragleave', (e) => {
    if (aktif && !e.relatedTarget) luar = true
  })
  document.addEventListener('dragend', berhenti)
  document.addEventListener('drop', berhenti)
})
