/**
 * Механика реакции на событие. Чистый модуль: ни Vue, ни three.
 *
 * Реакция складывается из ДВУХ механизмов, разделённых по времени, и это
 * вынужденно, а не изящества ради. Событие по-настоящему меняет ход матча,
 * значит должно сдвинуть ЦЕЛЬ аффекта — медленно и надолго. Но рывок в
 * момент события обязан уложиться в 100-200 мс, а постоянная времени
 * валентности — двенадцать секунд. Одним механизмом это не сделать: либо
 * валентность перестаёт быть медленной осью (ломая ADR-0001), либо рывка
 * нет вовсе.
 *
 * Отсюда: сдвиг цели + отдельный быстро затухающий ИМПУЛЬС поверх.
 */

import type { AffectState } from './affect'

/**
 * Постоянная времени импульса. На порядок быстрее даже возбуждения, иначе
 * это уже не рывок, а второй режим.
 */
export const IMPULSE_TAU = 0.4

/** Ниже этого импульс считается погасшим и обнуляется. */
const IMPULSE_EPSILON = 0.002

/**
 * Время восстановления свежести события с нуля до ~63%.
 *
 * Приглушение по частоте сделано расходуемым запасом, а не счётчиком за
 * матч и не скользящим окном. Счётчик даёт неверное поведение к концу
 * матча: если не умирал двадцать минут, десятая смерть всё равно была бы
 * приглушена, хотя по ощущению она как первая. У окна жёсткий край —
 * событие резко дешевеет ровно в тот миг, когда предыдущее из окна выпало.
 *
 * Запас непрерывен, стоит одного числа на тип события и совпадает с тем,
 * как привыкание устроено: оно ВОССТАНАВЛИВАЕТСЯ со временем.
 */
export const FRESHNESS_TAU = 75

/** Сколько свежести забирает одно событие. */
export const FRESHNESS_COST = 0.55

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0
}

/**
 * Восстановление свежести за прошедшее время.
 *
 * Экспоненциально, как и всё остальное в проекте: только так результат не
 * зависит от того, как часто вызывали.
 */
export function recoverFreshness(value: number, elapsedSeconds: number, tau = FRESHNESS_TAU): number {
  const current = clamp01(value)
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0)
    return current

  return 1 - (1 - current) * Math.exp(-elapsedSeconds / tau)
}

/** Трата свежести при срабатывании события. */
export function spendFreshness(value: number, cost = FRESHNESS_COST): number {
  return clamp01(clamp01(value) - Math.max(0, cost))
}

/**
 * Итоговый вес события: эмоциональная амплитуда, приглушённая свежестью.
 *
 * Полностью выдохшееся событие не исчезает, а оседает до трети: третья
 * смерть подряд должна быть заметна слабее первой, но не невидима.
 */
export function eventWeight(amplitude: number, freshness: number): number {
  return clamp01(amplitude) * (0.33 + clamp01(freshness) * 0.67)
}

/** Шаг затухания импульса. Возвращает новое значение, не мутируя входное. */
export function stepImpulse(
  impulse: AffectState,
  deltaSeconds: number,
  tau = IMPULSE_TAU,
): AffectState {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0)
    return impulse

  const decay = Math.exp(-Math.min(deltaSeconds, 0.25) / tau)
  const valence = impulse.valence * decay
  const arousal = impulse.arousal * decay

  return {
    valence: Math.abs(valence) < IMPULSE_EPSILON ? 0 : valence,
    arousal: Math.abs(arousal) < IMPULSE_EPSILON ? 0 : arousal,
  }
}
