<template>
  <UApp :toaster="{ position: 'top-center' }">
    <NuxtPwaManifest />
    <AppModeUji />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
