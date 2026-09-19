/**
 * Уровень ответа на событие (спека, §4.2).
 *
 * Тип строковый, а не числовой, намеренно: числом провоцируется арифметика
 * вида `tier + 1`, а переход между уровнями качественный, а не
 * количественный. Уровнем выше — это не «сильнее», это другое поведение.
 */
export type EscalationTier = 'micro' | 'mid' | 'fullscreen'

export const ESCALATION_TIERS: Record<EscalationTier, { label: string, hint: string }> = {
  micro: { label: 'Микро', hint: 'внутри границ виджета, постоянно' },
  mid: { label: 'Средний', hint: 'выход за границы, ~раз в пару минут' },
  fullscreen: { label: 'Полный экран', hint: '2–3 раза за матч' },
}
