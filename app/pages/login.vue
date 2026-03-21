<!-- app/pages/login.vue -->
<script setup lang="ts">
definePageMeta({ layout: false })

const client = useSupabaseClient()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''

  const { error: authError } = await client.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  if (authError) {
    error.value = authError.message
  } else {
    // Full reload so the supabase module picks up the new session cookie
    reloadNuxtApp({ path: '/' })
  }

  loading.value = false
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-muted-100 dark:bg-muted-900">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-muted-800 dark:text-muted-100">uberclaude</h1>
        <p class="text-muted-400 mt-2">Project Brain Dashboard</p>
      </div>

      <BaseCard class="p-8">
        <form @submit.prevent="handleLogin">
          <BaseInput
            v-model="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            :disabled="loading"
          />
          <BaseInput
            v-model="password"
            type="password"
            label="Password"
            placeholder="Password"
            class="mt-4"
            :disabled="loading"
          />
          <div v-if="error" class="mt-2 text-danger-500 text-sm">{{ error }}</div>
          <BaseButton
            type="submit"
            color="primary"
            class="w-full mt-4"
            :loading="loading"
          >
            Sign In
          </BaseButton>
        </form>
      </BaseCard>
    </div>
  </div>
</template>
