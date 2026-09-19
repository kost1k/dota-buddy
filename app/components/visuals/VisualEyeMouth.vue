<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color } from 'three'
import { breathAmplitude, breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал 1: глаз и рот.
 *
 * Самый обоснованный вариант. Omer и др. (2019) измерили, что делает форму
 * лицом: значимы ТОЛЬКО глаза (β=.49) и рот (β=.27), 92% дисперсии; без
 * рта форма остаётся глазком-отпугивателем, а не лицом. Рот при этом ещё и
 * №1 носитель валентности и читается при 15×10 px.
 *
 * Валентность: кривизна рта (основной) + светлота тела.
 * Возбуждение: раскрытие век + дыхание + тон.
 */

const props = defineProps<VisualProps>()

const EYE_Z = 0.5
const EYE_R = 0.5
const LID_R = 0.62
const MOUTH_SEGMENTS = 9
/** Радиус, на котором лежит рот: чуть больше тела, чтобы не утопал. */
const MOUTH_R = 1.03

const rootRef = shallowRef()
const bodyRef = shallowRef()
const upperLidRef = shallowRef()
const lowerLidRef = shallowRef()
const irisRef = shallowRef()
const mouthRef = shallowRef()

const tint = new Color()
let blinkCountdown = 2.5
let blinkProgress = 1

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta, elapsed }) => {
  const { valence, arousal, asleep } = props
  const sleepy = asleep ? 0.25 : 1

  tint.set(toHex(bodyColor(valence, arousal)))
  if (bodyRef.value)
    bodyRef.value.material.color.copy(tint)
  if (upperLidRef.value)
    upperLidRef.value.material.color.copy(tint)
  if (lowerLidRef.value)
    lowerLidRef.value.material.color.copy(tint)

  // --- моргание: прерывает взгляд и работает признаком живого ---
  blinkCountdown -= delta
  if (blinkCountdown <= 0) {
    blinkProgress = 0
    blinkCountdown = (4.5 - arousal * 2.2) * (0.7 + Math.random() * 0.6)
  }
  if (blinkProgress < 1)
    blinkProgress = Math.min(1, blinkProgress + delta / 0.16)
  const blink = Math.sin(Math.PI * blinkProgress)

  // --- веки: раскрытие ведёт возбуждение ---
  // Склеру кольцом вокруг зрачка показываем только на негативном пике:
  // белки вокруг радужки — прямой сигнал страха, и в покое он ложный.
  const aperture = (0.2 + arousal * 1.0) * (1 - blink) * sleepy
  if (upperLidRef.value)
    upperLidRef.value.rotation.x = -aperture * (1 - Math.max(0, -valence) * 0.2)
  if (lowerLidRef.value)
    lowerLidRef.value.rotation.x = aperture * (1 - Math.max(0, valence) * 0.35)

  if (irisRef.value)
    irisRef.value.scale.set(1, 1, 0.3)

  // --- рот: кривизна ведёт валентность ---
  // Сегменты по параболе: концы вверх — приязнь, вниз — напряжение.
  // Опущенная V под глазом — преаттентивная форма угрозы, поэтому в
  // положительной половине её быть не должно.
  if (mouthRef.value) {
    const curve = valence * 0.34
    mouthRef.value.children.forEach((seg: any, i: number) => {
      const t = (i / (MOUTH_SEGMENTS - 1)) * 2 - 1
      const x = t * 0.46
      const y = -0.5 + curve * t * t - curve * 0.5
      // Сегменты проецируются НА ПОВЕРХНОСТЬ тела, а не ставятся на
      // постоянную глубину: поверхность изогнута, и при сильном изгибе
      // середина рта уходит внутрь сферы — видны только концы.
      seg.position.set(x, y, Math.sqrt(Math.max(0.04, MOUTH_R * MOUTH_R - x * x - y * y)))
      seg.rotation.set(-y * 0.8, x * 0.9, -curve * 2 * t * 0.6)
    })
  }

  // --- движение: только возбуждение (ускорение → возбуждение, ηp²=.870) ---
  const root = rootRef.value
  if (root) {
    const hz = breathHz(arousal)
    const amp = breathAmplitude(arousal, 1) * sleepy
    const breath = Math.sin(elapsed * hz * Math.PI * 2)
    root.position.y = breath * amp
    const swell = 1 + breath * amp * 0.35
    root.scale.set(swell, swell, swell)
    // Привязан, не перемещается: блуждание разрушает ощущение намерения
    // и раздражает сильнее любого привязанного колебания.
    root.rotation.y = Math.sin(elapsed * 0.4) * 0.18 * sleepy
  }
})
</script>

<template>
  <TresGroup ref="rootRef">
    <TresMesh ref="bodyRef">
      <TresIcosahedronGeometry :args="[1, 2]" />
      <TresMeshStandardMaterial :roughness="0.6" :metalness="0.05" :flat-shading="true" />
    </TresMesh>

    <TresGroup :position="[0, 0.22, EYE_Z]">
      <TresMesh>
        <TresSphereGeometry :args="[EYE_R, 36, 24]" />
        <TresMeshStandardMaterial :color="theme.creature.sclera" :roughness="0.4" />
      </TresMesh>
      <TresMesh ref="irisRef" :position="[0, 0, 0.48]">
        <TresSphereGeometry :args="[0.26, 24, 18]" />
        <TresMeshStandardMaterial :color="theme.creature.iris" :roughness="0.3" />
      </TresMesh>
      <TresMesh :position="[-0.115, 0.125, 0.45]">
        <TresSphereGeometry :args="[0.045, 10, 8]" />
        <TresMeshBasicMaterial :color="theme.creature.highlight" />
      </TresMesh>
      <TresMesh ref="upperLidRef">
        <TresSphereGeometry :args="[LID_R, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2]" />
        <TresMeshStandardMaterial :roughness="0.6" :side="2" />
      </TresMesh>
      <TresMesh ref="lowerLidRef">
        <TresSphereGeometry :args="[LID_R, 36, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]" />
        <TresMeshStandardMaterial :roughness="0.6" :side="2" />
      </TresMesh>
    </TresGroup>

    <!-- Рот: девять сегментов по параболе, кривизна ведёт валентность. -->
    <TresGroup ref="mouthRef">
      <TresMesh v-for="i in MOUTH_SEGMENTS" :key="i">
        <TresBoxGeometry :args="[0.14, 0.085, 0.09]" />
        <TresMeshStandardMaterial :color="theme.creature.iris" :roughness="0.6" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
