<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color } from 'three'
import { breathAmplitude, breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал 2: только рот, без глаза.
 *
 * Краевой случай. Снимает ассоциацию со слежкой по построению — нет глаза,
 * нет наблюдателя, — и при этом держит лучший носитель валентности в
 * одиночку: кривизна рта читается при 15×10 px, а радость и удивление
 * узнаются на 95-99% при любом проверенном разрешении.
 *
 * Проверяет, нужен ли глаз вообще.
 */

const props = defineProps<VisualProps>()
const SEGMENTS = 13
const MOUTH_R = 1.03

const rootRef = shallowRef()
const bodyRef = shallowRef()
const mouthRef = shallowRef()
const tint = new Color()

const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  const { valence, arousal, asleep } = props
  const sleepy = asleep ? 0.25 : 1

  tint.set(toHex(bodyColor(valence, arousal)))
  if (bodyRef.value)
    bodyRef.value.material.color.copy(tint)

  // Рот крупнее, чем в варианте с глазом: он здесь единственная черта и
  // может занять весь бюджет внимания.
  if (mouthRef.value) {
    const curve = valence * 0.5
    // Раскрытие рта берёт на себя роль века: возбуждение видно по тому,
    // насколько широко он раскрыт.
    const open = 0.06 + arousal * 0.34
    mouthRef.value.children.forEach((seg: any, i: number) => {
      const t = (i / (SEGMENTS - 1)) * 2 - 1
      const x = t * 0.58
      const y = curve * t * t - curve * 0.5
      // Проекция на поверхность — та же причина, что в варианте с глазом:
      // на постоянной глубине середина рта утопает в теле.
      seg.position.set(x, y, Math.sqrt(Math.max(0.04, MOUTH_R * MOUTH_R - x * x - y * y)))
      seg.scale.y = open / 0.1
      seg.rotation.set(-y * 0.8, x * 0.9, -curve * 2 * t * 0.55)
    })
  }

  const root = rootRef.value
  if (root) {
    const hz = breathHz(arousal)
    const amp = breathAmplitude(arousal, 1) * sleepy
    const breath = Math.sin(elapsed * hz * Math.PI * 2)
    root.position.y = breath * amp
    const swell = 1 + breath * amp * 0.4
    root.scale.set(swell, swell, swell)
    root.rotation.y = Math.sin(elapsed * 0.4) * 0.16 * sleepy
  }
})
</script>

<template>
  <TresGroup ref="rootRef">
    <TresMesh ref="bodyRef">
      <TresIcosahedronGeometry :args="[1, 2]" />
      <TresMeshStandardMaterial :roughness="0.6" :metalness="0.05" :flat-shading="true" />
    </TresMesh>

    <TresGroup ref="mouthRef">
      <TresMesh v-for="i in SEGMENTS" :key="i">
        <TresBoxGeometry :args="[0.12, 0.1, 0.12]" />
        <TresMeshStandardMaterial :color="theme.creature.iris" :roughness="0.6" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
