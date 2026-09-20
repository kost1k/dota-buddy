/**
 * Вывод событий сравнением снапшотов. Чистая функция.
 *
 * Всё, что этот модуль выводит, — смерть, респавн, убийство, уровень,
 * аганим, шард, байбек — касается СВОЕГО героя, а его состояние приходит
 * только снапшотом. Отсюда дифф и память о предыдущем состоянии.
 *
 * Блок `events` тут не используется намеренно, а не по незнанию: он
 * доставляется и обычному игроку (измерено 2026-09-20), но описывает
 * события всего матча и требует дедупликации скользящего окна. Это другой
 * источник с другой механикой, и заводить его надо отдельно, а не
 * подмешивать в диффинг своего героя.
 *
 * Память живёт на сервере (ADR-0002): browser source в OBS перезагружается
 * при смене сцены, при `Refresh browser`, при падении, и клиентский диффинг
 * терял бы контекст каждый раз — бадди забывал бы, что стример уже умирал.
 *
 * Модуль намеренно возвращает только ИДЕНТИФИКАТОРЫ типов. Вес считает
 * вызывающий: для этого нужна свежесть, а она состояние, и держать её в
 * чистой функции нечем.
 */

import type { MatchSnapshot } from './snapshot'
import { isLevelLandmark } from './milestones'

/** Килстрик считается событием начиная с этого значения. */
const STREAK_THRESHOLD = 3

/**
 * @param previous предыдущий снапшот; `null` на первом пакете
 * @returns идентификаторы сработавших типов, в порядке возникновения
 */
export function deriveEvents(previous: MatchSnapshot | null, next: MatchSnapshot): string[] {
  // На первом снапшоте не сравнивать не с чем. Иначе при подключении
  // посреди матча сработало бы всё разом: и аганим, и уровень, и стрик.
  if (!previous)
    return []

  const events: string[] = []
  const before = previous.hero
  const after = next.hero

  if (before.alive && !after.alive)
    events.push('death')
  if (!before.alive && after.alive)
    events.push('respawn')

  if (next.player.kills > previous.player.kills)
    events.push('kill')

  // Килстрик отмечается только на росте: держать его на тройке несколько
  // снапшотов подряд — не повод повторять событие.
  if (next.player.killStreak >= STREAK_THRESHOLD
    && next.player.killStreak > previous.player.killStreak) {
    events.push('streak')
  }

  if (after.level > before.level) {
    events.push(isLevelLandmark(after.level) ? 'levelLandmark' : 'levelUp')
  }

  if (!before.aghanimsScepter && after.aghanimsScepter)
    events.push('aghanims')
  if (!before.aghanimsShard && after.aghanimsShard)
    events.push('shard')

  // Байбек виден по тому, что кулдаун вырос с нуля: сам факт покупки GSI
  // не отдаёт.
  if (before.buybackCooldown <= 0 && after.buybackCooldown > 0)
    events.push('buyback')

  return events
}

/**
 * Граница матча: всё серверное состояние сбрасывается.
 *
 * Смена `matchId` очевидна, но её одной мало — в реванше или после
 * перезапуска клиента идентификатор может прийти тем же, а состояние уже
 * другое. Поэтому ещё и откат счётчиков назад.
 */
export function isMatchBoundary(previous: MatchSnapshot | null, next: MatchSnapshot): boolean {
  if (!previous)
    return false

  if (previous.map.matchId !== next.map.matchId)
    return true

  // Счётчики матча монотонны. Если они уменьшились — это другой матч.
  return next.player.kills < previous.player.kills
    || next.player.deaths < previous.player.deaths
    || next.hero.level < previous.hero.level
}
