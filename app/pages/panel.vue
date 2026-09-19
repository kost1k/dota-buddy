<script setup lang="ts">
import type { AffectState } from '#shared/affect'
import type { EscalationTier } from '#shared/escalation'
import { AFFECT_PRESETS, AFFECT_RANGE, NEUTRAL_AFFECT } from '#shared/affect'
import { ESCALATION_TIERS } from '#shared/escalation'
import { VISUALS } from '#shared/visual'

/**
 * Пульт разработки. Отдельная страница: в оверлей он попасть не должен
 * никогда, иначе уедет в эфир.
 *
 * Это ВЕРХНИЙ, отладочный уровень пульта — прямое ведение осей в обход
 * сервера. Нижний уровень (синтетические снапшоты в `POST /api/gsi`,
 * проверяющий серверный вывод событий) — рубеж 2. Смешивать их здесь нельзя:
 * без серверного вывода событий снапшотам не во что превращаться.
 */

useHead({ title: 'Dota Buddy — пульт' })

const { state, target, setTarget, setState } = useAffect()
const { visualId, setVisual } = useVisual()

useAffectTicker()

/** Когда включено, ползунки пишут состояние напрямую — инерции не видно. */
const driveDirectly = ref(false)
const previewAsleep = ref(false)
const lastEvent = ref<string | null>(null)

function drive(axis: keyof AffectState, raw: string | number) {
  const value = Number(raw)
  setTarget({ [axis]: value })

  if (driveDirectly.value)
    setState({ [axis]: value })
}

/** Отпустить: цель в нейтраль, бадди возвращается сам — видно инерцию. */
function release() {
  setTarget(NEUTRAL_AFFECT)
}

/**
 * Пресеты ставят и цель, и состояние: их смысл в точной воспроизводимости
 * между итерациями визуала, а не в наблюдении за переходом.
 */
function applyPreset(point: AffectState) {
  setTarget(point)
  setState(point)
}

const PRESET_LABELS: Record<keyof typeof AFFECT_PRESETS, string> = {
  calmFarm: 'Спокойный фарм',
  onFire: 'Кураж',
  panic: 'Паника',
  defeated: 'Подавленность',
}

/**
 * Заглушки. Настоящая модель событий — рубеж 2, эскалация — рубеж 3.
 * Здесь кнопки только показывают, какой уровень ответа положен событию.
 */
const EVENT_STUBS: { id: string, label: string, tier: EscalationTier }[] = [
  { id: 'kill', label: 'Убийство', tier: 'micro' },
  { id: 'talent', label: 'Взят талант', tier: 'micro' },
  { id: 'respawn', label: 'Респавн', tier: 'micro' },
  { id: 'death', label: 'Смерть', tier: 'mid' },
  { id: 'streak', label: 'Килстрик 3+', tier: 'mid' },
  { id: 'buyback', label: 'Байбек', tier: 'mid' },
  { id: 'aghanims', label: 'Аганим', tier: 'mid' },
  { id: 'rampage', label: 'Рампейдж', tier: 'fullscreen' },
  { id: 'aegis', label: 'Аегис', tier: 'fullscreen' },
]

function fireEvent(stub: (typeof EVENT_STUBS)[number]) {
  lastEvent.value = `${stub.label} → ${ESCALATION_TIERS[stub.tier].label}`
  console.log('[panel] событие-заглушка', stub)
}

/** Координаты точки на плоскости в процентах, для графика. */
function plot(point: AffectState) {
  const [vMin, vMax] = AFFECT_RANGE.valence
  const [aMin, aMax] = AFFECT_RANGE.arousal
  return {
    left: `${((point.valence - vMin) / (vMax - vMin)) * 100}%`,
    bottom: `${((point.arousal - aMin) / (aMax - aMin)) * 100}%`,
  }
}

const fmt = (n: number) => n.toFixed(3)
</script>

<template>
  <div class="panel">
    <header class="panel-head">
      <h1>Пульт</h1>
      <p>
        Верхний уровень: оси ведутся напрямую, сервер не участвует.
        Синтетические снапшоты — рубеж 2.
      </p>
    </header>

    <div class="panel-body">
      <section class="preview" aria-label="Предпросмотр бадди">
        <BuddyStage :asleep="previewAsleep" />
        <label class="check">
          <input v-model="previewAsleep" type="checkbox">
          Предпросмотр сна
        </label>

        <!--
          Визуалы различаются ТОЛЬКО тем, чем несут валентность: возбуждение
          у всех идёт ускорением и дыханием, это единственное отображение
          «движение → аффект» с сильным эффектом. Поэтому подпись под
          переключателем называет именно носителя.
        -->
        <div class="visuals">
          <button
            v-for="(meta, id) in VISUALS"
            :key="id"
            type="button"
            :class="{ active: visualId === id }"
            @click="setVisual(id)"
          >
            {{ meta.label }}
          </button>
        </div>
        <p class="carrier">
          <b>валентность:</b> {{ VISUALS[visualId].valenceCarrier }}<br>
          <span class="hint">{{ VISUALS[visualId].evidence }}</span>
        </p>
      </section>

      <section class="controls">
        <div class="axes">
          <div class="axis">
            <label for="valence">
              Валентность
              <span class="hint">медленная · хорошо ↔ плохо</span>
            </label>
            <input
              id="valence"
              :value="target.valence"
              type="range"
              :min="AFFECT_RANGE.valence[0]"
              :max="AFFECT_RANGE.valence[1]"
              step="0.01"
              @input="drive('valence', ($event.target as HTMLInputElement).value)"
            >
            <div class="readout">
              <span>цель <b>{{ fmt(target.valence) }}</b></span>
              <span>сейчас <b>{{ fmt(state.valence) }}</b></span>
            </div>
          </div>

          <div class="axis">
            <label for="arousal">
              Возбуждение
              <span class="hint">быстрое · спокойно ↔ интенсивно</span>
            </label>
            <input
              id="arousal"
              :value="target.arousal"
              type="range"
              :min="AFFECT_RANGE.arousal[0]"
              :max="AFFECT_RANGE.arousal[1]"
              step="0.01"
              @input="drive('arousal', ($event.target as HTMLInputElement).value)"
            >
            <div class="readout">
              <span>цель <b>{{ fmt(target.arousal) }}</b></span>
              <span>сейчас <b>{{ fmt(state.arousal) }}</b></span>
            </div>
          </div>
        </div>

        <div class="row">
          <label class="check">
            <input v-model="driveDirectly" type="checkbox">
            Вести напрямую <span class="hint">(без инерции)</span>
          </label>
          <button type="button" @click="release">
            Отпустить
          </button>
        </div>

        <!--
          График плоскости. Разрыв между целью и текущей точкой — это и есть
          инерция из ADR-0001, видимая напрямую: возбуждение догоняет цель
          заметно раньше валентности.
        -->
        <div class="plane-wrap">
          <div class="plane">
            <span class="plane-axis-v">валентность →</span>
            <span class="plane-axis-a">возбуждение →</span>
            <i class="dot dot-target" :style="plot(target)" title="цель" />
            <i class="dot dot-state" :style="plot(state)" title="текущее" />
          </div>
        </div>

        <div class="group">
          <h2>Пресеты</h2>
          <div class="row wrap">
            <button
              v-for="(point, key) in AFFECT_PRESETS"
              :key="key"
              type="button"
              @click="applyPreset(point)"
            >
              {{ PRESET_LABELS[key] }}
            </button>
          </div>
        </div>

        <div class="group">
          <h2>События <span class="hint">заглушки, визуала пока нет</span></h2>
          <div class="row wrap">
            <!--
              Подсказка уровня живёт в легенде ниже, а не в title кнопки:
              title перебивает доступное имя, и скринридер зачитывал бы
              «внутри границ виджета, постоянно» вместо названия события.
            -->
            <button
              v-for="stub in EVENT_STUBS"
              :key="stub.id"
              type="button"
              :class="`tier-${stub.tier}`"
              @click="fireEvent(stub)"
            >
              {{ stub.label }}
              <span class="tier">{{ ESCALATION_TIERS[stub.tier].label }}</span>
            </button>
          </div>
          <dl class="legend">
            <template v-for="(tier, key) in ESCALATION_TIERS" :key="key">
              <dt>{{ tier.label }}</dt>
              <dd>{{ tier.hint }}</dd>
            </template>
          </dl>
          <p class="last-event">
            {{ lastEvent ?? 'событий не было' }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.panel {
  min-height: 100vh;
  padding: 24px;
  background: #0d1216;
  color: var(--db-ink);
  font-size: 14px;
  overflow-y: auto;
}

.panel-head h1 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.panel-head p {
  margin: 4px 0 20px;
  color: var(--db-ink-muted);
  max-width: 60ch;
}

.panel-body {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: var(--db-edge-width) solid #21303a;
  border-radius: var(--db-edge-radius);
  background: #070b0e;
}

.visuals {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: var(--db-scene-size);
}

.visuals button.active {
  border-color: var(--db-valence-high);
  background: #1d2a33;
}

.carrier {
  margin: 2px 0 0;
  max-width: var(--db-scene-size);
  font-size: 12px;
  line-height: 1.35;
  color: var(--db-ink-muted);
}

.carrier b {
  color: var(--db-ink);
  font-weight: 600;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 340px;
  flex: 1;
}

.axes {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.axis label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
}

.axis input[type='range'] {
  width: 100%;
  accent-color: var(--db-valence-high);
}

.readout {
  display: flex;
  gap: 16px;
  margin-top: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--db-ink-muted);
}

.readout b {
  color: var(--db-ink);
}

.hint {
  color: var(--db-ink-muted);
  font-weight: 400;
  font-size: 12px;
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.row.wrap {
  flex-wrap: wrap;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

button {
  padding: 6px 10px;
  border: var(--db-edge-width) solid #2b3d49;
  border-radius: var(--db-edge-radius);
  background: #131c23;
  color: var(--db-ink);
  font: inherit;
  cursor: pointer;
}

button:hover {
  border-color: #3f5766;
}

button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--db-valence-high);
  outline-offset: 2px;
}

.tier {
  margin-left: 6px;
  font-size: 11px;
  color: var(--db-ink-muted);
}

.tier-mid {
  border-left-width: 3px;
  border-left-color: #6d7f2b;
}

.tier-fullscreen {
  border-left-width: 3px;
  border-left-color: var(--db-valence-high);
}

.plane-wrap {
  display: flex;
}

.plane {
  position: relative;
  width: 200px;
  height: 200px;
  border: var(--db-edge-width) solid #2b3d49;
  border-radius: var(--db-edge-radius);
  background:
    linear-gradient(to right, transparent 49.7%, #1e2b34 49.7%, #1e2b34 50.3%, transparent 50.3%),
    #0a0f13;
}

.plane-axis-v,
.plane-axis-a {
  position: absolute;
  font-size: 10px;
  color: var(--db-ink-muted);
}

.plane-axis-v {
  bottom: 4px;
  right: 6px;
}

.plane-axis-a {
  top: 4px;
  left: 6px;
  transform-origin: left top;
  transform: rotate(90deg) translateY(-12px);
}

.dot {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: 0 0 -5px -5px;
  border-radius: 50%;
}

.dot-target {
  border: 1px solid var(--db-ink-muted);
  background: transparent;
}

.dot-state {
  background: var(--db-valence-high);
}

.group h2 {
  margin: 0 0 8px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--db-ink-muted);
}

.legend {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 10px;
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--db-ink-muted);
}

.legend dt {
  font-weight: 600;
}

.legend dd {
  margin: 0;
}

.last-event {
  margin: 8px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--db-ink-muted);
}
</style>
