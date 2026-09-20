<script setup lang="ts">
import type { VisualId, VisualProps } from '#shared/visual'
import VisualCrystal from './visuals/VisualCrystal.vue'
import VisualEye from './visuals/VisualEye.vue'
import VisualMetaballs from './visuals/VisualMetaballs.vue'
import VisualSupershape from './visuals/VisualSupershape.vue'
import VisualTorus from './visuals/VisualTorus.vue'

/**
 * Сцена бадди: ровно один канвас на весь оверлей, и ровно один визуал
 * внутри.
 *
 * Компонент собирает контракт `VisualProps` из состояния и отдаёт его
 * выбранному визуалу. Сами визуалы состояние не читают и не двигают —
 * тикает его `useAffectTicker`, а транспорт живёт в `useOverlayLink`.
 * Благодаря этому новый визуал — один файл, а новый канал добавляется в
 * контракт один раз, а не в каждый визуал.
 *
 * Прозрачность требует ОБОИХ флагов: `alpha` даёт буферу альфа-канал, но
 * очистка всё равно идёт с `clearAlpha = 1`, и канвас выходит чёрным
 * квадратом поверх игры.
 */

const props = defineProps<{ asleep: boolean }>()

const REGISTRY: Record<VisualId, Component> = {
  eye: VisualEye,
  supershape: VisualSupershape,
  torus: VisualTorus,
  metaballs: VisualMetaballs,
  crystal: VisualCrystal,
}

const { visualId } = useVisual()
const { state, impulse } = useAffect()
const { lastEvent, milestones, level } = useReactions()

const visual = computed(() => REGISTRY[visualId.value])

const visualProps = computed<VisualProps>(() => ({
  valence: state.value.valence,
  arousal: state.value.arousal,
  impulse: impulse.value,
  event: lastEvent.value,
  milestones: milestones.value,
  level: level.value,
  asleep: props.asleep,
}))

const probed = ref(false)
const hasWebgl = ref(false)

onMounted(() => {
  hasWebgl.value = isWebglAvailable()
  probed.value = true
  if (!hasWebgl.value)
    console.warn('[dota-buddy] WebGL недоступен — объёмные визуалы не поднимутся')
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
      <TresPerspectiveCamera :position="[0, 0, 4.2]" />
      <component :is="visual" v-bind="visualProps" />
      <TresAmbientLight :intensity="0.6" />
      <TresDirectionalLight :position="[2, 2.5, 3]" :intensity="1.3" />
    </TresCanvas>
  </div>
</template>

<style scoped>
.stage {
  width: var(--db-scene-size);
  height: var(--db-scene-size);
}
</style>
