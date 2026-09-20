<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color, Vector3 } from 'three'
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js'
import { breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал: кристалл. Угловатый полюс набора.
 *
 * Выпуклая оболочка над точками, закреплёнными на сфере: радиусы точек
 * ведёт валентность, и форма идёт от собранного многогранника к рваному
 * осколку. В отличие от смещения вершин по нормалям, комбинаторика
 * оболочки при этом остаётся устойчивой, поэтому переход непрерывен, а
 * поверхность не рвётся.
 *
 * Грани плоские и края чёткие — ровно тот регистр, который ADR-0003
 * называет безопасным, и который лучше всех переживает даунскейл.
 */

const props = defineProps<VisualProps>()

const POINTS = 26

const rootRef = shallowRef()
const meshRef = shallowRef()
const tint = new Color()

/** Направления фиксированы, меняются только радиусы: так оболочка не «прыгает». */
const directions = Array.from({ length: POINTS }, (_, i) => {
  // Спираль Фибоначчи — равномернее случайного разброса.
  const y = 1 - (i / (POINTS - 1)) * 2
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const phi = i * Math.PI * (3 - Math.sqrt(5))
  return new Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r)
})
const jitter = directions.map(() => 0.25 + Math.random() * 0.75)

let lastShards = -1

const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  const { valence, arousal, asleep } = props
  const sleepy = asleep ? 0.25 : 1
  const mesh = meshRef.value
  if (!mesh)
    return

  tint.set(toHex(bodyColor(valence, arousal)))
  mesh.material.color.copy(tint)

  // Пересобираем оболочку только при заметном изменении формы: замер
  // показал 0.027-0.039 мс на пересборку, но каждый кадр — это уже не шум.
  const shards = Math.round((1 - (valence + 1) / 2) * 48)
  if (shards !== lastShards) {
    lastShards = shards
    const spike = shards / 48
    // Разброс радиусов намеренно широкий: при малом контраст между
    // полюсами теряется и оба конца шкалы читаются одинаковым камнем.
    const points = directions.map((d, i) =>
      d.clone().multiplyScalar(0.5 + spike * jitter[i]! * 0.95),
    )
    mesh.geometry.dispose()
    mesh.geometry = new ConvexGeometry(points)
  }

  const root = rootRef.value
  if (!root)
    return
  const breath = Math.sin(elapsed * breathHz(arousal) * Math.PI * 2)
  const swell = 1 + breath * (0.02 + arousal * 0.07) * sleepy
  root.scale.set(swell, swell, swell)
  root.rotation.y += 0.0018 * (1 + arousal * 3) * sleepy
  root.rotation.x = Math.sin(elapsed * 0.28) * 0.14 * sleepy
})
</script>

<template>
  <TresGroup ref="rootRef">
    <TresMesh ref="meshRef">
      <TresIcosahedronGeometry :args="[1, 0]" />
      <TresMeshStandardMaterial :roughness="0.45" :metalness="0.2" :flat-shading="true" />
    </TresMesh>
  </TresGroup>
</template>
