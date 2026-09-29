// Nuxt UI defaults for the Laksamana look (the old Office's layout, DESIGN.md).
// Change the look here, not in pages.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'laksamana',
      neutral: 'ink',
    },
    button: {
      slots: { base: 'font-semibold rounded-field' },
      compoundVariants: [
        // White on the button gold passes AA (4.9:1); the old gradient did not.
        { color: 'primary', variant: 'solid', class: 'text-white hover:bg-primary-700 active:bg-primary-800 dark:text-ink-950 dark:hover:bg-primary-300' },
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
    // The old sidebar: gold-soft fill, gold words, a 3px gold bar on the left.
    navigationMenu: {
      slots: { link: 'rounded-field py-2' },
      compoundVariants: [
        { orientation: 'vertical', active: true, class: {
          link: 'text-primary-700 dark:text-primary-300 font-semibold before:bg-primary-100 dark:before:bg-primary-950 after:absolute after:inset-y-2 after:start-0 after:w-[3px] after:rounded-full after:bg-primary-400',
          linkLeadingIcon: 'text-primary-700 dark:text-primary-300',
        } },
      ],
    },
    avatar: {
      variants: { color: { neutral: { root: 'bg-primary-600 rounded-field', fallback: 'text-white font-bold' } } },
    },
    card: {
      slots: { root: 'rounded-panel ring-1 ring-default shadow-panel' },
    },
    modal: {
      slots: { content: 'rounded-panel ring-0' },
    },
    drawer: {
      slots: { content: 'ring-0' },
    },
    // The old data table: a dark head with white capitals, roomy rows.
    table: {
      slots: {
        thead: 'bg-table-head',
        th: 'text-table-head-text text-xs font-semibold uppercase tracking-wide py-3 whitespace-nowrap',
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
