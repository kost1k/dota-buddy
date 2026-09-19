<script setup lang="ts">
/**
 * Корень приложения. Ровно две обязанности: раздать токены темы как
 * CSS-переменные и отрисовать страницу.
 *
 * Фон прозрачный: оверлей живёт поверх игры в композиции стрима.
 */
const cssVars = themeCssVars()
</script>

<template>
  <div class="db-root" :style="cssVars">
    <NuxtPage />
  </div>
</template>

<style>
html,
body {
  margin: 0;
  padding: 0;
  background: transparent;
  overflow: hidden;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--db-ink);
}

.db-root {
  width: 100vw;
  height: 100vh;
}
</style>
