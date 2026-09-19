<script setup lang="ts">
/**
 * Сцена бадди: ровно один канвас на весь оверлей.
 *
 * В прототипе `BuddyScene` монтировался дважды ради отладки — два контекста
 * WebGL и два цикла рендера впустую. Этот компонент существует в
 * единственном экземпляре, и так и должно остаться.
 *
 * Прозрачность требует ОБОИХ флагов: `alpha` даёт буферу альфа-канал, но
 * очистка всё равно идёт с `clearAlpha = 1`, и канвас выходит чёрным
 * квадратом поверх игры. Без `clear-alpha="0"` оверлей закрывает кадр.
 */

const props = defineProps<{ asleep: boolean }>()

const probed = ref(false)
const hasWebgl = ref(false)

onMounted(() => {
  hasWebgl.value = isWebglAvailable()
  probed.value = true

  if (!hasWebgl.value)
    console.warn('[dota-buddy] WebGL недоступен — сцена не поднята')
})

/**
 * Во сне рендер реально замедляется, а не просто успокаивается визуально.
 * Полностью останавливать нельзя: бадди не исчезает между матчами, иначе
 * теряется непрерывность присутствия.
 */
const fpsLimit = computed(() => (props.asleep ? theme.scene.sleepFps : undefined))
</script>

<template>
  <div class="stage">
    <TresCanvas
      v-if="probed && hasWebgl"
      alpha
      :clear-alpha="0"
      :dpr="theme.scene.dpr"
      :fps-limit="fpsLimit"
      :window-size="false"
      render-mode="always"
    >
      <TresPerspectiveCamera :position="[0, 0, 4.5]" />
      <BuddyCreature :asleep="asleep" />
      <TresAmbientLight :intensity="0.55" />
      <TresDirectionalLight :position="[2, 2, 3]" :intensity="1.4" />
    </TresCanvas>
  </div>
</template>

<style scoped>
.stage {
  width: var(--db-scene-size);
  height: var(--db-scene-size);
}
</style>
