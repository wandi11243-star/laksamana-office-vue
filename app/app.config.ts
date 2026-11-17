// Nuxt UI defaults for the Laksamana look (DESIGN.md): light, technical,
// gold-accented. Change the look here, not in pages.
export default defineAppConfig({
  ui: {
    colors: {
      // The old Office gold ramp (--color-laksamana-* in main.css); --ui-primary
      // itself is pinned to the deep gold #85600F for AA contrast.
      primary: 'laksamana',
      neutral: 'ink',
    },
    button: {
      slots: { base: 'font-semibold rounded-field' },
      compoundVariants: [
        // Gold action button: white on deep gold, a shade darker on hover.
        { color: 'primary', variant: 'solid', class: 'text-white bg-primary shadow-md shadow-laksamana-600/25 hover:bg-laksamana-700 active:bg-laksamana-800' },
        // Secondary (WattVision "Last 24 Hours"): a grey tile with gold words.
        { color: 'neutral', variant: 'soft', class: 'bg-shell text-gold-deep hover:bg-ink-200' },
        { color: 'neutral', variant: 'outline', class: 'ring-default bg-default hover:bg-muted' },
      ],
    },
    input: {
      slots: { base: 'rounded-field' },
    },
    select: {
      slots: { base: 'rounded-field' },
    },
    selectMenu: {
      slots: { base: 'rounded-field' },
    },
    textarea: {
      slots: { base: 'rounded-field' },
    },
    formField: {
      // The hint wraps under a long label instead of pushing the field (and the
      // dialog around it) wider than the screen.
      slots: { label: 'font-semibold text-highlighted', labelWrapper: 'flex-wrap gap-x-3', hint: 'min-w-0' },
    },
    // WattVision sidebar: the active item is a white card with a soft shadow on
    // the shell, words and icon in deep gold; others are muted, whiten on hover.
    navigationMenu: {
      slots: { list: 'flex flex-col gap-1', link: 'rounded-field px-4 py-2.5 hover:before:bg-default/60' },
      compoundVariants: [
        // Long labels ("Check-in Penerimaan", "Kelola Akses Ordering") wrap to a
        // second line instead of being cut with an ellipsis.
        { orientation: 'vertical', class: { linkLabel: 'whitespace-normal text-left leading-snug' } },
        { orientation: 'vertical', active: true, class: {
          link: 'text-gold-deep font-semibold before:bg-default before:shadow-panel',
          linkLeadingIcon: 'text-gold-deep',
        } },
      ],
    },
    avatar: {
      variants: { color: { neutral: { root: 'bg-ink-900 text-white rounded-full', fallback: 'text-white font-bold' } } },
    },
    card: {
      slots: { root: 'rounded-panel ring-1 ring-default shadow-panel' },
    },
    // Pop-ups stand apart from the page: a dark, lightly blurred overlay and a
    // deep shadow, so the white dialog never melts into the white cards behind.
    // The body never scrolls sideways — content wraps instead.
    modal: {
      slots: {
        overlay: 'backdrop-blur-[2px]',
        content: 'rounded-panel ring-0 shadow-2xl shadow-ink-900/30',
        body: 'overflow-x-hidden',
      },
      // The modal's overlay colour lives in its `overlay` variant (applied after
      // the slots), so the dark tint must be set there or the light default wins.
      variants: { overlay: { true: { overlay: 'bg-ink-900/55' } } },
    },
    slideover: {
      slots: { overlay: 'bg-ink-900/55 backdrop-blur-[2px]', content: 'ring-0 shadow-2xl shadow-ink-900/30', body: 'overflow-x-hidden' },
    },
    drawer: {
      slots: { overlay: 'bg-ink-900/55 backdrop-blur-[2px]', content: 'ring-0 shadow-2xl shadow-ink-900/30', body: 'overflow-x-hidden' },
    },
    // Data table (DESIGN.md › Tabel): muted capital head, a hairline under
    // every row, a quiet hover.
    table: {
      slots: {
        thead: 'bg-muted',
        th: 'text-muted text-xs font-semibold uppercase tracking-wide py-3 whitespace-nowrap',
        td: 'num py-3 text-default align-middle',
        tr: 'border-b border-default hover:bg-muted/70',
      },
    },
    badge: {
      slots: { base: 'rounded-md font-semibold' },
    },
    tabs: {
      slots: { list: 'rounded-field', indicator: 'rounded-[8px]', trigger: 'rounded-[8px] font-semibold' },
    },
  },
})
