/**
 * Отображение сигналов матча на оси аффекта. Чистый модуль.
 *
 * Жёсткое условие, на котором сломался прототип: оси питаются ТОЛЬКО
 * причинно наблюдаемыми сигналами — теми, что зритель видит на экране
 * одновременно с бадди. `sweatLevel` кормился дельтами GPM, которые
 * меняются незаметно и не совпадают по времени ни с чем, и потому его
 * поведение читалось случайным.
 *
 * Отсюда же список того, чего здесь НЕТ: GPM и XPM (медленные агрегаты),
 * готовность ультимейта (единственный сигнал, требующий знания Доты),
 * плотность событий (уже учтена свежестью — класть её ещё и в ось значит
 * считать одно дважды).
 */

import type { MatchSnapshot } from './snapshot'
import { scoreLead } from './snapshot'

/**
 * Преимущество в счёте, при котором валентность выходит почти на предел.
 *
 * Мягкое насыщение через гиперболический тангенс: разрыв в тридцать килов
 * не должен ощущаться втрое сильнее разрыва в десять — к этому моменту
 * всё уже ясно.
 */
const LEAD_SCALE = 12

/** Потолок основы: остаток шкалы оставлен смещению от событий. */
const BASE_VALENCE_LIMIT = 0.75

/** Скорость потери здоровья, дающая полное возбуждение: доля в секунду. */
const LETHAL_LOSS_RATE = 0.3

/** Вклад обездвиживающих состояний и прочих дебаффов. */
const DISABLE_AROUSAL = 0.5
const DEBUFF_AROUSAL = 0.25

/** Вклад низкого здоровья. Квадратично — заметен только у самой грани. */
const LOW_HEALTH_AROUSAL = 0.4

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Медленная основа валентности: преимущество в счёте.
 *
 * Счёт — единственный доступный кросс-командный сигнал: в обычном матче
 * GSI отдаёт только своего героя. Он же и подходит по темпу — меняется
 * редко и отражает «как вообще идут дела», а валентность обязана дрейфовать,
 * а не прыгать.
 *
 * Доля здоровья сюда НЕ идёт: она возвращается к единице за десятки секунд
 * и шумела бы на медленной оси.
 */
export function baseValence(snapshot: MatchSnapshot): number {
  return Math.tanh(scoreLead(snapshot) / LEAD_SCALE) * BASE_VALENCE_LIMIT
}

/**
 * Основа возбуждения: скорость убывания здоровья и дебаффы.
 *
 * Скорость, а не уровень — прямое следствие замера: возбуждение несёт
 * ускорение, а не положение. Тревожит не «осталось 40%», а «сняли 40% за
 * две секунды». Полное здоровье под непрерывным уроном обязано давать
 * напряжение, стабильные 30% в лесу — нет.
 *
 * Низкое здоровье добавлено поправкой, иначе тихое умирание от яда не дало
 * бы ничего.
 *
 * @param previous предыдущий снапшот; `null` — считаем, что урона не было
 * @param next текущий снапшот
 * @param elapsedSeconds время между снапшотами
 */
export function baseArousal(
  previous: MatchSnapshot | null,
  next: MatchSnapshot,
  elapsedSeconds: number,
): number {
  const hero = next.hero

  let damage = 0
  if (previous && Number.isFinite(elapsedSeconds) && elapsedSeconds > 0) {
    const lost = previous.hero.healthFraction - hero.healthFraction
    if (lost > 0)
      damage = clamp(lost / elapsedSeconds / LETHAL_LOSS_RATE, 0, 1)
  }

  // Обездвиживающие состояния и прочие дебаффы не складываются между собой:
  // два дебаффа разом не вдвое тревожнее одного, и бюджет оси тратить на
  // это незачем.
  const disabled = hero.stunned || hero.hexed
  const debuffed = hero.silenced || hero.hasDebuff
  const status = disabled ? DISABLE_AROUSAL : (debuffed ? DEBUFF_AROUSAL : 0)

  const lowHealth = hero.alive
    ? (1 - hero.healthFraction) ** 2 * LOW_HEALTH_AROUSAL
    : 0

  return clamp(damage + status + lowHealth, 0, 1)
}
