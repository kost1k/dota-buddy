import { describe, expect, it } from 'vitest'
import {
  AFFECT_RANGE,
  clampAffect,
  DEFAULT_AFFECT_TUNING,
  MAX_STEP_SECONDS,
  NEUTRAL_AFFECT,
  stepAffect,
} from '../shared/affect'

// Тесты фиксируют ИНВАРИАНТЫ интегратора, а не константы инерции.
// Константы калибруются на пульте и будут меняться; инварианты — нет.

describe('stepAffect: приближение к цели', () => {
  it('двигает обе оси в сторону цели', () => {
    const from = { valence: 0, arousal: 0 }
    const next = stepAffect(from, { valence: 1, arousal: 1 }, 0.1)

    expect(next.valence).toBeGreaterThan(from.valence)
    expect(next.arousal).toBeGreaterThan(from.arousal)
  })

  it('не перелетает через цель даже при большом шаге', () => {
    const next = stepAffect(
      { valence: -1, arousal: 0 },
      { valence: 1, arousal: 1 },
      MAX_STEP_SECONDS,
    )

    expect(next.valence).toBeLessThanOrEqual(1)
    expect(next.arousal).toBeLessThanOrEqual(1)
  })

  it('монотонно сходится к цели за много шагов', () => {
    let state = NEUTRAL_AFFECT
    const target = { valence: 0.8, arousal: 0.6 }
    let previousGap = Number.POSITIVE_INFINITY

    // Длительность выражена через постоянную времени, а не числом кадров:
    // иначе тест сломается при первой же калибровке инерции.
    const steps = Math.ceil(DEFAULT_AFFECT_TUNING.valenceTau * 10 * 60)

    for (let i = 0; i < steps; i++) {
      state = stepAffect(state, target, 1 / 60)
      const gap = Math.abs(target.valence - state.valence)
      expect(gap).toBeLessThanOrEqual(previousGap)
      previousGap = gap
    }

    expect(state.valence).toBeCloseTo(target.valence, 3)
    expect(state.arousal).toBeCloseTo(target.arousal, 3)
  })

  it('стоит на месте, когда уже в цели', () => {
    const target = { valence: 0.3, arousal: 0.7 }
    const next = stepAffect(target, target, 1 / 60)

    expect(next.valence).toBeCloseTo(target.valence, 12)
    expect(next.arousal).toBeCloseTo(target.arousal, 12)
  })
})

describe('stepAffect: возбуждение быстрее валентности (ADR-0001)', () => {
  it('за один и тот же шаг покрывает большую долю разрыва', () => {
    const next = stepAffect({ valence: 0, arousal: 0 }, { valence: 1, arousal: 1 }, 0.1)

    expect(next.arousal).toBeGreaterThan(next.valence)
  })

  it('постоянная времени возбуждения меньше, чем у валентности', () => {
    expect(DEFAULT_AFFECT_TUNING.arousalTau).toBeLessThan(DEFAULT_AFFECT_TUNING.valenceTau)
  })
})

describe('stepAffect: независимость от частоты кадров', () => {
  // Самый важный тест файла. Наивное сглаживание вида
  //   value += (target - value) * 0.1
  // даёт разный результат при 30 и при 120 кадрах — незаметно на машине
  // разработки и заметно в эфире, где такт задаёт OBS.
  it.each([2, 4, 8, 60])('%i мелких шагов эквивалентны одному крупному', (parts) => {
    const from = { valence: -0.5, arousal: 0.2 }
    const target = { valence: 0.9, arousal: 0.8 }
    const total = 0.2

    const oneBigStep = stepAffect(from, target, total)

    let manySmallSteps = from
    for (let i = 0; i < parts; i++)
      manySmallSteps = stepAffect(manySmallSteps, target, total / parts)

    expect(manySmallSteps.valence).toBeCloseTo(oneBigStep.valence, 9)
    expect(manySmallSteps.arousal).toBeCloseTo(oneBigStep.arousal, 9)
  })
})

describe('stepAffect: защита от плохого delta', () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('не меняет состояние при delta=%p', (delta) => {
    const from = { valence: 0.1, arousal: 0.2 }
    expect(stepAffect(from, { valence: 1, arousal: 1 }, delta)).toEqual(from)
  })

  it('ограничивает огромный delta, чтобы не было скачка после паузы вкладки', () => {
    const from = NEUTRAL_AFFECT
    const target = { valence: 1, arousal: 1 }

    const afterStall = stepAffect(from, target, 30)
    const afterCap = stepAffect(from, target, MAX_STEP_SECONDS)

    expect(afterStall.valence).toBeCloseTo(afterCap.valence, 12)
    expect(afterStall.arousal).toBeCloseTo(afterCap.arousal, 12)
  })
})

describe('stepAffect: диапазоны из CONTEXT.md', () => {
  it('держит валентность в −1..1, а возбуждение в 0..1', () => {
    expect(AFFECT_RANGE.valence).toEqual([-1, 1])
    expect(AFFECT_RANGE.arousal).toEqual([0, 1])
  })

  it('не выпускает состояние за диапазон, даже если цель вне его', () => {
    let state = NEUTRAL_AFFECT
    for (let i = 0; i < 200; i++)
      state = stepAffect(state, { valence: 99, arousal: 99 }, 1 / 60)

    expect(state.valence).toBeLessThanOrEqual(1)
    expect(state.arousal).toBeLessThanOrEqual(1)

    for (let i = 0; i < 400; i++)
      state = stepAffect(state, { valence: -99, arousal: -99 }, 1 / 60)

    expect(state.valence).toBeGreaterThanOrEqual(-1)
    expect(state.arousal).toBeGreaterThanOrEqual(0)
  })
})

describe('clampAffect', () => {
  // Нужен там, где состояние складывается с импульсом: замер дал
  // валентность −1.19 после трёх смертей подряд.
  it('зажимает обе оси в допустимые диапазоны', () => {
    expect(clampAffect({ valence: -1.19, arousal: 1.6 })).toEqual({ valence: -1, arousal: 1 })
    expect(clampAffect({ valence: 2, arousal: -0.4 })).toEqual({ valence: 1, arousal: 0 })
  })

  it('не трогает точку внутри диапазонов', () => {
    const inside = { valence: -0.3, arousal: 0.7 }
    expect(clampAffect(inside)).toEqual(inside)
  })
})
