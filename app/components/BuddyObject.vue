<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import gsap from 'gsap'
import { nextTick, ref, shallowRef, watch } from 'vue'

interface Props {
  sweatLevel: number
  isDead: boolean
  activeColor: string
  showLevelUp: boolean
}

const props = defineProps<Props>()

const coreRef = shallowRef()
const orbitsGroupRef = shallowRef()
const fragmentsRefs = ref<any[]>([])

// Данные для 5 колец с разным начальным вращением
const orbitData = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number],
  radius: 1.5 + (i * 0.12),
}))

const fragmentData = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  scale: 0.05 + Math.random() * 0.15,
}))

const { onBeforeRender } = useLoop()

onBeforeRender(({ delta, elapsed }) => {
  if (!props.isDead) {
    // Мягкий множитель скорости
    const speedMultiplier = 1 + props.sweatLevel / 100

    if (orbitsGroupRef.value) {
      orbitsGroupRef.value.children.forEach((ring: any, i: number) => {
        // Намного медленнее вращение (0.05 - 0.1)
        const dir = i % 2 === 0 ? 1 : -1
        ring.rotation.x += delta * 0.05 * (i + 1) * speedMultiplier * dir
        ring.rotation.y += delta * 0.08 * (i + 1) * speedMultiplier
      })

      // Плавное дыхание остается
      const breathe = 1 + Math.sin(elapsed * 1.2) * 0.03
      const sweatPulse = props.sweatLevel > 75 ? Math.sin(elapsed * 15) * (props.sweatLevel / 2500) : 0
      const finalScale = breathe + sweatPulse
      orbitsGroupRef.value.scale.set(finalScale, finalScale, finalScale)
    }

    if (coreRef.value) {
      // Спокойное вращение ядра
      coreRef.value.rotation.y += delta * 0.15 * speedMultiplier
      coreRef.value.position.y = Math.sin(elapsed * 1.2) * 0.05

      // Тряска только на критических значениях
      if (props.sweatLevel > 85) {
        const intensity = (props.sweatLevel - 85) * 0.01
        coreRef.value.position.x = (Math.random() - 0.5) * intensity
        coreRef.value.position.z = (Math.random() - 0.5) * intensity
      }
      else {
        coreRef.value.position.x = 0
        coreRef.value.position.z = 0
      }

      // Убрали пульсацию emissiveIntensity, оставили только статичную зависимость
      if (coreRef.value.material) {
        coreRef.value.material.emissiveIntensity = 1 + (props.sweatLevel / 50)
      }
    }
  }
})

watch(() => props.showLevelUp, (active) => {
  if (active && coreRef.value) {
    gsap.fromTo(coreRef.value.scale, { x: 1, y: 1, z: 1 }, { x: 2.3, y: 2.3, z: 2.3, duration: 0.3, yoyo: true, repeat: 1, ease: 'back.out(1.7)' },
    )
  }
})

watch(() => props.isDead, async (dead) => {
  if (dead) {
    if (coreRef.value)
      gsap.to(coreRef.value.scale, { x: 0, y: 0, z: 0, duration: 0.2 })
    if (orbitsGroupRef.value)
      gsap.to(orbitsGroupRef.value.scale, { x: 0, y: 0, z: 0, duration: 0.2 })

    await nextTick()

    fragmentsRefs.value.forEach((mesh) => {
      if (!mesh)
        return
      mesh.visible = true
      mesh.position.set(0, 0, 0)
      mesh.scale.set(1, 1, 1)
      gsap.to(mesh.position, {
        x: (Math.random() - 0.5) * 7,
        y: (Math.random() - 0.5) * 7,
        z: (Math.random() - 0.5) * 7,
        duration: 1.3,
        ease: 'expo.out',
      })
      gsap.to(mesh.scale, { x: 0, y: 0, z: 0, delay: 0.9, duration: 0.6, onComplete: () => {
        mesh.visible = false
      } })
    })
  }
  else {
    if (coreRef.value)
      gsap.to(coreRef.value.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
    if (orbitsGroupRef.value)
      gsap.to(orbitsGroupRef.value.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)' })
  }
})
</script>

<template>
  <TresGroup>
    <!-- Ядро -->
    <TresMesh ref="coreRef" :visible="!isDead">
      <TresIcosahedronGeometry :args="[1, 0]" />
      <TresMeshStandardMaterial
        :color="activeColor"
        :emissive="activeColor"
        :wireframe="props.sweatLevel > 80"
        :roughness="0.3"
        :metalness="0.7"
      />
    </TresMesh>

    <!-- Аура (5 нитей) -->
    <TresGroup ref="orbitsGroupRef" :visible="!isDead">
      <TresMesh
        v-for="ring in orbitData"
        :key="ring.id"
        :rotation="ring.rotation"
      >
        <TresTorusGeometry :args="[ring.radius, 0.006, 8, 128]" />
        <TresMeshBasicMaterial
          :color="activeColor"
          :transparent="true"
          :opacity="0.8 - (ring.id * 0.12)"
        />
      </TresMesh>
    </TresGroup>

    <!-- Осколки -->
    <TresMesh
      v-for="(f, i) in fragmentData"
      :key="f.id"
      :ref="el => { if (el) fragmentsRefs[i] = el }"
      :visible="false"
    >
      <TresIcosahedronGeometry :args="[f.scale, 0]" />
      <TresMeshBasicMaterial :color="activeColor" />
    </TresMesh>
  </TresGroup>
</template>
