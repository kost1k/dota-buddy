import type { AffectState } from '#shared/affect'
import type { BuddyEvent } from '#shared/events'
import { findEventKind } from '#shared/events'
import { eventWeight, recoverFreshness, spendFreshness } from '#shared/reaction'

/**
 * Срабатывание событий: свежесть, вес, сдвиг цели и импульс.
 *
 * Свежесть по-хорошему принадлежит серверу — она состояние матча и обязана
 * пережить перезагрузку browser source, иначе после смены сцены в OBS бадди
 * сочтёт десятую смерть первой. Пока серверного вывода событий нет
 * (рубеж 2), счётчики живут здесь, и это временно.
 *
 * Выбор профиля движения тут не делается и не будет: профили у каждого
 * визуала свои, и знать о них должен только визуал — иначе каждый новый
 * потребовал бы правки общего слоя.
 */

/** Насколько вес события сдвигает ЦЕЛЬ аффекта — медленное последствие. */
const TARGET_SHIFT = 0.55

/** Насколько вес события даёт мгновенный рывок. Сильнее сдвига намеренно. */
const IMPULSE_SCALE = 0.9

export function useReactions() {
  const { target, setTarget, addImpulse } = useAffect()

  /** Свежесть по типу события и время последнего пересчёта. */
  const freshness = useState<Record<string, number>>('reactions:freshness', () => ({}))
  const seenAt = useState<Record<string, number>>('reactions:seenAt', () => ({}))
  const lastEvent = useState<BuddyEvent | null>('reactions:last', () => null)
  const counter = useState<number>('reactions:counter', () => 0)

  function fire(kindId: string, now = Date.now()): BuddyEvent | null {
    const kind = findEventKind(kindId)
    if (!kind)
      return null

    const previousAt = seenAt.value[kindId]
    const stored = freshness.value[kindId] ?? 1
    const current = previousAt === undefined
      ? 1
      : recoverFreshness(stored, (now - previousAt) / 1000)

    // Вес считается ОДИН раз, здесь. Пересчёт при отрисовке дал бы разный
    // результат в зависимости от того, когда на событие посмотрели.
    const weight = eventWeight(kind.amplitude, current)

    freshness.value = { ...freshness.value, [kindId]: spendFreshness(current) }
    seenAt.value = { ...seenAt.value, [kindId]: now }
    counter.value += 1

    const event: BuddyEvent = {
      id: counter.value,
      kindId: kind.id,
      tier: kind.tier,
      weight,
      direction: kind.direction,
    }
    lastEvent.value = event

    // Два механизма, разделённые по времени: цель уезжает надолго,
    // импульс бьёт сразу и гаснет за доли секунды.
    const shift: AffectState = {
      valence: target.value.valence + kind.direction.valence * weight * TARGET_SHIFT,
      arousal: target.value.arousal + kind.direction.arousal * weight * TARGET_SHIFT,
    }
    setTarget(shift)
    addImpulse({
      valence: kind.direction.valence * weight * IMPULSE_SCALE,
      arousal: kind.direction.arousal * weight * IMPULSE_SCALE,
    })

    return event
  }

  return { fire, lastEvent, freshness }
}
