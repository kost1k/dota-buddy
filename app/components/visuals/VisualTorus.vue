<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color } from 'three'
import { clampAffect } from '#shared/affect'
import { MAX_TALENTS } from '#shared/milestones'
import { breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'
import { createShuffleBag } from '#shared/shuffle-bag'

/**
 * Визуал: кольцо.
 *
 * Единственная форма набора с ДЫРОЙ в силуэте, и потому самая
 * низкочастотная: на 135 px и на телефоне замкнутый контур с отверстием
 * различим там, где сплошное пятно уже превращается в кляксу.
 *
 * Валентность ведёт рябь поверхности: ровное гладкое кольцо при приязни,
 * изломанное и вздутое при напряжении. Толщины одной мало — она меняет
 * только вес силуэта и читается скучно.
 *
 * Возбуждение ведёт ДРОЖЬ этой же ряби — её темп и мелкую составляющую.
 * Это избыточный канал, скоррелированный с движением, а не второе
 * измерение формы: отдать форме обе оси нельзя, деформация по двум
 * параметрам читается интегрально, то есть как одна мешанина.
 */

const props = defineProps<VisualProps>()

const rootRef = shallowRef()
const ringRef = shallowRef()
const tint = new Color()

/** Базовые позиции и нормали тора — снимаются один раз. */
let base: Float32Array | null = null
let normals: Float32Array | null = null

/**
 * Профили реакции. Существуют потому, что повторяющийся визуал мёртв после
 * ВТОРОГО показа: одинаковая анимация смерти за матч — это девять повторов
 * одного стимула.
 *
 * Профили меняют только ФОРМУ рывка. Его величина и знак приходят из веса
 * события, а возврат задаёт инерция — поэтому реакция остаётся узнаваемой
 * реакцией, хотя выглядит каждый раз иначе. Постоянен уровень эскалации, а
 * не тип события: зритель и так видит экран игры, ему нужен масштаб, а не
 * расшифровка.
 */
type ReactionProfile = 'burst' | 'wring' | 'ripple' | 'squash'
const drawProfile = createShuffleBag<ReactionProfile>(['burst', 'wring', 'ripple', 'squash'])

let profile: ReactionProfile = 'burst'
let seenEventId = 0

/**
 * Вехи. Обе оси аффекта возвратны — через минуту после события бадди снова
 * примерно там же, — поэтому без накопления у матча нет видимой дуги, и
 * зритель, зашедший на сороковой минуте, видит то же, что на пятой.
 *
 * Таланты идут счётчиком: они однородны, и различать, какой именно взят,
 * не требуется. Аганим и шард получают собственные элементы — появление
 * нового признака читается как «что-то приобретено» даже тем, кто не знает
 * названий.
 */
const talentSlots = Array.from({ length: MAX_TALENTS }, (_, i) => {
  const angle = (i / MAX_TALENTS) * Math.PI * 2 + Math.PI / MAX_TALENTS
  // Радиус 0.99, а не 0.78: осевая линия тора проходит внутри трубки
  // (её радиус 0.23), и бусина меньшего размера там просто тонет.
  return [Math.cos(angle) * 0.99, Math.sin(angle) * 0.99, 0] as [number, number, number]
})

const beadsRef = shallowRef()
const aghanimRef = shallowRef()
const shardRef = shallowRef()

const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  const { asleep } = props
  const sleepy = asleep ? 0.25 : 1
  // Контракт отдаёт состояние и импульс раздельно, потому что быстрый слой
  // живёт по своим правилам; рисуется их сумма.
  const { valence, arousal } = clampAffect({
    valence: props.valence + props.impulse.valence,
    arousal: props.arousal + props.impulse.arousal,
  })
  const kick = Math.hypot(props.impulse.valence, props.impulse.arousal)
  const mesh = ringRef.value
  if (!mesh)
    return

  tint.set(toHex(bodyColor(valence, arousal)))
  mesh.material.color.copy(tint)

  // Новое событие — новый профиль. Сравниваем по id, а не по ссылке:
  // объект события переживает несколько кадров.
  if (props.event && props.event.id !== seenEventId) {
    seenEventId = props.event.id
    profile = drawProfile()
  }

  const attr = mesh.geometry.attributes.position
  if (!base) {
    base = new Float32Array(attr.array)
    normals = new Float32Array(mesh.geometry.attributes.normal.array)
  }

  // Негативная валентность — крупная рябь; позитивная — почти гладко.
  const roughness = (1 - (valence + 1) / 2)
  // Амплитуда ограничена сверху не вкусом, а геометрией: рябь выше ~0.14
  // при радиусе 0.78 затягивает отверстие, а отверстие здесь — весь смысл
  // формы и причина, по которой она в наборе.
  const swell = 0.025 + roughness * 0.115
  // Возбуждение добавляет мелкую быструю составляющую поверх крупной.
  const tremorAmp = arousal * 0.035 * sleepy
  const slow = elapsed * (0.5 + arousal * 1.2) * sleepy
  const fast = elapsed * (3 + arousal * 9) * sleepy

  for (let i = 0; i < attr.count; i++) {
    const x = base[i * 3]!
    const y = base[i * 3 + 1]!
    const z = base[i * 3 + 2]!

    // Сумма синусов по трём направлениям: дешёвая замена шуму, и её
    // достаточно — на 135 px разница между нею и симплексом невидима.
    const wave
      = Math.sin(x * 5.5 + slow) * Math.sin(y * 4.5 - slow * 0.8)
        + Math.sin(z * 6.5 + slow * 1.3) * 0.7
    const tremor = Math.sin(x * 17 + fast) * Math.sin(z * 15 - fast * 1.1)

    // Профиль меняет ФОРМУ рывка, а не его силу: сила приходит весом.
    let punch = 0
    if (kick > 0) {
      const angle = Math.atan2(y, x)
      switch (profile) {
        case 'burst':
          punch = 1
          break
        case 'wring':
          punch = Math.sin(angle * 2 + elapsed * 6)
          break
        case 'ripple':
          punch = Math.sin(angle * 3 - elapsed * 9)
          break
        case 'squash':
          punch = Math.cos(angle) * 1.3
          break
      }
    }

    const d = wave * swell + tremor * tremorAmp + punch * kick * 0.3

    attr.array[i * 3] = x + normals![i * 3]! * d
    attr.array[i * 3 + 1] = y + normals![i * 3 + 1]! * d
    attr.array[i * 3 + 2] = z + normals![i * 3 + 2]! * d
  }
  attr.needsUpdate = true
  // Нормали пересчитываем: материал гладкий, и без этого рябь не осветится.
  mesh.geometry.computeVertexNormals()

  // --- вехи ---
  const { talents, aghanim, shard } = props.milestones
  if (beadsRef.value) {
    beadsRef.value.children.forEach((bead: any, i: number) => {
      bead.visible = i < talents
      if (bead.visible)
        bead.material.color.copy(tint)
    })
  }
  if (aghanimRef.value) {
    aghanimRef.value.visible = aghanim
    if (aghanim) {
      aghanimRef.value.material.color.copy(tint)
      aghanimRef.value.rotation.z -= 0.004 * (1 + arousal) * sleepy
    }
  }
  if (shardRef.value) {
    shardRef.value.visible = shard
    if (shard) {
      shardRef.value.material.color.copy(tint)
      const orbit = elapsed * 0.6 * (1 + arousal) * sleepy
      shardRef.value.position.set(Math.cos(orbit) * 1.45, Math.sin(orbit) * 1.45, Math.sin(orbit * 1.7) * 0.25)
      shardRef.value.rotation.set(orbit * 1.4, orbit * 0.9, 0)
    }
  }

  const root = rootRef.value
  if (!root)
    return
  const breath = Math.sin(elapsed * breathHz(arousal) * Math.PI * 2)
  const s = 1 + breath * (0.025 + arousal * 0.07) * sleepy + kick * 0.14
  root.scale.set(s, s, s)
  // Наклон, а не вращение в плоскости: плоское кольцо анфас теряет
  // отверстие, а отверстие здесь — весь смысл формы.
  // Вращение идёт В ПЛОСКОСТИ кольца, а не вокруг вертикали. Вокруг
  // вертикали кольцо половину оборота стоит ребром и читается бобом —
  // отверстие пропадает, а оно здесь единственная причина брать эту форму.
  root.rotation.z += 0.0022 * (1 + arousal * 3) * sleepy
  root.rotation.x = 0.2 + Math.sin(elapsed * 0.3) * 0.06 * sleepy
  root.rotation.y = Math.sin(elapsed * 0.24) * 0.14 * sleepy
})
</script>

<template>
  <TresGroup ref="rootRef">
    <TresMesh ref="ringRef">
      <TresTorusGeometry :args="[0.78, 0.23, 24, 120]" />
      <TresMeshStandardMaterial :roughness="0.35" :metalness="0.25" />
    </TresMesh>

    <!-- Таланты: бусины по кольцу, по одной на взятый. -->
    <TresGroup ref="beadsRef">
      <TresMesh v-for="(slot, i) in talentSlots" :key="i" :position="slot" :visible="false">
        <TresIcosahedronGeometry :args="[0.12, 1]" />
        <TresMeshStandardMaterial :roughness="0.3" :metalness="0.45" :flat-shading="true" />
      </TresMesh>
    </TresGroup>

    <!-- Аганим: второе тонкое кольцо снаружи. -->
    <TresMesh ref="aghanimRef" :visible="false" :rotation="[0.5, 0.3, 0]">
      <TresTorusGeometry :args="[1.22, 0.04, 12, 96]" />
      <TresMeshStandardMaterial :roughness="0.25" :metalness="0.6" />
    </TresMesh>

    <!-- Шард: отдельный обломок на орбите. -->
    <TresMesh ref="shardRef" :visible="false">
      <TresOctahedronGeometry :args="[0.19, 0]" />
      <TresMeshStandardMaterial :roughness="0.25" :metalness="0.55" :flat-shading="true" />
    </TresMesh>
  </TresGroup>
</template>
