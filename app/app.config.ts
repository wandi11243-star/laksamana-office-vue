// Nuxt UI defaults for the Miro look (Plan A token-bridge, DESIGN.md).
// Change the look here, not in pages.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'ink',
      neutral: 'ink',
    },
    button: {
      slots: { base: 'font-semibold rounded-field' },
      compoundVariants: [
        // Black-pill primary CTA (Miro): white on ink-900.
        { color: 'primary', variant: 'solid', class: 'text-white bg-ink-900 hover:bg-ink-800 rounded-full' },
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
      slots: { label: 'font-semibold text-highlighted' },
    },
    // Active item: canary-tint fill, dark yellow words, a 3px canary bar.
    navigationMenu: {
      slots: { link: 'rounded-field py-2' },
      compoundVariants: [
        { orientation: 'vertical', active: true, class: {
          link: 'bg-yellow-light text-yellow-dark font-semibold before:bg-yellow-light after:absolute after:inset-y-2 after:start-0 after:w-[3px] after:rounded-full after:bg-yellow-deep',
          linkLeadingIcon: 'text-yellow-dark',
        } },
      ],
    },
    avatar: {
      variants: { color: { neutral: { root: 'bg-ink-900 text-white rounded-full', fallback: 'text-white font-bold' } } },
    },
    card: {
      slots: { root: 'rounded-[28px] ring-1 ring-default shadow-panel' },
    },
    modal: {
      slots: { content: 'rounded-[28px] ring-0' },
    },
    drawer: {
      slots: { content: 'ring-0' },
    },
    // Miro data table: soft muted head, slate words (no steel scale in theme,
    // so text-muted + bg-muted), roomy rows.
    table: {
      slots: {
        thead: 'bg-muted',
        th: 'text-muted text-xs font-semibold uppercase tracking-wide py-3 whitespace-nowrap',
        td: 'num py-3 text-default align-middle',
        tr: 'hover:bg-muted/60',
      },
    },
    badge: {
      slots: { base: 'rounded-full font-semibold' },
    },
    tabs: {
      slots: { list: 'rounded-full', indicator: 'rounded-full', trigger: 'rounded-full font-semibold' },
    },
  },
})
