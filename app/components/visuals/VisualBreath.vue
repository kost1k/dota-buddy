<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color, LatheGeometry, Vector2 } from 'three'
import { breathAmplitude, breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал: дыхание. Нижняя граница набора.
 *
 * Форма ЗАФИКСИРОВАНА и ничего не выражает — в этом весь смысл варианта.
 * Остаются ровно два канала: светлота под валентность, темп и амплитуда
 * дыхания под возбуждение. Это теоретический минимум, способный нести две
 * оси.
 *
 * Вариант нужен как контроль снизу: если в эфире он удержит внимание не
 * хуже остальных, значит работа над формой не окупается, и узнать это лучше
 * дёшево. Разведка по вниманию делает такой исход правдоподобнее, чем
 * хотелось бы — бюджет прямого взгляда одна-две минуты за трёхчасовой эфир.
 *
 * Форма при этом намеренно НЕ шар: каплевидный профиль вращения со
 * скруткой. Контроль должен быть скучным по поведению, а не по силуэту,
 * иначе сравнение поедет на «шар против интересных форм».
 */

const props = defineProps<VisualProps>()

const PROFILE_STEPS = 48
const TWIST = 1.15

/**
 * Профиль вращения: капля с заострённой верхушкой. Радиус гасится к
 * верхнему полюсу сильнее, чем у сферы, — отсюда силуэт луковицы, а не
 * шара.
 */
function dropletProfile() {
  return Array.from({ length: PROFILE_STEPS + 1 }, (_, i) => {
    const theta = (i / PROFILE_STEPS) * Math.PI
    const taper = 1 - 0.85 * (theta / Math.PI) ** 1.5
    return new Vector2(Math.max(0.0001, Math.sin(theta) * taper), -Math.cos(theta))
  })
}

/** Скрутка вокруг вертикали: LatheGeometry её не умеет, применяем к вершинам. */
function twistedDroplet() {
  const geometry = new LatheGeometry(dropletProfile(), 64)
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const angle = y * TWIST
    pos.setX(i, x * Math.cos(angle) - z * Math.sin(angle))
    pos.setZ(i, x * Math.sin(angle) + z * Math.cos(angle))
  }
  geometry.computeVertexNormals()
  return geometry
}

const geometry = twistedDroplet()

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
  const s = 1 + breath * amp * 0.9
  root.scale.set(s, s * (1 - breath * amp * 0.3), s)
  root.rotation.y += 0.0012 * (1 + arousal * 2.5) * sleepy
})

onUnmounted(() => geometry.dispose())
</script>

<template>
  <TresGroup ref="rootRef" :scale="0.92">
    <TresMesh ref="bodyRef">
      <primitive :object="geometry" attach="geometry" />
      <TresMeshStandardMaterial :roughness="0.45" :metalness="0.2" />
    </TresMesh>
  </TresGroup>
</template>
