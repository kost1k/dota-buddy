<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color } from 'three'
import { clampAffect } from '#shared/affect'
import { breathAmplitude, breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал: существо с глазом. Лицевой контроль набора.
 *
 * Нужен именно как контроль. Обе перцептивные разведки сходятся, что
 * безликая форма несёт ВОЗБУЖДЕНИЕ не хуже лицевой — эффекта воплощения нет
 * вовсе, — но проигрывает по ВАЛЕНТНОСТИ: все безликие её носители либо
 * нулевые, либо немонотонные, либо никем не проверенные. Без лицевого
 * варианта в наборе это утверждение нечем опровергнуть.
 *
 * Рта здесь нет намеренно, хотя он и главный носитель валентности: попытка
 * добавить его стоила глазу объёма, и потеря оказалась больше приобретения.
 * Пропорции восстановлены до той версии, что работала.
 */

const props = defineProps<VisualProps>()

const EYE_R = 0.58
/**
 * Веки заметно крупнее глазного яблока. Зрачок обязан выступать за склеру,
 * иначе тонет в ней, и одновременно лежать внутри радиуса век, иначе они
 * проходят сквозь него и моргание его не закрывает.
 */
const LID_R = 0.7

const rootRef = shallowRef()
const bodyRef = shallowRef()
const upperLidRef = shallowRef()
const lowerLidRef = shallowRef()

const tint = new Color()
let blinkCountdown = 2.5
let blinkProgress = 1

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta, elapsed }) => {
  const { asleep } = props
  // Импульс складывается с состоянием: контракт отдаёт их раздельно,
  // потому что быстрый слой живёт по своим правилам, но рисуется сумма.
  const { valence, arousal } = clampAffect({
    valence: props.valence + props.impulse.valence,
    arousal: props.arousal + props.impulse.arousal,
  })
  const sleepy = asleep ? 0.25 : 1

  tint.set(toHex(bodyColor(valence, arousal)))
  for (const ref of [bodyRef, upperLidRef, lowerLidRef]) {
    if (ref.value)
      ref.value.material.color.copy(tint)
  }

  blinkCountdown -= delta
  if (blinkCountdown <= 0) {
    blinkProgress = 0
    blinkCountdown = (4.5 - arousal * 2.2) * (0.7 + Math.random() * 0.6)
  }
  if (blinkProgress < 1)
    blinkProgress = Math.min(1, blinkProgress + delta / 0.16)
  const blink = Math.sin(Math.PI * blinkProgress)

  // Склеру кольцом вокруг зрачка показываем только на негативном пике:
  // белки вокруг радужки — прямой сигнал страха, в покое он ложный.
  const aperture = (0.2 + arousal * 1.05) * (1 - blink) * sleepy
  if (upperLidRef.value) {
    upperLidRef.value.rotation.x = -aperture * (1 - Math.max(0, -valence) * 0.2)
    upperLidRef.value.rotation.z = -valence * 0.12
  }
  if (lowerLidRef.value) {
    lowerLidRef.value.rotation.x = aperture * (1 - Math.max(0, valence) * 0.4)
    lowerLidRef.value.rotation.z = -valence * 0.12
  }

  const root = rootRef.value
  if (root) {
    const amp = breathAmplitude(arousal, 1) * sleepy
    const breath = Math.sin(elapsed * breathHz(arousal) * Math.PI * 2)
    root.position.y = breath * amp
    root.rotation.y = Math.sin(elapsed * 0.4) * 0.18 * sleepy
  }
})
</script>

<template>
  <TresGroup ref="rootRef">
    <TresMesh ref="bodyRef">
      <TresIcosahedronGeometry :args="[1, 1]" />
      <TresMeshStandardMaterial :roughness="0.55" :metalness="0.1" :flat-shading="true" />
    </TresMesh>

    <TresGroup :position="[0, 0.06, 0.55]">
      <TresMesh>
        <TresSphereGeometry :args="[EYE_R, 40, 28]" />
        <TresMeshStandardMaterial :color="theme.creature.sclera" :roughness="0.35" />
      </TresMesh>
      <TresMesh :position="[0, 0, 0.56]" :scale="[1, 1, 0.3]">
        <TresSphereGeometry :args="[0.3, 28, 20]" />
        <TresMeshStandardMaterial :color="theme.creature.iris" :roughness="0.25" />
      </TresMesh>
      <TresMesh :position="[-0.133, 0.143, 0.523]">
        <TresSphereGeometry :args="[0.05, 12, 10]" />
        <TresMeshBasicMaterial :color="theme.creature.highlight" />
      </TresMesh>
      <TresMesh ref="upperLidRef">
        <TresSphereGeometry :args="[LID_R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]" />
        <TresMeshStandardMaterial :roughness="0.55" :metalness="0.1" :side="2" />
      </TresMesh>
      <TresMesh ref="lowerLidRef">
        <TresSphereGeometry :args="[LID_R, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]" />
        <TresMeshStandardMaterial :roughness="0.55" :metalness="0.1" :side="2" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
