<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { Color } from 'three'

/**
 * Бадди — существо с глазом.
 *
 * Ядро с орбитами из прототипа стало ТЕЛОМ; глаз посажен в него спереди.
 * Это принципиально: глаз в пустоте читается как жуткое наблюдающее око и
 * противоречит характеру верного союзника (спека, §2.1). Тело, веки и брови
 * окрашены одинаково, поэтому силуэт остаётся цельным.
 *
 * Распределение каналов (ADR-0001):
 *
 *   валентность -> цвет тела, наклон бровей, подъём нижнего века
 *   возбуждение -> раскрытие век, скорость и амплитуда движения, дрожь
 *
 * Взгляд (направление внимания) в этот компонент не входит — рубеж 3.
 *
 * Прозрачности нет нигде, включая орбиты: ADR-0003.
 */

const props = defineProps<{ asleep: boolean }>()

const { state, tick } = useAffect()

const rootRef = shallowRef()
const bodyRef = shallowRef()
const orbitsRef = shallowRef()
const upperLidRef = shallowRef()
const lowerLidRef = shallowRef()
const irisRef = shallowRef()

const EYE_Z = 0.55
const EYE_R = 0.58
/**
 * Веки заметно крупнее глазного яблока — так и должно быть: зрачок обязан
 * выступать за склеру, иначе тонет в ней и не виден, и при этом оставаться
 * внутри радиуса век, иначе они проходят сквозь него и моргание его не
 * закрывает. При LID_R = 0.62 просвет между этими условиями был 0.04 и
 * второе не выполнялось.
 */
const LID_R = 0.7

// Две, а не пять: на эфирном размере тонкие кольца читаются царапинами.
const orbits = [
  { rotation: [1.15, 0.3, 0.2] as const, radius: 1.36 },
  { rotation: [-0.7, 0.9, -0.4] as const, radius: 1.5 },
]

const cold = new Color(theme.color.valenceLow)
const warm = new Color(theme.color.valenceHigh)
const bodyTint = new Color()
const shadeTint = new Color()

// Моргание: отдельный ритм, не связанный с аффектом. Без него существо
// смотрит немигающим взглядом, и это ровно тот «жуткий глаз», от которого
// мы уходим.
let blinkCountdown = 2.5
let blinkProgress = 1

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta, elapsed }) => {
  // Дельта берётся из цикла TresJS, а не из собственных часов: под капотом
  // там THREE.Timer, подключённый к Page Visibility API. Когда страница
  // скрыта (OBS увёл сцену, вкладка в фоне), он останавливается и при
  // возврате не выдаёт накопленный провал одним куском.
  tick(delta)

  const { valence, arousal } = state.value
  const sleepy = props.asleep ? 0.25 : 1

  // --- цвет: валентность температурой и насыщенностью ---
  bodyTint.copy(cold).lerp(warm, (valence + 1) / 2)
  if (bodyRef.value)
    bodyRef.value.material.color.copy(bodyTint)

  if (upperLidRef.value)
    upperLidRef.value.material.color.copy(bodyTint)
  if (lowerLidRef.value)
    lowerLidRef.value.material.color.copy(bodyTint)

  if (orbitsRef.value) {
    shadeTint.copy(bodyTint).multiplyScalar(theme.creature.orbitShade)
    orbitsRef.value.children.forEach((ring: any) => ring.material.color.copy(shadeTint))
  }

  // --- моргание ---
  blinkCountdown -= delta
  if (blinkCountdown <= 0) {
    blinkProgress = 0
    // На взводе моргает чаще и дёрганее, в покое — реже.
    blinkCountdown = (4.5 - arousal * 2.2) * (0.7 + Math.random() * 0.6)
  }
  if (blinkProgress < 1)
    blinkProgress = Math.min(1, blinkProgress + delta / 0.16)
  const blink = Math.sin(Math.PI * blinkProgress) // 0 -> 1 -> 0

  // --- веки: раскрытие ведёт возбуждение ---
  const aperture = (0.22 + arousal * 1.05) * (1 - blink) * (props.asleep ? 0.35 : 1)
  // Положительная валентность приподнимает нижнее веко — прищур довольства.
  const lowerSquint = Math.max(0, valence) * 0.4
  // Отрицательная — слегка опускает верхнее, взгляд тяжелеет.
  const upperDrop = Math.max(0, -valence) * 0.18

  if (upperLidRef.value) {
    upperLidRef.value.rotation.x = -aperture * (1 - upperDrop)
    upperLidRef.value.rotation.z = -valence * 0.12
  }
  if (lowerLidRef.value) {
    lowerLidRef.value.rotation.x = aperture * (1 - lowerSquint)
    lowerLidRef.value.rotation.z = -valence * 0.12
  }

  // Бровей здесь нет намеренно. На эфирном размере (силуэт ~135 px) бровь
  // занимает 2-3 пикселя и читается шумом, а не мимикой. Валентность несут
  // цвет и геометрия век — они крупномасштабные и выживают.

  // --- зрачок: сужается при напряжении ---
  if (irisRef.value) {
    const s = 1 - Math.max(0, -valence) * 0.22 + arousal * 0.08
    irisRef.value.scale.set(s, s, 0.3)
  }

  // --- движение: амплитуду и темп ведёт возбуждение ---
  const root = rootRef.value
  if (root) {
    const pace = 0.7 + arousal * 1.7
    root.position.y = Math.sin(elapsed * pace) * (0.035 + arousal * 0.045) * sleepy
    // Покачивание, а не вращение: существо не крутится вокруг оси.
    root.rotation.y = Math.sin(elapsed * 0.45) * 0.22 * sleepy
    root.rotation.x = Math.sin(elapsed * 0.33) * 0.09 * sleepy

    // Дрожь только на пике — иначе это просто шум.
    if (arousal > 0.82 && !props.asleep) {
      const j = (arousal - 0.82) * 0.09
      root.position.x = (Math.random() - 0.5) * j
      root.position.z = (Math.random() - 0.5) * j
    }
    else {
      root.position.x = 0
      root.position.z = 0
    }
  }

  if (orbitsRef.value) {
    orbitsRef.value.children.forEach((ring: any, i: number) => {
      const dir = i % 2 === 0 ? 1 : -1
      const speed = (0.08 + arousal * 0.5) * (i + 1) * 0.5 * sleepy
      ring.rotation.z += delta * speed * dir
      ring.rotation.x += delta * speed * 0.6
    })
  }
})
</script>

<template>
  <TresGroup ref="rootRef">
    <!-- Тело. Гранёное: чёткие рёбра вместо мягкой подсветки (ADR-0003). -->
    <TresMesh ref="bodyRef">
      <TresIcosahedronGeometry :args="[1, 1]" />
      <TresMeshStandardMaterial :roughness="0.55" :metalness="0.12" :flat-shading="true" />
    </TresMesh>

    <!-- Глаз -->
    <TresGroup :position="[0, 0.06, EYE_Z]">
      <TresMesh>
        <TresSphereGeometry :args="[EYE_R, 40, 28]" />
        <TresMeshStandardMaterial :color="theme.creature.sclera" :roughness="0.35" />
      </TresMesh>

      <!--
        Зрачок сидит на поверхности склеры и слегка выступает за неё.
        Утопленный внутрь сферы он полностью пропадает, и глаз читается
        визором, а не глазом.
      -->
      <TresMesh ref="irisRef" :position="[0, 0, 0.56]">
        <TresSphereGeometry :args="[0.3, 28, 20]" />
        <TresMeshStandardMaterial :color="theme.creature.iris" :roughness="0.25" />
      </TresMesh>

      <!-- Блик: крошечный, но именно он делает глаз живым, а не нарисованным. -->
      <TresMesh :position="[-0.133, 0.143, 0.523]">
        <TresSphereGeometry :args="[0.05, 12, 10]" />
        <TresMeshBasicMaterial :color="theme.creature.highlight" />
      </TresMesh>

      <!--
        Веки — сферические чаши чуть большего радиуса, концентричные глазу.
        При нулевом повороте их кромки сходятся по экватору: глаз закрыт.
        Поворот по X отводит кромку и раскрывает.
      -->
      <TresMesh ref="upperLidRef">
        <TresSphereGeometry :args="[LID_R, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]" />
        <TresMeshStandardMaterial :roughness="0.55" :metalness="0.12" :side="2" />
      </TresMesh>
      <TresMesh ref="lowerLidRef">
        <TresSphereGeometry :args="[LID_R, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]" />
        <TresMeshStandardMaterial :roughness="0.55" :metalness="0.12" :side="2" />
      </TresMesh>
    </TresGroup>

    <!-- Орбиты. Непрозрачные: в прототипе шли на opacity 0.8 — теперь нельзя. -->
    <TresGroup ref="orbitsRef">
      <TresMesh v-for="(ring, i) in orbits" :key="i" :rotation="ring.rotation">
        <TresTorusGeometry :args="[ring.radius, 0.034, 10, 84]" />
        <TresMeshStandardMaterial :roughness="0.5" :metalness="0.3" />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
