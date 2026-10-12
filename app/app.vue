<template>
  <UApp :toaster="{ position: 'top-center', max: 3 }">
    <NuxtPwaManifest />
    <AppModeUji />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
