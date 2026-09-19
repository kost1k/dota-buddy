<script setup lang="ts">
/**
 * Оверлей — то, что открывается как Browser Source.
 *
 * Пока здесь только бадди. Периферия, справочная строка и эскалация
 * приходят на рубеже 3; позиционирование через query-параметр — там же.
 */
const { awake } = useOverlayLink()

// Единственный источник времени для аффекта. Раньше тик жил внутри
// существа — теперь визуалы чистые отрисовщики, и время идёт снаружи.
useAffectTicker()
</script>

<template>
  <main class="overlay">
    <BuddyStage :asleep="!awake" />
  </main>
</template>

<style scoped>
/*
 * Якорь задан в `theme.ts`, а не здесь: визуальные константы живут в одном
 * месте, иначе при переходе к пресетам позиций их придётся собирать обратно.
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
  padding: 0 var(--db-anchor-right) var(--db-anchor-bottom) 0;
  pointer-events: none;
}
</style>
