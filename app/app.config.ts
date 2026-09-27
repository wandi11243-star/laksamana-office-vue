// Nuxt UI defaults for the Laksamana look. Change the look here, not in pages.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'laksamana',
      neutral: 'ink',
    },
    button: {
      slots: { base: 'font-semibold' },
      // Black text on the yellow: white on yellow fails contrast.
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: 'text-ink-950 hover:bg-primary-400 active:bg-primary-600' },
      ],
    },
    // Active menu item: ink, not yellow text (yellow text fails contrast on white).
    navigationMenu: {
      compoundVariants: [
        { orientation: 'vertical', active: true, class: { link: 'text-highlighted font-semibold before:bg-elevated', linkLeadingIcon: 'text-highlighted' } },
      ],
    },
    avatar: {
      variants: { color: { neutral: { root: 'bg-inverted', fallback: 'text-inverted font-semibold' } } },
    },
    card: {
      slots: { root: 'rounded-2xl ring-0' },
    },
    modal: {
      slots: { content: 'rounded-2xl ring-0' },
    },
    drawer: {
      slots: { content: 'ring-0' },
    },
    table: {
      slots: { th: 'font-semibold text-muted', td: 'num' },
    },
  },
})
