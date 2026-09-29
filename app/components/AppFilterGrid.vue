<!--
  The old filter block: fields in a wrapping grid, each label in small grey
  capitals (deploy/reservasi/index.html:5424-5455). Put plain <UFormField>s in it;
  the label style is applied here so pages stay plain Nuxt UI.
-->
<template>
  <div class="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] [&_label]:text-[11px] [&_label]:font-bold [&_label]:uppercase [&_label]:tracking-wider [&_label]:text-muted">
    <slot />
  </div>
</template>
