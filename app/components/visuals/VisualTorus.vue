<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color } from 'three'
import { clampAffect } from '#shared/affect'
import { MAX_LEVEL } from '#shared/milestones'
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
 * Вехи и подложка уровня.
 *
 * Талантов здесь нет намеренно: взятие таланта не событие в игре, а у части
 * героев их больше четырёх — счётчик на фиксированное число слотов был бы
 * зашитым допущением.
 *
 * Аганим — ЯДРО в отверстии, а не второе кольцо. Кольцом он был сперва, и
 * это оказалось дублированием: бадди сам кольцо, и вторая окружность
 * читается не отдельным признаком, а утолщением. Ядро занимает место,
 * которого у формы больше нигде нет.
 *
 * Плата названа честно: отверстие — лучшее свойство этой формы, самое
 * низкочастотное. Ядро держим мелким, чтобы просвет остался просветом.
 */
const coreRef = shallowRef()
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
  const levelGrowth = Math.min(Math.max(props.level, 0), MAX_LEVEL) / MAX_LEVEL
  const slow = elapsed * (0.5 + arousal * 1.2) * sleepy
  const fast = elapsed * (3 + arousal * 9) * sleepy

  for (let i = 0; i < attr.count; i++) {
    const x = base[i * 3]!
    const y = base[i * 3 + 1]!
    const z = base[i * 3 + 2]!

    // Сумма синусов по трём направлениям: дешёвая замена шуму, и её
    // достаточно — на 135 px разница между нею и симплексом невидима.
    // Подложка уровня: с ростом уровня по трубке идёт всё более частая
    // огранка. Медленно и негромко — это не третий канал аффекта, а
    // другое измерение времени.
    const facets = Math.sin(Math.atan2(y, x) * (6 + levelGrowth * 10)) * 0.02 * levelGrowth

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

    const d = wave * swell + tremor * tremorAmp + punch * kick * 0.3 + facets

    attr.array[i * 3] = x + normals![i * 3]! * d
    attr.array[i * 3 + 1] = y + normals![i * 3 + 1]! * d
    attr.array[i * 3 + 2] = z + normals![i * 3 + 2]! * d
  }
  attr.needsUpdate = true
  // Нормали пересчитываем: материал гладкий, и без этого рябь не осветится.
  mesh.geometry.computeVertexNormals()

  // --- вехи ---
  const { aghanim, shard } = props.milestones
  if (coreRef.value) {
    coreRef.value.visible = aghanim
    if (aghanim) {
      coreRef.value.material.color.copy(tint)
      coreRef.value.rotation.y += 0.006 * (1 + arousal * 2) * sleepy
      coreRef.value.rotation.x += 0.004 * sleepy
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

    <!-- Аганим: ядро в отверстии. Мелкое — просвет должен остаться просветом. -->
    <TresMesh ref="coreRef" :visible="false">
      <TresIcosahedronGeometry :args="[0.26, 1]" />
      <TresMeshStandardMaterial :roughness="0.25" :metalness="0.55" :flat-shading="true" />
    </TresMesh>

    <!-- Шард: отдельный обломок на орбите. -->
    <TresMesh ref="shardRef" :visible="false">
      <TresOctahedronGeometry :args="[0.19, 0]" />
      <TresMeshStandardMaterial :roughness="0.25" :metalness="0.55" :flat-shading="true" />
    </TresMesh>
  </TresGroup>
</template>
