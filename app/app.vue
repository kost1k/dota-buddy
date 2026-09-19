<script setup>
const gameState = ref(null)
const isDead = ref(false)
const isIdle = ref(true)
const sweatLevel = ref(0)
const lastStats = ref({ gpm: 0, xpm: 0, kills: 0, level: 0 })
const showLevelUp = ref(false)
const runtimeConfig = useRuntimeConfig()
const wsUrl = runtimeConfig.public.wsUrl || 'ws://localhost:3000/ws'
const idleTimeoutMs = Number(runtimeConfig.public.idleTimeoutMs || 15000)
let idleTimer

function isObject(value) {
  return typeof value === 'object' && value !== null
}

function isValidPayload(payload) {
  if (!isObject(payload))
    return false
  if (payload.type !== 'update' && payload.type !== 'death' && payload.type !== 'idle')
    return false
  if (payload.type === 'idle')
    return true
  if (!isObject(payload.data))
    return false
  if (!isObject(payload.data.player) || !isObject(payload.data.hero))
    return false

  const { player, hero } = payload.data
  return Number.isFinite(player.gpm)
    && Number.isFinite(player.xpm)
    && Number.isFinite(player.kills)
    && Number.isFinite(player.kill_streak ?? 0)
    && Number.isFinite(hero.level)
}

const STREAK_MAP = {
  3: { name: 'Killing Spree', color: '#32cd32' },
  4: { name: 'Dominating', color: '#1e90ff' },
  5: { name: 'Mega Kill', color: '#8a2be2' },
  6: { name: 'Unstoppable', color: '#ff4500' },
  7: { name: 'Wicked Sick', color: '#ff0000' },
  8: { name: 'Monster Kill', color: '#ff1493' },
  9: { name: 'Godlike', color: '#ffd700' },
  10: { name: 'Beyond Godlike', color: '#ffffff' },
}

const { data } = useWebSocket(wsUrl, {
  autoReconnect: true,
})

function resetToIdleState() {
  gameState.value = null
  isDead.value = false
  isIdle.value = true
  sweatLevel.value = 0
  showLevelUp.value = false
  lastStats.value = { gpm: 0, xpm: 0, kills: 0, level: 0 }
}

function restartIdleTimer() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    resetToIdleState()
  }, idleTimeoutMs)
}

watch(data, (newVal) => {
  if (!newVal)
    return

  let payload
  try {
    payload = JSON.parse(newVal)
  }
  catch (error) {
    console.warn('[dota-buddy] Invalid WS message JSON:', error)
    return
  }

  if (!isValidPayload(payload)) {
    console.warn('[dota-buddy] Invalid WS payload shape:', payload)
    return
  }

  restartIdleTimer()

  if (payload.type === 'idle') {
    resetToIdleState()
    return
  }

  if (payload.type === 'update' || payload.type === 'death') {
    gameState.value = payload.data
    isDead.value = payload.type === 'death'
    isIdle.value = false

    if (payload.data.player && payload.data.hero) {
      const p = payload.data.player
      const h = payload.data.hero

      if (lastStats.value.level > 0 && h.level > lastStats.value.level) {
        showLevelUp.value = true
        setTimeout(() => {
          showLevelUp.value = false
        }, 1000)
      }

      const gpmDelta = p.gpm > lastStats.value.gpm ? 4 : -1
      const xpmDelta = p.xpm > lastStats.value.xpm ? 4 : -1
      const killBonus = p.kills > lastStats.value.kills ? 30 : 0

      sweatLevel.value = Math.min(Math.max(sweatLevel.value + gpmDelta + xpmDelta + killBonus, 0), 100)
      lastStats.value = { gpm: p.gpm, xpm: p.xpm, kills: p.kills, level: h.level }
    }
  }
})

onMounted(() => {
  restartIdleTimer()
})

onBeforeUnmount(() => {
  clearTimeout(idleTimer)
})

const currentStreak = computed(() => {
  const count = gameState.value?.player?.kill_streak || 0
  return STREAK_MAP[count > 10 ? 10 : count] || null
})

const activeColor = computed(() => currentStreak.value?.color || '#00a2ff')
</script>

<template>
  <main class="overlay-container" :style="{ '--active-color': activeColor }">
    <div class="level-up-flash" :class="[{ 'is-active': showLevelUp }]" />
    <div class="glow-overlay sweat-glow" :style="{ opacity: sweatLevel / 100 }" />
    <div v-if="currentStreak" class="glow-overlay streak-glow" />

    <ClientOnly>
      <BuddyScene
        :sweat-level="sweatLevel"
        :is-dead="isDead"
        :active-color="activeColor"
        :show-level-up="showLevelUp"
      />
    </ClientOnly>

    <!-- <div class="death-screen" :class="[{ 'is-active': isDead }]">
      <div v-if="isDead" class="death-message">
        <h1>YOU ARE DEAD</h1>
      </div>
    </div> -->

    <!-- ОБНОВЛЕННЫЙ КОМПАКТНЫЙ ВИДЖЕТ -->
    <div v-if="gameState?.player" class="compact-buddy">
      <div class="compact-card">
        <!-- Стрик теперь внутри карточки -->
        <div class="compact-header" :class="{ 'has-streak': currentStreak }">
          <transition name="fade-fast">
            <span v-if="currentStreak" class="streak-text">{{ currentStreak.name }}</span>
            <span v-else class="status-text">Dota Buddy</span>
          </transition>
        </div>

        <div class="compact-header-3d">
          <ClientOnly>
            <BuddyScene
              :sweat-level="sweatLevel"
              :is-dead="isDead"
              :active-color="activeColor"
              :show-level-up="showLevelUp"
            />
          </ClientOnly>
        </div>

        <!-- Метрики с равной шириной -->
        <div class="metrics-grid">
          <div class="metric-cell">
            <span class="m-label">GPM</span>
            <span class="m-value">{{ gameState.player.gpm }}</span>
          </div>
          <div class="metric-cell border-l">
            <span class="m-label">XPM</span>
            <span class="m-value">{{ gameState.player.xpm }}</span>
          </div>
        </div>

        <!-- Полоска интенсивности -->
        <div class="intensity-wrapper">
          <div class="intensity-bg">
            <div class="intensity-fill" :style="{ width: `${sweatLevel}%` }" />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="isIdle" class="compact-buddy">
      <div class="compact-card empty-card">
        <div class="compact-header">
          <span class="status-text">Dota Buddy</span>
        </div>
        <div class="empty-state">
          <span>Ожидание матча...</span>
        </div>
      </div>
    </div>
  </main>
</template>

<style>
:root { --active-color: #00a2ff; }

body, html { margin: 0; padding: 0; background: transparent; overflow: hidden; font-family: 'Segoe UI', system-ui, sans-serif; }
.overlay-container { width: 100vw; height: 100vh; position: relative; }

/* Эффекты свечения и смерти (без изменений) */
.level-up-flash { position: absolute; inset: 0; background: white; opacity: 0; pointer-events: none; z-index: 150; transition: opacity 0.1s ease-out; }
.level-up-flash.is-active { opacity: 0.4; transition: opacity 0.8s ease-in; }
.glow-overlay { position: absolute; inset: 0; pointer-events: none; transform: translateZ(0); will-change: opacity; transition: opacity 0.8s ease, background 0.5s ease; }
.sweat-glow { background: radial-gradient(circle at center, transparent 40%, transparent 60%, var(--active-color) 130%); z-index: 1; }
.streak-glow { background: radial-gradient(circle at center, transparent 50%, rgba(0,0,0,0.2) 70%, var(--active-color) 110%); opacity: 0.7; z-index: 2; animation: border-pulse 2s infinite ease-in-out; }
.death-screen { position: absolute; inset: 0; pointer-events: none; transition: all 0.6s ease; z-index: 100; }
.death-screen.is-active { background: radial-gradient(circle, transparent 10%, rgba(139, 0, 0, 0.8) 120%); box-shadow: inset 0 0 200px #000; }
.death-message { display: flex; height: 100%; align-items: center; justify-content: center; }
.death-message h1 { color: #ff3333; font-size: 6rem; font-weight: 900; text-shadow: 0 0 30px rgba(255, 0, 0, 0.8); animation: text-pulse 1.5s infinite; }

/* НОВАЯ КОНСТРУКЦИЯ ВИДЖЕТА */
.compact-buddy {
  position: absolute;
  bottom: 10px;
  right: 320px;
  z-index: 10;
}

.compact-card {
  background: rgba(6, 9, 12, 0.95);
  border-radius: 6px;
  width: 160px; /* Фиксированная ширина для стабильности сетки */
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  overflow: hidden;
}

.empty-card {
  width: 180px;
}

.empty-state {
  min-height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7f8b92;
  font-size: 0.75rem;
  letter-spacing: 0.3px;
}

.compact-header-3d {
  width: 100%;
  height: 100px; /* Можешь подправить под свой дизайн */
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at center, rgba(255,255,255,0.05), transparent);
}

/* Шапка внутри карточки */
.compact-header {
  padding: 4px 10px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s ease;
}

.compact-header.has-streak {
  background: rgba(255,255,255,0.08);
}

.streak-text {
  font-size: 0.65rem;
  font-weight: 900;
  color: var(--active-color);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.status-text {
  font-size: 0.6rem;
  font-weight: bold;
  color: #454d52;
  text-transform: uppercase;
}

/* Сетка метрик */
.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 8px 0;
}

.metric-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.metric-cell.border-l {
  border-left: 1px solid rgba(255,255,255,0.08);
}

.m-label {
  font-size: 0.55rem;
  font-weight: 900;
  color: #5d6a71;
  margin-bottom: 2px;
}

.m-value {
  font-family: 'Courier New', monospace;
  font-size: 1.1rem;
  font-weight: bold;
  color: #fff;
}

/* Нижняя полоска интенсивности */
.intensity-wrapper {
  padding: 0 10px 8px 10px;
}

.intensity-bg {
  width: 100%;
  height: 2px;
  background: rgba(255,255,255,0.05);
  border-radius: 1px;
  overflow: hidden;
}

.intensity-fill {
  height: 100%;
  background: var(--active-color);
  box-shadow: 0 0 5px var(--active-color);
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Анимации */
@keyframes border-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
@keyframes text-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }

.fade-fast-enter-active, .fade-fast-leave-active { transition: opacity 0.2s; }
.fade-fast-enter-from, .fade-fast-leave-to { opacity: 0; }
</style>
