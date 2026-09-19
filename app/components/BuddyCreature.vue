<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Color } from 'three'

/**
 * ЗАГЛУШКА. Настоящее существо с глазом — тикет 04.
 *
 * Здесь минимальное тело, которое доказывает, что связка работает: аффект
 * тикает, обе оси доходят до сцены и видны раздельно. Валентность ведёт
 * цвет, возбуждение — скорость. Ни формы, ни глаза, ни характера тут нет и
 * быть не должно: они проектируются отдельно.
 */

const props = defineProps<{ asleep: boolean }>()

const { state, tick } = useAffect()

const bodyRef = shallowRef()

const low = new Color(theme.color.valenceLow)
const high = new Color(theme.color.valenceHigh)
const tint = new Color()

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta }) => {
  // Дельта берётся из цикла TresJS, а не из собственных часов: под капотом
  // там THREE.Timer, подключённый к Page Visibility API. Когда страница
  // скрыта (OBS увёл сцену, вкладка в фоне), он останавливается и при
  // возврате не выдаёт накопленный провал одним куском. Собственный
  // performance.now() этого не умеет.
  tick(delta)

  const body = bodyRef.value
  if (!body)
    return

  const { valence, arousal } = state.value

  // Валентность: −1..1 -> 0..1 для смешивания цвета.
  tint.copy(low).lerp(high, (valence + 1) / 2)
  body.material.color.copy(tint)

  // Возбуждение ведёт скорость и амплитуду. Во сне движение почти замирает.
  const liveliness = props.asleep ? 0.15 : 1
  body.rotation.y += delta * (0.2 + arousal * 1.8) * liveliness
  body.rotation.x += delta * (0.05 + arousal * 0.4) * liveliness
})
</script>

<template>
  <TresMesh ref="bodyRef">
    <TresIcosahedronGeometry :args="[1, 0]" />
    <TresMeshStandardMaterial :roughness="0.45" :metalness="0.25" :flat-shading="true" />
  </TresMesh>
</template>
