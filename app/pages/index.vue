<script setup lang="ts">
/**
 * Оверлей — то, что открывается как Browser Source.
 *
 * Пока здесь только бадди. Периферия, справочная строка и эскалация
 * приходят на рубеже 3; позиционирование через query-параметр — там же.
 */
const { awake } = useOverlayLink()
</script>

<template>
  <main class="overlay">
    <BuddyStage :asleep="!awake" />
  </main>
</template>

<style scoped>
/*
 * Опорная зона — правый край выше окна стеша: центр кадра принадлежит игре.
 * Пока якорь один и зашит; пресеты через ?pos= появятся на рубеже 3.
 *
 * Полноэкранных слоёв здесь нет намеренно: постоянно смонтированный слой
 * стоит полного прохода композитора на каждом кадре, даже прозрачный.
 */
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 0 24px 140px 0;
  pointer-events: none;
}
</style>
