<script setup lang="ts">
import type { VisualProps } from '#shared/visual'
import { useLoop } from '@tresjs/core'
import { Color } from 'three'
import { breathHz } from '#shared/motion'
import { bodyColor, toHex } from '#shared/palette'

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

const { onBeforeRender } = useLoop()

onBeforeRender(({ elapsed }) => {
  const { valence, arousal, asleep } = props
  const sleepy = asleep ? 0.25 : 1
  const mesh = ringRef.value
  if (!mesh)
    return

  tint.set(toHex(bodyColor(valence, arousal)))
  mesh.material.color.copy(tint)

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
    const d = wave * swell + tremor * tremorAmp

    attr.array[i * 3] = x + normals![i * 3]! * d
    attr.array[i * 3 + 1] = y + normals![i * 3 + 1]! * d
    attr.array[i * 3 + 2] = z + normals![i * 3 + 2]! * d
  }
  attr.needsUpdate = true
  // Нормали пересчитываем: материал гладкий, и без этого рябь не осветится.
  mesh.geometry.computeVertexNormals()

  const root = rootRef.value
  if (!root)
    return
  const breath = Math.sin(elapsed * breathHz(arousal) * Math.PI * 2)
  const s = 1 + breath * (0.025 + arousal * 0.07) * sleepy
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
  </TresGroup>
</template>
