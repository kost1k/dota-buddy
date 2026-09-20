/**
 * Каталог событий матча.
 *
 * До сих пор он жил локальной константой пульта — намеренно, пока реакции
 * были заглушками. Теперь у события есть амплитуда и направление в
 * плоскости аффекта, то есть это домен, а не оснастка.
 *
 * На рубеже 2 сервер начнёт выводить эти события из снапшотов (ADR-0002).
 * Каталог типов при этом не изменится — изменится только то, откуда
 * приходит срабатывание.
 */

import type { AffectState } from './affect'
import type { EscalationTier } from './escalation'
import type { MilestoneKind } from './milestones'

export interface EventKind {
  id: string
  label: string
  tier: EscalationTier
  /**
   * Эмоциональная амплитуда, 0..1 — насколько событие накрывает стримера.
   *
   * Именно амплитуда, а не редкость и не влияние на исход матча: зритель
   * смотрит на стримера, а обе другие метрики требуют знания Доты.
   */
  amplitude: number
  /**
   * Направление сдвига в плоскости аффекта. Длина не важна — масштаб даёт
   * вес; важен только знак и соотношение осей.
   */
  direction: AffectState
  /**
   * Событие случается считанные разы за матч, и свежесть на него не
   * тратится: приглушать нечего.
   *
   * Флаг явный, а не выведенный из того, что событие «вроде бы не
   * повторяется». Молчаливое совпадение сломалось бы беззвучно, стоит
   * кому-нибудь добавить повторяющуюся веху.
   */
  oneShot?: boolean
  /** Какую веху отмечает, если отмечает. */
  milestone?: MilestoneKind
}

export const EVENT_KINDS: EventKind[] = [
  { id: 'kill', label: 'Убийство', tier: 'micro', amplitude: 0.35, direction: { valence: 0.7, arousal: 0.6 } },
  { id: 'levelUp', label: 'Новый уровень', tier: 'micro', amplitude: 0.3, direction: { valence: 0.5, arousal: 0.25 } },
  { id: 'levelLandmark', label: 'Круглый уровень', tier: 'mid', amplitude: 0.5, direction: { valence: 0.6, arousal: 0.4 } },
  { id: 'respawn', label: 'Респавн', tier: 'micro', amplitude: 0.25, direction: { valence: 0.4, arousal: 0.3 } },
  { id: 'death', label: 'Смерть', tier: 'mid', amplitude: 0.75, direction: { valence: -0.9, arousal: 0.7 } },
  { id: 'streak', label: 'Килстрик 3+', tier: 'mid', amplitude: 0.7, direction: { valence: 0.9, arousal: 0.8 } },
  { id: 'buyback', label: 'Байбек', tier: 'mid', amplitude: 0.6, direction: { valence: -0.3, arousal: 0.9 } },
  { id: 'aghanims', label: 'Аганим', tier: 'mid', amplitude: 0.7, direction: { valence: 0.8, arousal: 0.4 }, oneShot: true, milestone: 'aghanim' },
  { id: 'shard', label: 'Шард', tier: 'mid', amplitude: 0.55, direction: { valence: 0.7, arousal: 0.35 }, oneShot: true, milestone: 'shard' },
  { id: 'rampage', label: 'Рампейдж', tier: 'fullscreen', amplitude: 1, direction: { valence: 1, arousal: 1 } },
  { id: 'aegis', label: 'Аегис', tier: 'fullscreen', amplitude: 0.9, direction: { valence: 0.9, arousal: 0.8 } },
]

/**
 * Сработавшее событие, уже с посчитанным весом.
 *
 * Вес считается ОДИН раз при срабатывании и дальше не пересчитывается:
 * свежесть к моменту отрисовки успела бы восстановиться, и одно и то же
 * событие выглядело бы по-разному в зависимости от того, когда на него
 * посмотрели.
 */
export interface BuddyEvent {
  /** Уникален для каждого срабатывания: по нему визуал понимает, что оно новое. */
  id: number
  kindId: string
  tier: EscalationTier
  /** Амплитуда, приглушённая свежестью, 0..1. */
  weight: number
  direction: AffectState
}

export function findEventKind(id: string): EventKind | undefined {
  return EVENT_KINDS.find(kind => kind.id === id)
}
