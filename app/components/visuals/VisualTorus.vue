<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color } from 'three'
import { breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал: кольцо.
 *
 * Единственная форма набора с ДЫРОЙ в силуэте, и потому самая
 * низкочастотная. Это не украшение: на 135 px и на телефоне всё решает
 * низкая пространственная частота, а замкнутый контур с отверстием
 * различим там, где сплошное пятно уже превращается в кляксу.
 *
 * Валентность ведёт толщину: тонкое лёгкое кольцо при приязни, тяжёлое и
 * заплывшее при напряжении. Узел вместо тора здесь не годится — он
 * читается клубком, а не кольцом, и отверстие пропадает.
 */

const props = defineProps<VisualProps>()

const rootRef = shallowRef()
const ringRef = shallowRef()
const tint = new Color()

/** Толщина трубки: тонкое кольцо читается спокойнее толстого. */
const tube = computed(() => 0.16 + (1 - (props.valence + 1) / 2) * 0.2)

const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  const { valence, arousal, asleep } = props
  const sleepy = asleep ? 0.25 : 1

  tint.set(toHex(bodyColor(valence, arousal)))
  if (ringRef.value)
    ringRef.value.material.color.copy(tint)

  const root = rootRef.value
  if (!root)
    return

  const breath = Math.sin(elapsed * breathHz(arousal) * Math.PI * 2)
  const swell = 1 + breath * (0.025 + arousal * 0.08) * sleepy
  root.scale.set(swell, swell, swell)

  // Наклон вместо вращения в плоскости: плоское кольцо анфас теряет
  // отверстие, а отверстие здесь — весь смысл формы.
  root.rotation.x = 0.42 + Math.sin(elapsed * 0.35) * 0.12 * sleepy
  root.rotation.y += 0.0022 * (1 + arousal * 3.5) * sleepy
})
</script>

<template>
  <TresGroup ref="rootRef">
    <TresMesh ref="ringRef">
      <TresTorusGeometry :args="[0.82, tube, 20, 96]" />
      <TresMeshStandardMaterial :roughness="0.5" :metalness="0.15" :flat-shading="false" />
    </TresMesh>
  </TresGroup>
</template>
