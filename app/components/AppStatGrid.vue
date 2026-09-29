<!-- The old recap row: as many stat cards as fit, at least 150px each. -->
<template>
  <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
    <slot />
  </div>
</template>
