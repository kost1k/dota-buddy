<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color } from 'three'
import { breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал 4: фазовая когерентность, без лица.
 *
 * Самая рискованная и самая интересная ставка набора.
 *
 * Разведка показала, что в движении валентность живёт ТОЛЬКО в
 * относительной фазе между частями: Pollick и др. разложили точечные
 * движения руки на естественные и с перемешанной фазой — перемешивание
 * сохранило структуру оси активации, но разрушило ось приятности. Amaya и
 * др. пришли к тому же независимо: сдвиг фаз между суставами различает
 * нейтральное и гневное движение.
 *
 * Все остальные безликие носители валентности либо нулевые (ускорение,
 * p=.478), либо немонотонные (кривизна траектории), либо с переворотом
 * знака (тон). Фаза — единственный поддержанный. И при этом на абстрактной
 * форме её НИКТО НЕ ПРОВЕРЯЛ: это непоставленный эксперимент.
 *
 * Валентность: согласованность фаз долей. Возбуждение: амплитуда и темп.
 */

const props = defineProps<VisualProps>()

const LOBES = [
  { position: [0, 0.46, 0] as const, radius: 0.62 },
  { position: [-0.46, -0.3, 0.12] as const, radius: 0.58 },
  { position: [0.46, -0.3, -0.12] as const, radius: 0.58 },
]

const rootRef = shallowRef()
const lobeRefs = ref<any[]>([])
const tint = new Color()

const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  const { valence, arousal, asleep } = props
  const sleepy = asleep ? 0.25 : 1

  tint.set(toHex(bodyColor(valence, arousal)))

  const omega = breathHz(arousal) * Math.PI * 2
  // Ядро варианта. При валентности +1 разброс фаз нулевой — доли дышат как
  // одно целое. При −1 разброс равен π — они тянут в противоположные
  // стороны, и тело читается как разлаженное.
  const spread = ((1 - valence) / 2) * Math.PI
  const amplitude = (0.05 + arousal * 0.16) * sleepy

  lobeRefs.value.forEach((lobe: any, i: number) => {
    if (!lobe)
      return
    lobe.material.color.copy(tint)
    const phase = elapsed * omega + i * spread
    const s = 1 + Math.sin(phase) * amplitude
    lobe.scale.set(s, s, s)
    const base = LOBES[i]!.position
    const push = 1 + Math.sin(phase) * amplitude * 0.8
    lobe.position.set(base[0] * push, base[1] * push, base[2] * push)
  })

  const root = rootRef.value
  if (root)
    root.rotation.y = Math.sin(elapsed * 0.35) * 0.2 * sleepy
})
</script>

<template>
  <TresGroup ref="rootRef">
    <TresMesh
      v-for="(lobe, i) in LOBES"
      :key="i"
      :ref="(el: any) => { if (el) lobeRefs[i] = el }"
      :position="lobe.position"
    >
      <TresIcosahedronGeometry :args="[lobe.radius, 2]" />
      <TresMeshStandardMaterial :roughness="0.6" :metalness="0.05" :flat-shading="true" />
    </TresMesh>
  </TresGroup>
</template>
