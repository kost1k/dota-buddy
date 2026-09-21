import { describe, expect, it } from 'vitest'
import { AFFECT_RANGE, NEUTRAL_AFFECT } from '../shared/affect'
import { bodyColor, toHex } from '../shared/palette'
import { isVisualId, renderAffect, VISUALS } from '../shared/visual'

/**
 * Ядро контракта визуала.
 *
 * Эти три правила жили копиями в пяти визуалах и не были покрыты ничем.
 * Теперь они в одном месте, и проверяются здесь — в node, без монтирования
 * компонентов.
 */

const CALM = { state: NEUTRAL_AFFECT, impulse: NEUTRAL_AFFECT, asleep: false }

describe('отображаемый аффект', () => {
  it('складывает состояние с импульсом', () => {
    const { affect } = renderAffect({
      state: { valence: 0.2, arousal: 0.3 },
      impulse: { valence: 0.5, arousal: 0.4 },
      asleep: false,
    })

    expect(affect.valence).toBeCloseTo(0.7, 9)
    expect(affect.arousal).toBeCloseTo(0.7, 9)
  })

  it('зажимает сумму в диапазон осей', () => {
    // Сумма выходит за диапазон по построению: состояние уже может стоять
    // на краю, а импульс кладётся поверх.
    const high = renderAffect({
      state: { valence: 0.9, arousal: 0.9 },
      impulse: { valence: 0.9, arousal: 0.9 },
      asleep: false,
    })
    const low = renderAffect({
      state: { valence: -0.9, arousal: 0 },
      impulse: { valence: -0.9, arousal: -0.9 },
      asleep: false,
    })

    expect(high.affect.valence).toBe(AFFECT_RANGE.valence[1])
    expect(high.affect.arousal).toBe(AFFECT_RANGE.arousal[1])
    expect(low.affect.valence).toBe(AFFECT_RANGE.valence[0])
    expect(low.affect.arousal).toBe(AFFECT_RANGE.arousal[0])
  })

  it('во сне приглушает моторику, не трогая аффект', () => {
    const awake = renderAffect(CALM)
    const asleep = renderAffect({ ...CALM, asleep: true })

    expect(awake.sleepy).toBe(1)
    expect(asleep.sleepy).toBe(0.25)
    expect(asleep.affect).toEqual(awake.affect)
    expect(asleep.tint).toBe(awake.tint)
  })

  it('цвет берётся от ОТОБРАЖАЕМОГО аффекта, а не от сырого состояния', () => {
    // Иначе рывок менял бы форму и движение, но не цвет, — а цвет основной
    // носитель валентности, и он бы отставал от всего остального.
    const state = { valence: -0.6, arousal: 0.2 }
    const impulse = { valence: 0.9, arousal: 0.5 }
    const { affect, tint } = renderAffect({ state, impulse, asleep: false })

    expect(tint).toBe(toHex(bodyColor(affect.valence, affect.arousal)))
    expect(tint).not.toBe(toHex(bodyColor(state.valence, state.arousal)))
  })

  it('отдаёт цвет строкой, готовой к материалу', () => {
    expect(renderAffect(CALM).tint).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('реестр визуалов', () => {
  it('идентификатор признаётся только вместе с записью в реестре', () => {
    for (const id of Object.keys(VISUALS))
      expect(isVisualId(id)).toBe(true)

    expect(isVisualId('breath')).toBe(false)
    expect(isVisualId(undefined)).toBe(false)
  })
})
