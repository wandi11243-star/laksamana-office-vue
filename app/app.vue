<template>
  <UApp :toaster="{ position: 'top-center' }">
    <NuxtPwaManifest />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
