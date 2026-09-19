<script setup lang="ts">
interface Props {
  sweatLevel: number
  isDead: boolean
  activeColor: string
  showLevelUp: boolean
}
defineProps<Props>()
</script>

<template>
  <TresCanvas alpha power-preference="high-performance">
    <TresPerspectiveCamera :position="[0, 0, 5]" :look-at="[0, 0, 0]" />

    <BuddyObject
      :sweat-level="sweatLevel"
      :is-dead="isDead"
      :active-color="activeColor"
      :show-level-up="showLevelUp"
    />

    <TresAmbientLight :intensity="0.4" />
    <TresDirectionalLight :position="[2, 2, 2]" :intensity="2" />
    <TresPointLight :position="[-3, -1, -2]" :color="activeColor" :intensity="4" />
  </TresCanvas>
</template>
