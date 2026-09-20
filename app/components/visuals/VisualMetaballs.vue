<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { MarchingCube, MarchingCubes } from '@tresjs/cientos'
import { useLoop } from '@tresjs/core'
import { Color } from 'three'
import { clampAffect } from '#shared/affect'
import { breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал: метасферы. Слияние против распада.
 *
 * Единственный вариант набора, где выразительной становится САМА
 * ТОПОЛОГИЯ: при приязни доли сливаются в одно тело, при напряжении
 * расходятся и тело буквально разваливается на части.
 *
 * Это развитие идеи фазовой когерентности. Разведка показала, что в
 * движении валентность устойчиво несёт только относительная фаза между
 * частями — но на абстрактной форме этого никто не проверял. Здесь фаза
 * видна не как тонкое различие в ритме, а как связность или её потеря.
 *
 * Разрешение поля намеренно низкое: стоимость растёт как куб, а на 135 px
 * разница между 28 и 64 неразличима.
 */

const props = defineProps<VisualProps>()

const LOBES = 4
/**
 * Масштаб группы. `MarchingCube` пересчитывает МИРОВУЮ позицию в координаты
 * поля как `0.5 + world · 0.5`, поэтому мировые координаты долей обязаны
 * лежать в пределах ±1 — иначе они выпадают из поля и не рисуется ничего.
 * Локальные позиции задаём как желаемые мировые, делённые на этот масштаб.
 */
const SCALE = 2.4
const cubesRef = shallowRef()
const lobeRefs = ref<any[]>([])
const tint = new Color()

const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  const { asleep } = props
  const { valence, arousal } = clampAffect({
    valence: props.valence + props.impulse.valence,
    arousal: props.arousal + props.impulse.arousal,
  })
  const sleepy = asleep ? 0.25 : 1

  tint.set(toHex(bodyColor(valence, arousal)))
  const field = cubesRef.value?.instance ?? cubesRef.value
  if (field?.material?.color)
    field.material.color.copy(tint)

  // Ядро варианта: расхождение долей. При валентности +1 они сидят почти в
  // одной точке и поле сливает их в одно тело; при −1 расходятся настолько,
  // что перемычки рвутся.
  const spread = 0.12 + (1 - (valence + 1) / 2) * 0.5
  const omega = breathHz(arousal) * Math.PI * 2
  const wobble = (0.02 + arousal * 0.1) * sleepy

  lobeRefs.value.forEach((lobe: any, i: number) => {
    if (!lobe)
      return
    const angle = (i / LOBES) * Math.PI * 2 + elapsed * 0.25 * (1 + arousal) * sleepy
    const phase = elapsed * omega + i * (Math.PI / 2)
    const r = spread + Math.sin(phase) * wobble
    lobe.position.set(
      (Math.cos(angle) * r) / SCALE,
      (Math.sin(angle) * r * 0.8) / SCALE,
      (Math.sin(angle * 1.7) * r * 0.5) / SCALE,
    )
  })
})
</script>

<template>
  <TresGroup :scale="SCALE">
    <MarchingCubes ref="cubesRef" :resolution="28" :max-poly-count="8000">
      <TresMeshStandardMaterial :roughness="0.5" :metalness="0.1" />
      <MarchingCube
        v-for="i in LOBES"
        :key="i"
        :ref="(el: any) => { if (el) lobeRefs[i - 1] = el.instance ?? el }"
        :strength="0.55"
        :subtract="8"
      />
    </MarchingCubes>
  </TresGroup>
</template>
