/**
 * Контракт визуала.
 *
 * Визуал — одна из взаимозаменяемых форм бадди. Он получает ровно этот
 * набор и не знает больше ничего: ни про WebSocket, ни про снапшоты, ни про
 * периферию.
 *
 * Смысл контракта — в том, чтобы новая фича добавлялась ОДИН раз, а не
 * умножалась на число визуалов. Без него пятый визуал обошёлся бы впятеро
 * дороже первого, и фичи перестали бы добавляться.
 *
 * Каналы перечислены здесь намеренно и исчерпывающе: сколько каналов
 * объект в 135 px вообще выдерживает — предмет разведки, а не вкуса.
 * Ответ: ДВА раздельных на две оси, всё остальное обязано быть избыточным
 * (`docs/research/shape-motion-perception.md`).
 */

import type { EscalationTier } from './escalation'

export interface BuddyEvent {
  id: string
  tier: EscalationTier
  /**
   * Момент, когда реакция должна начаться, в шкале `performance.now()`.
   *
   * Задержку выдерживает общий слой, а не визуал: разведка показала, что
   * ДРОЖАНИЕ задержки разрушает ощущение причинности быстрее, чем сама
   * задержка. Если бы каждый визуал считал её сам, они бы разошлись.
   */
  startAt: number
}

export interface VisualProps {
  /** −1..1, медленная ось. */
  valence: number
  /** 0..1, быстрая ось. */
  arousal: number
  /** Счётчик необратимых достижений матча. Рубеж 3. */
  milestones: number
  /** Текущий уровень ответа на событие, если он активен. Рубеж 3. */
  escalationTier: EscalationTier | null
  /** Последнее событие, уже с выдержанной задержкой. Рубеж 3. */
  event: BuddyEvent | null
  /** Режим сна: вне матча. */
  asleep: boolean
}

export type VisualId = 'eyeMouth' | 'mouthOnly' | 'angular' | 'phase' | 'flat'

export interface VisualMeta {
  label: string
  /** Чем этот визуал несёт валентность — единственное, чем они различаются. */
  valenceCarrier: string
  /** Доказательность носителя по разведке. */
  evidence: string
  /** '3d' рисуется в общем канвасе, 'dom' — сам собой. */
  kind: '3d' | 'dom'
}

export const VISUALS: Record<VisualId, VisualMeta> = {
  eyeMouth: {
    label: 'Глаз и рот',
    valenceCarrier: 'кривизна рта, геометрия век, светлота',
    evidence: 'сильнейшая: рот — №1 носитель валентности, читается при 15×10 px',
    kind: '3d',
  },
  mouthOnly: {
    label: 'Только рот',
    valenceCarrier: 'кривизна рта, светлота',
    evidence: 'тот же носитель в одиночку; снимает ассоциацию со слежкой',
    kind: '3d',
  },
  angular: {
    label: 'Угловатость',
    valenceCarrier: 'угловатость низкочастотного силуэта',
    evidence: 'реальная, но скромная: 42% против 28%, механизм оспорен',
    kind: '3d',
  },
  phase: {
    label: 'Фазовая когерентность',
    valenceCarrier: 'согласованность фаз долей тела',
    evidence: 'подтверждена для биологического движения, на абстракции не проверялась',
    kind: '3d',
  },
  flat: {
    label: 'Плоский силуэт',
    valenceCarrier: 'кривизна рта, светлота — без объёма и бликов',
    evidence: 'края, несомые яркостью, переживают подвыборку цвета и даунскейл',
    kind: 'dom',
  },
}

export const DEFAULT_VISUAL: VisualId = 'eyeMouth'

export function isVisualId(value: unknown): value is VisualId {
  return typeof value === 'string' && value in VISUALS
}
