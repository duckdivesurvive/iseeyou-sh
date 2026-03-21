<!-- app/pages/confirm.vue -->
<script setup lang="ts">
definePageMeta({ layout: false })
// Supabase module handles the token exchange automatically
// Just redirect to home after a moment
onMounted(() => {
  setTimeout(() => navigateTo('/'), 1000)
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-muted-100 dark:bg-muted-900">
    <p class="text-muted-400">Confirming... redirecting.</p>
  </div>
</template>
