import { describe, expect, it } from 'vitest'
import { BREATH_HZ, breathAmplitude, breathHz, MAX_OSCILLATION_HZ, minJerk } from '../shared/motion'

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

describe('minJerk', () => {
  // Спокойная база — траектория минимального рывка; ажитация это
  // ОТКЛОНЕНИЕ от неё, а не отдельная анимация.
  it('начинается в нуле и заканчивается в единице', () => {
    expect(minJerk(0)).toBeCloseTo(0, 9)
    expect(minJerk(1)).toBeCloseTo(1, 9)
  })

  it('монотонна и не перелетает', () => {
    let previous = -1
    for (let i = 0; i <= 40; i++) {
      const value = minJerk(i / 40)
      expect(value).toBeGreaterThanOrEqual(previous)
      expect(value).toBeLessThanOrEqual(1)
      previous = value
    }
  })

  it('симметрична относительно середины', () => {
    for (const tau of [0.1, 0.25, 0.4])
      expect(minJerk(tau) + minJerk(1 - tau)).toBeCloseTo(1, 9)
  })

  it('зажимает выход за пределы отрезка', () => {
    expect(minJerk(-5)).toBe(0)
    expect(minJerk(5)).toBe(1)
  })
})
