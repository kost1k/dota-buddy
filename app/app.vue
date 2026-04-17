<script setup>
const { status, data, send, open, close } = useWebSocket(`ws://localhost:3000/ws`, {
  autoReconnect: true,
})

const gameState = ref(null)
const isDead = ref(false)

// Следим за входящими сообщениями
watch(data, (newValue) => {
  const event = JSON.parse(newValue)

  if (event.type === 'update' || event.type === 'death') {
    gameState.value = event.data
  }

  if (event.type === 'death') {
    isDead.value = true
    setTimeout(() => isDead.value = false, 8000)
  }
})
</script>

<template>
  <div class="overlay">
    <div v-if="gameState" class="stats">
      <div class="gold">
        💰 {{ gameState.player.gold }}
      </div>
      <div class="level">
        LVL {{ gameState.hero.level }}
      </div>
    </div>

    <div v-if="isDead" class="death-banner">
      ЧАТ, ВЫБИРАЙТЕ СЛЕДУЮЩИЙ АРТЕФАКТ!
    </div>
  </div>
</template>

<style scoped>
</style>
