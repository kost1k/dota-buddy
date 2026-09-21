<script setup lang="ts">
import type { AffectState } from '#shared/affect'
import { AFFECT_PRESET_LABELS, AFFECT_PRESETS, AFFECT_RANGE, NEUTRAL_AFFECT, normalizeAffect } from '#shared/affect'
import { ESCALATION_TIERS, EVENT_KINDS, eventSummary } from '#shared/events'
import { REPLAY_MODE_LABELS, REPLAY_SPEEDS, shownPacket } from '#shared/replay'
import { SCENARIOS } from '#shared/synthetic'
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

const { state, target, setBase, setState, clearReactions } = useAffect()
const { visualId, setVisual } = useVisual()
const { fire } = useReactions()
const sender = useSnapshotSender()
const replay = useReplay()

const replayFiles = computed(() => replay.state.value?.files ?? [])
const replayTotal = computed(() => replay.state.value?.total ?? 0)
const replayIndex = computed(() => replay.state.value?.index ?? 0)
const replayLoaded = computed(() => replayTotal.value > 0)
const replayPlaying = computed(() => replay.state.value?.mode === 'playing')

/**
 * Ползунок перемотки ведёт СВОЁ значение, а не серверное.
 *
 * Состояние опрашивается раз в секунду, и привязка прямо к нему затирала
 * позицию под пальцем: браузер к отпусканию видел прежнее значение и не слал
 * `change` вовсе — перемотка не срабатывала ни разу. Пока ползунок ведут,
 * сервер его не трогает; после отпускания слежение возвращается.
 */
const scrubbing = ref(false)
const scrubValue = ref(0)

watch(() => replay.state.value, (status) => {
  if (!scrubbing.value && status)
    scrubValue.value = shownPacket(status)
}, { immediate: true, deep: true })

function commitSeek() {
  scrubbing.value = false
  replay.seek(scrubValue.value)
}

// Пульт слушает WebSocket наравне с оверлеем: иначе нижний уровень
// проверял бы только путь «туда», а смысл именно в круге — пакет уходит на
// сервер и возвращается разобранным.
const { snapshot: received, awake } = useOverlayLink()

useAffectTicker()

/** Когда включено, ползунки пишут состояние напрямую — инерции не видно. */
const driveDirectly = ref(false)
const previewAsleep = ref(false)
const lastEventLabel = ref<string | null>(null)

function drive(axis: keyof AffectState, raw: string | number) {
  const value = Number(raw)
  setBase({ [axis]: value })

  if (driveDirectly.value)
    setState({ [axis]: value })
}

/** Отпустить: основа в нейтраль, бадди возвращается сам — видно инерцию. */
function release() {
  setBase(NEUTRAL_AFFECT)
}

/**
 * Пресеты ставят и цель, и состояние: их смысл в точной воспроизводимости
 * между итерациями визуала, а не в наблюдении за переходом.
 */
function applyPreset(point: AffectState) {
  // След события обнуляется: цель есть `base + offset`, и без сброса пресет
  // ставил бы не ту точку, которую называет. «Отпустить» ниже этим не
  // пользуется намеренно — там инерция и есть смысл кнопки.
  clearReactions()
  setBase(point)
  setState(point)
}

function fireEvent(kind: (typeof EVENT_KINDS)[number]) {
  const event = fire(kind.id)
  if (event)
    lastEventLabel.value = eventSummary(kind, event.weight)
}

/** Доли от диапазона — в проценты для графика. Считает домен, верстает это. */
function plot(point: AffectState) {
  const unit = normalizeAffect(point)
  return { left: `${unit.valence * 100}%`, bottom: `${unit.arousal * 100}%` }
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
          <b>форма:</b> {{ VISUALS[visualId].form }}<br>
          <b>валентность:</b> {{ VISUALS[visualId].valenceCarrier }}
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
              {{ AFFECT_PRESET_LABELS[key] }}
            </button>
          </div>
        </div>

        <!--
          Нижний уровень пульта: пакеты уходят на сервер тем же путём, что и
          настоящая игра, и возвращаются событиями по WebSocket. Верхний
          уровень (кнопки ниже) бьёт по реакциям напрямую — он быстрее для
          итераций по визуалу, но серверную часть не проверяет вовсе.
        -->
        <div class="group">
          <h2>
            Сценарии
            <span class="hint">снапшоты в POST /api/gsi, реальная каденция</span>
          </h2>
          <div class="row wrap">
            <button
              v-for="scenario in SCENARIOS"
              :key="scenario.id"
              type="button"
              :disabled="sender.running.value !== null"
              :class="{ active: sender.running.value === scenario.id }"
              @click="sender.run(scenario)"
            >
              {{ scenario.label }}
            </button>
            <button type="button" @click="sender.reset()">
              Сброс
            </button>
          </div>
          <p class="last-event">
            вернулось: {{ received ? `${received.hero.alive ? 'жив' : 'мёртв'}, здоровье ${Math.round(received.hero.healthFraction * 100)}%` : 'ничего' }} ·
            связь {{ awake ? 'есть' : 'тишина' }}
          </p>
          <p class="last-event">
            отправлено пакетов: {{ sender.sent.value }} ·
            здоровье {{ Math.round(sender.snapshot.value.hero.healthFraction * 100) }}% ·
            счёт {{ sender.snapshot.value.map.radiantScore }}:{{ sender.snapshot.value.map.direScore }}
            <template v-if="sender.error.value">
              <br><b>ошибка: {{ sender.error.value }}</b>
            </template>
          </p>
        </div>

        <!--
          Второй источник пакетов рядом со сценариями, и разница между ними
          принципиальна: сценарии собраны нами из тех же представлений, по
          которым написан разбор, а запись — то, что действительно прислала
          Dota. Темп отсчитывает сервер: в неактивной вкладке браузерные
          таймеры душатся до одного срабатывания в минуту, а пульт почти
          всегда не в фокусе.
        -->
        <div class="group">
          <h2>
            Воспроизведение
            <span class="hint">запись с игрового ПК, её собственные паузы</span>
          </h2>

          <div v-if="replayFiles.length === 0" class="last-event">
            записей нет — положи <code>.jsonl</code> в каталог
            <code>recordings/</code> и обнови
          </div>

          <template v-else>
            <div class="row wrap">
              <select
                :value="replay.state.value?.file ?? ''"
                @change="replay.load(($event.target as HTMLSelectElement).value)"
              >
                <option value="" disabled>
                  выбрать запись
                </option>
                <option v-for="file in replayFiles" :key="file" :value="file">
                  {{ file }}
                </option>
              </select>
              <button
                type="button"
                :disabled="!replayLoaded"
                :class="{ active: replayPlaying }"
                @click="replayPlaying ? replay.pause() : replay.play()"
              >
                {{ replayPlaying ? 'Пауза' : 'Играть' }}
              </button>
              <button type="button" :disabled="!replayLoaded" @click="replay.stop()">
                Стоп
              </button>
            </div>

            <div class="row wrap">
              <button
                v-for="speed in REPLAY_SPEEDS"
                :key="speed"
                type="button"
                :class="{ active: replay.state.value?.speed === speed }"
                @click="replay.setSpeed(speed)"
              >
                {{ speed }}×
              </button>
            </div>

            <!--
              Перемотка уходит на сервер по `change`, а не по `input`: иначе
              каждый пиксель ползунка шёл бы отдельным запросом, а каждая
              перемотка сбрасывает состояние матча.
            -->
            <input
              v-model.number="scrubValue"
              class="scrub"
              type="range"
              min="0"
              :max="Math.max(replayTotal - 1, 0)"
              :disabled="!replayLoaded"
              @pointerdown="scrubbing = true"
              @input="scrubbing = true"
              @change="commitSeek"
            >

            <!--
              Подпись считает СЫГРАННЫЕ пакеты, ползунок выше показывает
              ПОКАЗАННЫЙ, поэтому она на единицу больше. Так и надо: человеку
              нужно «сколько прошло», ползунку — номер для `seek`.
            -->
            <p class="last-event">
              {{ replay.state.value ? REPLAY_MODE_LABELS[replay.state.value.mode] : '—' }} ·
              пакет {{ replayIndex }} из {{ replayTotal }} ·
              скорость {{ replay.state.value?.speed ?? 1 }}×
              <template v-if="replay.error.value">
                <br><b>ошибка: {{ replay.error.value }}</b>
              </template>
            </p>
            <p class="last-event">
              перемотка начинает с чистого состояния матча: события из
              пропущенного куска не срабатывают
            </p>
          </template>
        </div>

        <div class="group">
          <h2>
            События
            <span class="hint">мимо сервера, полной амплитудой — для сценариев ниже свежесть считает сервер</span>
          </h2>
          <div class="row wrap">
            <!--
              Подсказка уровня живёт в легенде ниже, а не в title кнопки:
              title перебивает доступное имя, и скринридер зачитывал бы
              «внутри границ виджета, постоянно» вместо названия события.
            -->
            <button
              v-for="kind in EVENT_KINDS"
              :key="kind.id"
              type="button"
              :class="`tier-${kind.tier}`"
              @click="fireEvent(kind)"
            >
              {{ kind.label }}
              <span class="tier">{{ ESCALATION_TIERS[kind.tier].label }}</span>
            </button>
          </div>
          <dl class="legend">
            <template v-for="(tier, key) in ESCALATION_TIERS" :key="key">
              <dt>{{ tier.label }}</dt>
              <dd>{{ tier.hint }}</dd>
            </template>
          </dl>
          <p class="last-event">
            {{ lastEventLabel ?? 'событий не было' }}
          </p>
          <p class="last-event">
            уровень {{ received?.hero.level ?? '—' }} ·
            аганим {{ received?.hero.aghanimsScepter ? 'есть' : 'нет' }} ·
            шард {{ received?.hero.aghanimsShard ? 'есть' : 'нет' }} ·
            счёт {{ received ? `${received.map.radiantScore}:${received.map.direScore}` : '—' }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.panel {
  /*
    Высота фиксированная, а не минимальная: прокрутку страницы отключает
    `app.vue` — оверлею полосы прокрутки поверх игры не нужны, — поэтому
    прокручиваться пульт обязан сам, а при `min-height` он растёт под
    содержимое и не прокручивается никогда.
  */
  height: 100vh;
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

button:disabled {
  opacity: 0.45;
  cursor: default;
}

button:hover:not(:disabled) {
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

.scrub {
  width: 100%;
  margin: 8px 0 0;
}

.last-event {
  margin: 8px 0 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--db-ink-muted);
}
</style>
