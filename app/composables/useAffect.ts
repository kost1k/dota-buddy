import type { AffectState } from '#shared/affect'
import { NEUTRAL_AFFECT, stepAffect } from '#shared/affect'
import { stepImpulse } from '#shared/reaction'

/**
 * Реактивная оболочка над чистым интегратором аффекта.
 *
 * Оболочка намеренно тонкая: вся арифметика живёт в `#shared/affect`, где её
 * можно тестировать без Vue и без Nuxt. Здесь — только разделяемое состояние
 * и точка входа для такта.
 *
 * Тактом управляет сцена (`onBeforeRender`), а не собственный `rAF`: в
 * browser source такт задаёт OBS, и аффекту незачем считаться, когда ничего
 * не рисуется.
 */
export function useAffect() {
  const state = useState<AffectState>('affect:state', () => ({ ...NEUTRAL_AFFECT }))
  const target = useState<AffectState>('affect:target', () => ({ ...NEUTRAL_AFFECT }))
  /** Быстрый слой поверх состояния; живёт отдельно — см. `#shared/reaction`. */
  const impulse = useState<AffectState>('affect:impulse', () => ({ ...NEUTRAL_AFFECT }))

  function tick(deltaSeconds: number) {
    state.value = stepAffect(state.value, target.value, deltaSeconds)
    const decayed = stepImpulse(impulse.value, deltaSeconds)
    // Присваиваем только при изменении: погасший импульс иначе будил бы
    // реактивность каждый кадр до конца стрима.
    if (decayed !== impulse.value)
      impulse.value = decayed
  }

  /** Толчок поверх состояния. Складывается с уже идущим, а не заменяет его. */
  function addImpulse(next: AffectState) {
    impulse.value = {
      valence: impulse.value.valence + next.valence,
      arousal: impulse.value.arousal + next.arousal,
    }
  }

  function setTarget(next: Partial<AffectState>) {
    target.value = { ...target.value, ...next }
  }

  /**
   * Прямая запись состояния, в обход инерции.
   *
   * Только для пульта. В рантайме оверлея состояние обязано меняться лишь
   * через `tick`, иначе теряется плавность, ради которой выбрана
   * непрерывная модель (ADR-0001).
   */
  function setState(next: Partial<AffectState>) {
    state.value = { ...state.value, ...next }
  }

  return { state, target, impulse, tick, setTarget, setState, addImpulse }
}
