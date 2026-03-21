export default defineNuxtConfig({
  modules: [
    '@shuriken-ui/nuxt',
    '@nuxtjs/supabase',
  ],
  css: [
    '~/assets/css/main.css',
  ],
  supabase: {
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: [],
    },
  },
  devtools: { enabled: false },
  devServer: { port: 3100 },
  compatibilityDate: '2025-01-01',
})
