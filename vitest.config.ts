import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      // Тот же алиас, что даёт Nuxt. Без него серверные модули не
      // импортируются в тестах, а именно там живёт вывод событий — самая
      // ошибкоёмкая часть системы.
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
})
