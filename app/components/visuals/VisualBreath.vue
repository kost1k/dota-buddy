<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color } from 'three'
import { breathAmplitude, breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал: только дыхание и цвет. Нижняя граница набора.
 *
 * Формы не меняется вовсе, черт нет, движение сведено к дыханию. Остаются
 * ровно два канала — светлота под валентность и темп с амплитудой под
 * возбуждение, — то есть теоретический минимум, который вообще способен
 * нести две оси.
 *
 * Вариант нужен как контроль снизу: если он в эфире удержит внимание не
 * хуже остальных, значит вся работа над формой не окупается, и это лучше
 * узнать дёшево. Разведка по вниманию на стриме делает такой исход
 * правдоподобнее, чем хотелось бы: бюджет прямого взгляда — одна-две
 * минуты за трёхчасовой эфир, и почти всё читается периферийно.
 */

const props = defineProps<VisualProps>()

const rootRef = shallowRef()
const bodyRef = shallowRef()
const tint = new Color()

const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  const { valence, arousal, asleep } = props
  const sleepy = asleep ? 0.25 : 1

  tint.set(toHex(bodyColor(valence, arousal)))
  if (bodyRef.value)
    bodyRef.value.material.color.copy(tint)

  const root = rootRef.value
  if (!root)
    return

  const breath = Math.sin(elapsed * breathHz(arousal) * Math.PI * 2)
  const amp = breathAmplitude(arousal, 1) * sleepy
  // Дыхание идёт объёмом, а не смещением: перемещение разрушает ощущение
  // намерения и раздражает сильнее любого привязанного колебания.
  const swell = 1 + breath * amp * 0.9
  root.scale.set(swell, swell * (1 - breath * amp * 0.25), swell)
  root.rotation.y += 0.0009 * (1 + arousal * 2) * sleepy
})
</script>

<template>
  <TresGroup ref="rootRef">
    <TresMesh ref="bodyRef">
      <TresIcosahedronGeometry :args="[1, 3]" />
      <TresMeshStandardMaterial :roughness="0.6" :metalness="0.05" />
    </TresMesh>
  </TresGroup>
</template>
