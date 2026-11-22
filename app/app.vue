<template>
  <UApp :toaster="{ position: 'top-center', max: 3 }">
    <NuxtPwaManifest />
    <AppModeUji />
    <AppProses />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
