// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@vueuse/nuxt',
  ],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  experimental: { serverAppConfig: false },
  nitro: {
    experimental: {
      websocket: true,
    },
  },
})
