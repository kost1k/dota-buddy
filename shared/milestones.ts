/**
 * Вехи матча: необратимые достижения.
 *
 * Отличаются от событий не силой, а природой. Событие случается и проходит;
 * веха остаётся. Поэтому вехи не участвуют в приглушении по свежести —
 * приглушать нечего, повтора не будет, — и наращивают структуру бадди, а не
 * толкают точку аффекта надолго.
 *
 * Именно вехи закрывают пробел, названный в Q24: обе оси аффекта ВОЗВРАТНЫ,
 * через минуту после события бадди возвращается примерно туда же. Без
 * накопления сорокаминутный матч не имеет видимой дуги, и зритель, зашедший
 * на сороковой минуте, видит то же, что на пятой.
 *
 * Таланты считаются числом, аганим и шард — отдельными признаками. Таланты
 * берутся четырежды и однородны: счётчик читается как «он вырос» и не
 * требует различать, какой именно взят. Аганим и шард единичны и именованы,
 * и отдельный элемент ничего не стоит незнающему зрителю — появление нового
 * признака читается как «что-то приобретено» независимо от того, понимаешь
 * ли ты название.
 */

export interface Milestones {
  /** Взятые таланты, 0..4. */
  talents: number
  aghanim: boolean
  shard: boolean
}

export type MilestoneKind = 'talent' | 'aghanim' | 'shard'

export const MAX_TALENTS = 4

export const NO_MILESTONES: Milestones = { talents: 0, aghanim: false, shard: false }

/** Общая достроенность, 0..1 — для непрерывных эффектов. */
export function milestoneProgress({ talents, aghanim, shard }: Milestones): number {
  const parts = Math.min(talents, MAX_TALENTS) / MAX_TALENTS + (aghanim ? 1 : 0) + (shard ? 1 : 0)
  return parts / 3
}

/** Применение вехи. Возвращает новый объект; повторное применение безвредно. */
export function applyMilestone(current: Milestones, kind: MilestoneKind): Milestones {
  switch (kind) {
    case 'talent':
      return { ...current, talents: Math.min(current.talents + 1, MAX_TALENTS) }
    case 'aghanim':
      return { ...current, aghanim: true }
    case 'shard':
      return { ...current, shard: true }
  }
}
