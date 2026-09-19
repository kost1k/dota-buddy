<script setup lang="ts">
import type { VisualId, VisualProps } from '#shared/visual'
import { VISUALS } from '#shared/visual'
import VisualAngular from './visuals/VisualAngular.vue'
import VisualEyeMouth from './visuals/VisualEyeMouth.vue'
import VisualFlat from './visuals/VisualFlat.vue'
import VisualMouthOnly from './visuals/VisualMouthOnly.vue'
import VisualPhase from './visuals/VisualPhase.vue'

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
  eyeMouth: VisualEyeMouth,
  mouthOnly: VisualMouthOnly,
  angular: VisualAngular,
  phase: VisualPhase,
  flat: VisualFlat,
}

const { visualId } = useVisual()
const { state } = useAffect()

const meta = computed(() => VISUALS[visualId.value])
const visual = computed(() => REGISTRY[visualId.value])

const visualProps = computed<VisualProps>(() => ({
  valence: state.value.valence,
  arousal: state.value.arousal,
  // Вехи, эскалация и события — рубеж 3. Поля есть в контракте уже сейчас,
  // чтобы их появление не потребовало трогать пять визуалов.
  milestones: 0,
  escalationTier: null,
  event: null,
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
    <component :is="visual" v-if="meta.kind === 'dom'" v-bind="visualProps" />

    <TresCanvas
      v-else-if="probed && hasWebgl"
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
