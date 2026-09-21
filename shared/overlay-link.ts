/**
 * Содержание связи оверлея: что клиент делает с пришедшим сообщением.
 *
 * Вынесено из композабла чистой функцией, потому что тут живут три правила,
 * которые ломались бы беззвучно: накопление урона между снапшотами,
 * «`sync` не будит» и сброс на `idle`. В `<script setup>` шва нет, значит
 * нет и теста; здесь интерфейс и есть тестовая поверхность.
 *
 * Применение вынесено в ЭФФЕКТЫ-ДАННЫЕ, а не в переданные колбэки. Так
 * «событие применяется один раз» становится утверждением о длине списка, а
 * не о числе вызовов шпиона — а именно множественное применение и было
 * дефектом, ради которого связь получила единственного владельца
 * (`app/plugins/overlay-link.client.ts`, тикет 14).
 */

import type { AffectState } from './affect'
import type { BuddyEvent } from './events'
import type { OverlayMessage } from './overlay-message'
import type { MatchSnapshot } from './snapshot'
import { NEUTRAL_AFFECT } from './affect'
import { accumulateDamage, baseArousal, baseValence } from './affect-signals'

export interface LinkState {
  /** Последний известный снапшот; `null` — матча нет. */
  snapshot: MatchSnapshot | null
  /** Время последнего РАЗБУДИВШЕГО сообщения; `null` — тишина. */
  lastMessageAt: number | null
  /** Снапшот, относительно которого считается потеря здоровья. */
  previousSnapshot: MatchSnapshot | null
  /** Когда он пришёл. `0` — не приходил. */
  previousAt: number
  /** Накопленный урон: доля здоровья, потерянная за недавнее окно. */
  accumulatedDamage: number
}

export type LinkEffect
  = | { type: 'base', affect: AffectState }
    | { type: 'react', event: BuddyEvent }

export const EMPTY_LINK_STATE: LinkState = {
  snapshot: null,
  lastMessageAt: null,
  previousSnapshot: null,
  previousAt: 0,
  accumulatedDamage: 0,
}

export interface LinkStep {
  state: LinkState
  effects: LinkEffect[]
}

/**
 * Пересчёт объективной основы осей по новому снапшоту.
 *
 * Время между снапшотами берём по приходу, а не из `clock_time`: игра
 * ставится на паузу, а реальный темп потока это не меняет, и урон надо
 * копить по нему.
 */
function absorb(state: LinkState, next: MatchSnapshot, now: number): LinkStep {
  const elapsed = state.previousAt > 0 ? (now - state.previousAt) / 1000 : 0
  const accumulated = accumulateDamage(state.accumulatedDamage, state.previousSnapshot, next, elapsed)

  return {
    state: {
      ...state,
      snapshot: next,
      previousSnapshot: next,
      previousAt: now,
      accumulatedDamage: accumulated,
    },
    effects: [{
      type: 'base',
      affect: { valence: baseValence(next), arousal: baseArousal(next, accumulated) },
    }],
  }
}

/**
 * Применяет одно сообщение: новое состояние связи и что с ним сделать.
 *
 * @param state состояние на предыдущем шаге
 * @param message разобранное сообщение
 * @param now время приёма, мс
 */
export function reduceOverlayMessage(state: LinkState, message: OverlayMessage, now: number): LinkStep {
  switch (message.type) {
    case 'idle':
      return {
        state: { ...EMPTY_LINK_STATE },
        effects: [{ type: 'base', affect: { ...NEUTRAL_AFFECT } }],
      }

    case 'sync': {
      // Синхронизация не будит: она лишь восстанавливает картину для
      // клиента, открывшегося или переподключившегося посреди матча.
      // Живость определяется приходом настоящих обновлений.
      //
      // И принимает снапшот КАК ПЕРВЫЙ, обнуляя накопитель. У сокета
      // включён `autoReconnect`, а потеря здоровья считается разностью с
      // предыдущим снапшотом: без обнуления минута молчания и −60%
      // здоровья пришли бы одним шагом как свежий урон. Запас за это время
      // затухает почти в ноль, разность — нет.
      //
      // Тот же принцип, что у перемотки записи на сервере: «смотрим
      // отсюда», а не «досматриваем в ускорении».
      const fresh: LinkState = { ...EMPTY_LINK_STATE, lastMessageAt: state.lastMessageAt }
      if (!message.snapshot)
        return { state: fresh, effects: [] }

      return absorb(fresh, message.snapshot, now)
    }

    case 'state': {
      const woken: LinkState = { ...state, lastMessageAt: now }
      return absorb(woken, message.snapshot, now)
    }

    case 'event':
      return {
        state: { ...state, lastMessageAt: now },
        effects: [{ type: 'react', event: message.event }],
      }
  }
}

/**
 * Бодрствует ли оверлей прямо сейчас.
 *
 * Здесь, рядом с редьюсером, а не отдельным модулем: правило живости состоит
 * из двух половин, и врозь они читались через три файла. Какие сообщения
 * будят — решает `reduceOverlayMessage` выше, проставляя `lastMessageAt`;
 * сколько тишины считается концом матча — решает эта функция.
 *
 * Время инжектируется, таймеров внутри нет: вызывающий сам решает, чем
 * тикать, а модуль остаётся проверяемым без фейковых часов.
 *
 * Принимает метку, а не `LinkState`: плагин раскладывает состояние по
 * отдельным ячейкам `useState`, и целиком его у вызывающего нет.
 *
 * @param lastMessageAt метка времени последнего РАЗБУДИВШЕГО сообщения,
 *                      `null` — если их ещё не было
 * @param now           текущее время в той же шкале
 * @param timeoutMs     сколько тишины считается концом матча
 */
export function isAwake(lastMessageAt: number | null, now: number, timeoutMs: number): boolean {
  if (lastMessageAt === null)
    return false

  // Часы могут качнуться назад (перевод времени, подстройка монотонности).
  // Отрицательный интервал — не повод будить или усыплять: считаем свежим.
  return now - lastMessageAt < timeoutMs
}
