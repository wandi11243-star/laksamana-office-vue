// Auto-scroll while dragging a card (owner request, Nov 2026: on a kanban wider
// than the screen a ticket could not be carried to the far column — native
// HTML5 drag & drop does not scroll an overflow box by itself).
//
// One listener for the whole app, so every board gets it: AppKanban / BdKanban
// and the hand-made boards (BD Koordinasi & Project, H-Life). On dragstart the
// nearest sideways-scrolling ancestor of the dragged element is remembered;
// while the pointer is within EDGE px of its left / right edge the box scrolls,
// faster the closer to the edge. Near the top / bottom of the window the page
// scrolls too, for long columns.
const EDGE = 80
const MAX = 22

function gulirSamping(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement; n && n !== document.body; n = n.parentElement) {
    const ox = getComputedStyle(n).overflowX
    if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return n
  }
  return null
}

/** Speed for a pointer `jarak` px inside an edge zone (0 = outside the zone). */
const laju = (jarak: number) => (jarak < EDGE ? Math.ceil(MAX * (1 - Math.max(0, jarak) / EDGE)) : 0)

export default defineNuxtPlugin(() => {
  let kotak: HTMLElement | null = null
  let x = 0
  let y = 0
  let aktif = false
  let terakhir = 0
  let raf = 0

  function langkah() {
    raf = 0
    // dragover stops when the pointer leaves the window or the drag ends.
    if (!aktif || Date.now() - terakhir > 200) return
    if (kotak) {
      const r = kotak.getBoundingClientRect()
      if (y >= r.top - EDGE && y <= r.bottom + EDGE) {
        const kanan = laju(r.right - x)
        const kiri = laju(x - r.left)
        if (kanan) kotak.scrollLeft += kanan
        else if (kiri) kotak.scrollLeft -= kiri
      }
    }
    const bawah = laju(window.innerHeight - y)
    const atas = laju(y)
    if (bawah) window.scrollBy(0, bawah)
    else if (atas) window.scrollBy(0, -atas)
    raf = requestAnimationFrame(langkah)
  }

  function berhenti() {
    aktif = false
    kotak = null
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  document.addEventListener('dragstart', (e) => {
    const el = e.target instanceof HTMLElement ? e.target : null
    kotak = gulirSamping(el)
    aktif = true
  })
  document.addEventListener('dragover', (e) => {
    if (!aktif) return
    x = e.clientX
    y = e.clientY
    terakhir = Date.now()
    if (!raf) raf = requestAnimationFrame(langkah)
  })
  document.addEventListener('dragend', berhenti)
  document.addEventListener('drop', berhenti)
})
