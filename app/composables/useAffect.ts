import type { AffectState } from '#shared/affect'
import { NEUTRAL_AFFECT, stepAffect } from '#shared/affect'

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

  function tick(deltaSeconds: number) {
    state.value = stepAffect(state.value, target.value, deltaSeconds)
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

  return { state, target, tick, setTarget, setState }
}
