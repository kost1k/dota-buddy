// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@vueuse/nuxt',
    '@tresjs/nuxt',
  ],
  runtimeConfig: {
    gsiSecret: import.meta.env.NUXT_GSI_SECRET || '',
    logLevel: import.meta.env.NUXT_LOG_LEVEL || 'info',
    recordingsDir: import.meta.env.NUXT_RECORDINGS_DIR || 'recordings',
    public: {
      wsUrl: import.meta.env.NUXT_PUBLIC_WS_URL || 'ws://localhost:3000/ws',
      idleTimeoutMs: Number(import.meta.env.NUXT_PUBLIC_IDLE_TIMEOUT_MS || 15000),
    },
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  experimental: { serverAppConfig: false },
  nitro: {
    experimental: {
      websocket: true,
    },
  },
})
