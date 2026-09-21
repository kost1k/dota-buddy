import { describe, expect, it } from 'vitest'
import { BREATH_HZ, breathAmplitude, breathHz, MAX_OSCILLATION_HZ } from '../shared/motion'

describe('breathHz', () => {
  it('идёт от покоя к ажитации в физиологических границах', () => {
    expect(breathHz(0)).toBeCloseTo(BREATH_HZ.calm, 6)
    expect(breathHz(1)).toBeCloseTo(BREATH_HZ.agitated, 6)
  })

  it('монотонно растёт', () => {
    let previous = -1
    for (const a of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const value = breathHz(a)
      expect(value).toBeGreaterThan(previous)
      previous = value
    }
  })

  it('никогда не превышает потолок, выше которого движение читается электронным', () => {
    for (const a of [0, 0.5, 1, 2, -1])
      expect(breathHz(a)).toBeLessThan(MAX_OSCILLATION_HZ)
  })
})

describe('breathAmplitude', () => {
  // Амплитуда обязана падать до нуля в покое, а не стоять на постоянном
  // полу: у движущихся стимулов есть цена — раздражение и перехват
  // внимания. В покое платить за это нечем.
  it('ровно ноль при нулевом возбуждении', () => {
    expect(breathAmplitude(0, 135)).toBe(0)
  })

  it('монотонно растёт с возбуждением', () => {
    let previous = -1
    for (const a of [0, 0.25, 0.5, 0.75, 1]) {
      const value = breathAmplitude(a, 135)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })

  it('на максимуме укладывается в 3–12% тела', () => {
    const body = 135
    const peak = breathAmplitude(1, body)
    expect(peak / body).toBeGreaterThanOrEqual(0.03)
    expect(peak / body).toBeLessThanOrEqual(0.12)
  })

  it('масштабируется вместе с телом', () => {
    expect(breathAmplitude(1, 270)).toBeCloseTo(breathAmplitude(1, 135) * 2, 6)
  })
})
