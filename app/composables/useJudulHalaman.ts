/**
 * The current page's title, shared between AppPage (which sets it) and the
 * layout's top bar (which shows it beside the sidebar toggle on desktop, as
 * in the old Office). Empty on pages that don't use AppPage.
 */
export function useJudulHalaman() {
  return useState<string>('judul-halaman', () => '')
}
