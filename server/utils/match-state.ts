import type { BuddyEvent } from '#shared/events'
import type { MatchSnapshot } from '#shared/snapshot'
import { deriveEvents } from '#shared/derive'
import { findEventKind } from '#shared/events'
import { eventWeight, recoverFreshness, spendFreshness } from '#shared/reaction'

/**
 * Состояние матча на сервере.
 *
 * Здесь живёт то, что обязано пережить перезагрузку browser source: она
 * случается при смене сцены в OBS, при `Refresh browser` и при падении
 * вкладки. Клиентская память теряла бы контекст каждый раз, и бадди
 * забывал бы, что стример уже умирал.
 *
 * Состояние одно на процесс. Это верно ровно потому, что оверлей локальный
 * и поток GSI один; при раздаче другим стримерам понадобится ключевание по
 * источнику.
 */

interface MatchState {
  previous: MatchSnapshot | null
  /** Свежесть по типу события: расходуется при срабатывании, растёт со временем. */
  freshness: Record<string, number>
  seenAt: Record<string, number>
  counter: number
}

function emptyState(): MatchState {
  return { previous: null, freshness: {}, seenAt: {}, counter: 0 }
}

let state = emptyState()

export const matchState = {
  snapshot: () => state.previous,

  reset() {
    state = emptyState()
  },

  /**
   * Принимает снапшот, возвращает сработавшие события с посчитанным весом.
   *
   * Вес считается ЗДЕСЬ и один раз. Пересчёт при отрисовке дал бы разный
   * результат в зависимости от того, когда на событие посмотрели: свежесть
   * к тому моменту успела бы восстановиться.
   *
   * Границу матча здесь НЕ ловим, хотя раньше ловили. Сброс обязан быть
   * виден оверлею, а рассылка живёт в приёмном модуле — значит и решение о
   * сбросе живёт там же (`endMatch` в `ingest.ts`). Два владельца одного
   * правила разошлись бы молча.
   */
  ingest(next: MatchSnapshot, now = Date.now()): BuddyEvent[] {
    const kinds = deriveEvents(state.previous, next)
    state.previous = next

    const events: BuddyEvent[] = []
    for (const kindId of kinds) {
      const kind = findEventKind(kindId)
      if (!kind)
        continue

      // Однократные события свежесть не тратят и не читают: приглушать
      // нечего, повтора не будет.
      let weight = kind.amplitude
      if (!kind.oneShot) {
        const previousAt = state.seenAt[kindId]
        const stored = state.freshness[kindId] ?? 1
        const current = previousAt === undefined
          ? 1
          : recoverFreshness(stored, (now - previousAt) / 1000)

        weight = eventWeight(kind.amplitude, current)
        state.freshness[kindId] = spendFreshness(current)
        state.seenAt[kindId] = now
      }

      state.counter += 1
      events.push({
        id: state.counter,
        kindId: kind.id,
        tier: kind.tier,
        weight,
        direction: kind.direction,
      })
    }

    return events
  },
}
