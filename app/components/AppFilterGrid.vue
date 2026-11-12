<!--
  The old filter block: fields in a wrapping grid, each label in small grey
  capitals (deploy/reservasi/index.html:5424-5455). Put plain <UFormField>s in it;
  the label style is applied here so pages stay plain Nuxt UI.

  The fields share the whole row (auto-fit, never narrower than 170px) and each
  control fills its column — selects, dates and inputs stretch, and a segmented
  tab (AppSeg) spreads its options evenly — so a panel never shows a cluster of
  small fields on the left and empty space on the right.
-->
<template>
  <div
    class="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))] lg:gap-x-4
      [&_label]:text-[11px] [&_label]:font-bold [&_label]:uppercase [&_label]:tracking-wider [&_label]:text-muted
      [&_[data-slot=root]>div:not([data-slot])>*]:w-full
      [&_[role=tablist]]:flex-nowrap [&_[role=tablist]>button]:flex-1 [&_[role=tablist]>button]:justify-center"
  >
    <slot />
  </div>
</template>
