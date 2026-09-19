/**
 * Интегратор аффекта: чистое ядро, без Vue и без Nuxt.
 *
 * Состояние бадди — точка на плоскости валентность × возбуждение (ADR-0001).
 * Этот модуль отвечает на один вопрос: как состояние движется к цели во
 * времени. Откуда берётся цель — не его дело.
 */

export interface AffectState {
  /** Хорошо ↔ плохо, −1..1. Медленная ось. */
  valence: number
  /** Спокойно ↔ интенсивно, 0..1. Быстрая ось. */
  arousal: number
}

export interface AffectTuning {
  /** Время выхода валентности на ~63% шага, секунды. */
  valenceTau: number
  /** Время выхода возбуждения на ~63% шага, секунды. */
  arousalTau: number
}

export const AFFECT_RANGE = {
  valence: [-1, 1],
  arousal: [0, 1],
} as const

export const NEUTRAL_AFFECT: AffectState = { valence: 0, arousal: 0 }

/**
 * Стартовые значения. Подлежат калибровке на пульте — числа здесь
 * ориентировочные, важно лишь соотношение: возбуждение сильно быстрее.
 */
export const DEFAULT_AFFECT_TUNING: AffectTuning = {
  valenceTau: 12,
  arousalTau: 1.2,
}

/**
 * Потолок одного шага. Если вкладку приморозили (OBS переключил сцену,
 * машина ушла в своп), delta придёт огромной — без потолка бадди скачком
 * окажется в цели. Потолок превращает скачок в обычное доведение.
 */
export const MAX_STEP_SECONDS = 0.25

function clamp(value: number, [min, max]: readonly [number, number]): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Экспоненциальное сглаживание, устойчивое к частоте кадров.
 *
 * Важно, что множитель считается как `exp(-dt / tau)`, а не берётся
 * постоянным на кадр: только так два шага по dt/2 дают ровно то же, что один
 * шаг по dt. В browser source такт задаёт OBS, и он плавает.
 */
function approach(current: number, target: number, tau: number, deltaSeconds: number): number {
  return target + (current - target) * Math.exp(-deltaSeconds / tau)
}

/**
 * Один шаг интегрирования. Возвращает новое состояние, не мутируя входное.
 *
 * Цель клампится до допустимого диапазона до интегрирования, поэтому
 * состояние не может выйти за диапазон, даже если цель пришла испорченной.
 */
export function stepAffect(
  state: AffectState,
  target: AffectState,
  deltaSeconds: number,
  tuning: AffectTuning = DEFAULT_AFFECT_TUNING,
): AffectState {
  const current: AffectState = {
    valence: clamp(state.valence, AFFECT_RANGE.valence),
    arousal: clamp(state.arousal, AFFECT_RANGE.arousal),
  }

  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0)
    return current

  const dt = Math.min(deltaSeconds, MAX_STEP_SECONDS)

  return {
    valence: approach(
      current.valence,
      clamp(target.valence, AFFECT_RANGE.valence),
      tuning.valenceTau,
      dt,
    ),
    arousal: approach(
      current.arousal,
      clamp(target.arousal, AFFECT_RANGE.arousal),
      tuning.arousalTau,
      dt,
    ),
  }
}
