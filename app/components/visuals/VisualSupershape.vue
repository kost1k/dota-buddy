<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { Superformula } from '@tresjs/cientos'
import { useLoop } from '@tresjs/core'
import { clampAffect } from '#shared/affect'
import { breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал: супершейп. Форма ведёт валентность.
 *
 * Суперформула Гилиса одним набором показателей порождает круги, звёзды,
 * многогранники и капли — то есть валентность здесь меняет не цвет и не
 * мимику, а саму форму тела.
 *
 * Это замена варианту со смещением вершин: там «угловатость» подделывалась
 * шумом по нормалям, здесь она параметр формы. Компонент cientos
 * пересчитывает позиции НА МЕСТЕ при смене показателей, без пересборки
 * геометрии, поэтому анимировать их можно каждый кадр.
 *
 * Число лучей фиксировано: менять его на ходу значит менять топологию
 * силуэта скачком, а непрерывность — требование ADR-0001.
 */

const props = defineProps<VisualProps>()

const rootRef = shallowRef()
const materialRef = shallowRef()

/** −1 → колючая звезда, +1 → собранная округлая форма. */
/** Состояние и импульс складываются через зажим — сумма выходит за диапазон. */
const rendered = computed(() => clampAffect({
  valence: props.valence + props.impulse.valence,
  arousal: props.arousal + props.impulse.arousal,
}))

const shape = computed(() => {
  const t = (rendered.value.valence + 1) / 2
  // Направление показателей неочевидно и я сперва задал его наоборот.
  // Шипы даёт ВЫСОКИЙ n2/n3 при низком n1; понижение всех трёх разом
  // стягивает тело в песочные часы, теряя силуэт вместо заострения.
  // При n1 = n2 = n3 = 2 суперформула вырождается в окружность — это и
  // есть спокойный полюс.
  // Диапазон сужен: при n1 ниже ~1.1 грани вытягиваются в длинные лучи и
  // тело перестаёт читаться телом. Звезда нужна злая, а не разорванная.
  const n1 = 1.15 + t * 1.05
  const n23 = 4.2 - t * 2.2
  return [n1, n23, n23] as [number, number, number]
})

const hex = computed(() => toHex(bodyColor(rendered.value.valence, rendered.value.arousal)))

/**
 * Компенсация габарита, посчитанная, а не подобранная.
 *
 * Радиус суперформулы равен `сумма^(−1/n1)`, поэтому при низком n1 форма не
 * просто заостряется, а РАЗДУВАЕТСЯ: на шипастом полюсе максимальный радиус
 * доходит до ~4.5 против ~1 на округлом. Без компенсации сравнение поехало
 * бы по размеру вместо формы.
 *
 * Максимум достигается на диагонали, где |cos| = |sin| = 1/√2.
 */
const fit = computed(() => {
  const [n1, , n23] = shape.value
  const maxRadius = (2 * Math.SQRT1_2 ** n23) ** (-1 / n1)
  return 0.76 / maxRadius
})

const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  const { asleep } = props
  const arousal = rendered.value.arousal
  const sleepy = asleep ? 0.25 : 1
  const root = rootRef.value
  if (!root)
    return

  const breath = Math.sin(elapsed * breathHz(arousal) * Math.PI * 2)
  const swell = fit.value * (1 + breath * (0.02 + arousal * 0.07) * sleepy)
  root.scale.set(swell, swell, swell)
  root.rotation.y += 0.0016 * (1 + arousal * 3) * sleepy
  root.rotation.z = Math.sin(elapsed * 0.3) * 0.1 * sleepy
})
</script>

<template>
  <TresGroup ref="rootRef" :scale="fit">
    <Superformula
      :width-segments="72"
      :height-segments="48"
      :num-arms-a="6"
      :exp-a="shape"
      :num-arms-b="6"
      :exp-b="shape"
    >
      <TresMeshStandardMaterial
        ref="materialRef"
        :color="hex"
        :roughness="0.55"
        :metalness="0.1"
        :flat-shading="true"
      />
    </Superformula>
  </TresGroup>
</template>
