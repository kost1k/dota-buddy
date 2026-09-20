import type { AffectState } from '#shared/affect'
import { clampAffect, NEUTRAL_AFFECT, stepAffect } from '#shared/affect'
import { stepImpulse } from '#shared/reaction'

/**
 * Реактивная оболочка над чистым интегратором аффекта.
 *
 * Цель складывается из ДВУХ слагаемых, и это не украшательство.
 *
 * `base` — объективное положение дел, выведенное из снапшота: счёт команд,
 * урон, дебаффы. Оно меняется само и никуда не «возвращается».
 *
 * `offset` — эмоциональный след от событий, затухающий за десятки секунд.
 * Без него событие не имело бы последствия; но и писать его прямо в цель
 * нельзя — следующий снапшот тут же затёр бы. А главное, смерть считалась
 * бы дважды: она и сама роняет счёт команд, то есть уже отражена в `base`.
 *
 * Поверх обоих живёт `impulse` — рывок на доли секунды. Три слоя, а не
 * один, потому что у них несоизмеримые времена: снапшот идёт секундами,
 * след десятками секунд, рывок — долями.
 */

/** Постоянная времени затухания следа от событий. */
const OFFSET_TAU = 25

export function useAffect() {
  const state = useState<AffectState>('affect:state', () => ({ ...NEUTRAL_AFFECT }))
  const base = useState<AffectState>('affect:base', () => ({ ...NEUTRAL_AFFECT }))
  const offset = useState<AffectState>('affect:offset', () => ({ ...NEUTRAL_AFFECT }))
  const impulse = useState<AffectState>('affect:impulse', () => ({ ...NEUTRAL_AFFECT }))

  const target = computed(() => clampAffect({
    valence: base.value.valence + offset.value.valence,
    arousal: base.value.arousal + offset.value.arousal,
  }))

  function tick(deltaSeconds: number) {
    state.value = stepAffect(state.value, target.value, deltaSeconds)

    // След и рывок затухают по одному закону, но с разными постоянными:
    // разница между ними на два порядка, и в этом весь смысл разделения.
    const decayedOffset = stepImpulse(offset.value, deltaSeconds, OFFSET_TAU)
    if (decayedOffset !== offset.value)
      offset.value = decayedOffset

    const decayedImpulse = stepImpulse(impulse.value, deltaSeconds)
    if (decayedImpulse !== impulse.value)
      impulse.value = decayedImpulse
  }

  /** Объективная основа из снапшота. Зовётся связью на каждое обновление. */
  function setBase(next: Partial<AffectState>) {
    base.value = { ...base.value, ...next }
  }

  /** След от события: добавляется к уже идущему, а не заменяет его. */
  function addOffset(next: AffectState) {
    offset.value = {
      valence: offset.value.valence + next.valence,
      arousal: offset.value.arousal + next.arousal,
    }
  }

  /** Толчок поверх состояния. Складывается с уже идущим. */
  function addImpulse(next: AffectState) {
    impulse.value = {
      valence: impulse.value.valence + next.valence,
      arousal: impulse.value.arousal + next.arousal,
    }
  }

  /**
   * Прямая запись состояния, в обход инерции. ТОЛЬКО для пульта: в
   * рантайме состояние обязано меняться лишь через `tick`, иначе теряется
   * плавность, ради которой выбрана непрерывная модель (ADR-0001).
   */
  function setState(next: Partial<AffectState>) {
    state.value = { ...state.value, ...next }
  }

  return { state, base, offset, impulse, target, tick, setBase, addOffset, addImpulse, setState }
}
