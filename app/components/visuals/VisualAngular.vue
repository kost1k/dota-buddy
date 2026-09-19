<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color } from 'three'
import { breathAmplitude, breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал 3: угловатость силуэта, без лица.
 *
 * Валентность ведёт остроту низкочастотного силуэта: собранная округлая
 * форма при приязни, рваная колючая при напряжении. Угловатые формы
 * читаются угрожающими, округлые тёплыми — эффект реальный, но скромный
 * (42% против 28%), и объяснение через угрозу провалило несколько прямых
 * проверок. Поэтому вариант и нужен: проверить, хватает ли этого.
 *
 * Силуэт — низкочастотный сигнал, а значит переживает и малый размер, и
 * сжатие, и решается за 150 мс.
 */

const props = defineProps<VisualProps>()

const rootRef = shallowRef()
const bodyRef = shallowRef()
const tint = new Color()

/** Базовые позиции вершин и шип на грань — считаются один раз. */
let base: Float32Array | null = null
let spikes: Float32Array | null = null

const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  const { valence, arousal, asleep } = props
  const sleepy = asleep ? 0.25 : 1
  const mesh = bodyRef.value
  if (!mesh)
    return

  tint.set(toHex(bodyColor(valence, arousal)))
  mesh.material.color.copy(tint)

  const attr = mesh.geometry.attributes.position
  if (!base) {
    base = new Float32Array(attr.array)
    // Шип привязан к ПОЛОЖЕНИЮ вершины, а не к её индексу. Геометрия
    // неиндексированная, поэтому одна и та же точка поверхности встречается
    // в нескольких треугольниках; если дать им разные смещения, соседние
    // грани разойдутся и в теле появятся сквозные дыры.
    spikes = new Float32Array(attr.count)
    const shared = new Map<string, number>()
    for (let i = 0; i < attr.count; i++) {
      const key = `${base[i * 3]!.toFixed(4)},${base[i * 3 + 1]!.toFixed(4)},${base[i * 3 + 2]!.toFixed(4)}`
      let s = shared.get(key)
      if (s === undefined) {
        s = Math.random()
        shared.set(key, s)
      }
      spikes[i] = s
    }
  }

  const spikiness = Math.max(0, -valence)
  const pulse = 1 + Math.sin(elapsed * breathHz(arousal) * Math.PI * 2) * breathAmplitude(arousal, 1) * sleepy

  for (let i = 0; i < attr.count; i++) {
    const k = (1 + spikes![i] * spikiness * 0.85) * pulse
    attr.array[i * 3] = base[i * 3] * k
    attr.array[i * 3 + 1] = base[i * 3 + 1] * k
    attr.array[i * 3 + 2] = base[i * 3 + 2] * k
  }
  attr.needsUpdate = true
  mesh.geometry.computeVertexNormals()

  const root = rootRef.value
  if (root)
    root.rotation.y = Math.sin(elapsed * (0.3 + arousal * 0.9)) * 0.3 * sleepy
})
</script>

<template>
  <TresGroup ref="rootRef">
    <TresMesh ref="bodyRef">
      <TresIcosahedronGeometry :args="[1, 3]" />
      <TresMeshStandardMaterial :roughness="0.55" :metalness="0.1" :flat-shading="true" />
    </TresMesh>
  </TresGroup>
</template>
