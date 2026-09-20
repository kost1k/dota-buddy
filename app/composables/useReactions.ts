import type { BuddyEvent } from '#shared/events'
import { findEventKind } from '#shared/events'

/**
 * Применение событий к аффекту.
 *
 * Свежесть, вывод событий и подсчёт веса живут на СЕРВЕРЕ (ADR-0002,
 * тикет 08): это состояние матча, и оно обязано пережить перезагрузку
 * browser source. Здесь остаётся только применение — сдвиг цели и импульс.
 *
 * Выбор профиля движения тут тоже не делается: профили у каждого визуала
 * свои, и знать о них должен только визуал.
 */

/** Насколько вес события оставляет след — медленное последствие. */
const OFFSET_SHIFT = 0.55

/** Насколько вес события даёт мгновенный рывок. Сильнее сдвига намеренно. */
const IMPULSE_SCALE = 0.9

export function useReactions() {
  const { addOffset, addImpulse } = useAffect()
  const lastEvent = useState<BuddyEvent | null>('reactions:last', () => null)
  const localCounter = useState<number>('reactions:localCounter', () => 0)

  /** Применяет событие: медленный сдвиг цели и быстрый импульс поверх. */
  function apply(event: BuddyEvent) {
    lastEvent.value = event

    // Событие пишет СЛЕД, а не цель. Цель складывается из следа и
    // объективной основы из снапшота; писать в неё напрямую значило бы
    // затереться следующим же обновлением, а для смерти ещё и посчитать
    // её дважды — она и сама роняет счёт команд.
    addOffset({
      valence: event.direction.valence * event.weight * OFFSET_SHIFT,
      arousal: event.direction.arousal * event.weight * OFFSET_SHIFT,
    })
    addImpulse({
      valence: event.direction.valence * event.weight * IMPULSE_SCALE,
      arousal: event.direction.arousal * event.weight * IMPULSE_SCALE,
    })
  }

  /**
   * Срабатывание в обход сервера. ТОЛЬКО для пульта.
   *
   * Вес берётся полной амплитудой: свежести здесь нет и быть не может —
   * она на сервере. Значит кнопка пульта бьёт сильнее, чем то же событие в
   * настоящем матче после нескольких повторов, и это нормально: её задача
   * — быстро посмотреть реакцию, а не воспроизвести матч. Для
   * воспроизведения есть сценарии, которые идут через сервер.
   */
  function fire(kindId: string): BuddyEvent | null {
    const kind = findEventKind(kindId)
    if (!kind)
      return null

    // Отрицательные идентификаторы отличают локальные срабатывания от
    // серверных: иначе они столкнулись бы номерами, и визуал счёл бы новое
    // событие уже виденным.
    localCounter.value += 1
    const event: BuddyEvent = {
      id: -localCounter.value,
      kindId: kind.id,
      tier: kind.tier,
      weight: kind.amplitude,
      direction: kind.direction,
    }
    apply(event)
    return event
  }

  return { apply, fire, lastEvent }
}
