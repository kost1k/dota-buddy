<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { breathAmplitude, breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

/**
 * Визуал 5: плоский силуэт. Единственный не-3D в наборе — SVG, без
 * освещения, без бликов, без объёма.
 *
 * Практический претендент, а не эксперимент. Всё, что разведка говорит про
 * малый размер, играет ему на руку: края, несомые ЯРКОСТЬЮ, переживают и
 * подвыборку цвета 4:2:0, и даунскейл 2K→1080p; у плоской формы нет
 * издержек ракурса при повороте, которые несут силуэты объёмных тел; и
 * сложность берёт ренту вечно, а простота — нет.
 *
 * Валентность: кривизна рта + светлота. Возбуждение: раскрытие глаз,
 * дыхание, тон.
 */

const props = defineProps<VisualProps>()

const VIEW = 200
const CENTRE = VIEW / 2

const clock = useRafClock()

const fill = computed(() => toHex(bodyColor(props.valence, props.arousal)))

/** Дыхание: масштаб тела. В покое амплитуда ровно ноль. */
const breath = computed(() => {
  const amp = breathAmplitude(props.arousal, 1) * (props.asleep ? 0.25 : 1)
  return 1 + Math.sin(clock.value * breathHz(props.arousal) * Math.PI * 2) * amp * 0.6
})

/** Раскрытие глаз ведёт возбуждение, как веки в объёмных вариантах. */
const eyeOpen = computed(() => 3 + props.arousal * 13 * (props.asleep ? 0.4 : 1))

/**
 * Рот квадратичной кривой. Управляющая точка выше концов — приязнь, ниже —
 * напряжение. Опущенной V в положительной половине быть не должно: это
 * преаттентивная форма угрозы.
 */
const mouth = computed(() => {
  const halfWidth = 34
  const y = CENTRE + 34
  // Знак положительный, потому что в SVG ось y направлена ВНИЗ: чтобы
  // концы рта поднялись (улыбка), управляющая точка должна уйти ниже них.
  const sag = props.valence * 26
  return `M ${CENTRE - halfWidth} ${y} Q ${CENTRE} ${y + sag} ${CENTRE + halfWidth} ${y}`
})
</script>

<template>
  <svg :viewBox="`0 0 ${VIEW} ${VIEW}`" class="flat" aria-hidden="true">
    <g :transform="`translate(${CENTRE} ${CENTRE}) scale(${breath}) translate(${-CENTRE} ${-CENTRE})`">
      <circle :cx="CENTRE" :cy="CENTRE" :r="78" :fill="fill" />
      <ellipse
        :cx="CENTRE - 26" :cy="CENTRE - 14"
        :rx="11" :ry="eyeOpen"
        :fill="theme.creature.iris"
      />
      <ellipse
        :cx="CENTRE + 26" :cy="CENTRE - 14"
        :rx="11" :ry="eyeOpen"
        :fill="theme.creature.iris"
      />
      <path
        :d="mouth"
        :stroke="theme.creature.iris"
        stroke-width="7"
        stroke-linecap="round"
        fill="none"
      />
    </g>
  </svg>
</template>

<style scoped>
.flat {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
