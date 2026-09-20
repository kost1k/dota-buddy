import { describe, expect, it } from 'vitest'
import {
  eventWeight,
  FRESHNESS_COST,
  recoverFreshness,
  spendFreshness,
  stepImpulse,
} from '../shared/reaction'

describe('свежесть события', () => {
  it('полная свежесть не растёт дальше единицы', () => {
    expect(recoverFreshness(1, 600)).toBeCloseTo(1, 9)
  })

  it('восстанавливается монотонно и асимптотически', () => {
    let previous = 0
    for (const t of [1, 5, 20, 60, 200, 600]) {
      const value = recoverFreshness(0, t)
      expect(value).toBeGreaterThan(previous)
      expect(value).toBeLessThan(1)
      previous = value
    }
  })

  it('восстановление не зависит от того, как часто его вызывали', () => {
    // Тот же инвариант, что у интегратора аффекта, и по той же причине:
    // иначе величина поедет от частоты кадров.
    const oneStep = recoverFreshness(0, 40)
    let many = 0
    for (let i = 0; i < 40; i++)
      many = recoverFreshness(many, 1)

    expect(many).toBeCloseTo(oneStep, 9)
  })

  it.each([0, -3, Number.NaN])('не меняется при неположительном времени: %p', (t) => {
    expect(recoverFreshness(0.4, t)).toBeCloseTo(0.4, 9)
  })

  it('трата уменьшает запас и не уводит его ниже нуля', () => {
    expect(spendFreshness(1)).toBeCloseTo(1 - FRESHNESS_COST, 9)
    expect(spendFreshness(0.1)).toBe(0)
  })
})

describe('вес события', () => {
  it('выдохшееся событие слабее свежего, но не исчезает', () => {
    const fresh = eventWeight(1, 1)
    const spent = eventWeight(1, 0)

    expect(spent).toBeLessThan(fresh)
    expect(spent).toBeGreaterThan(0.2)
  })

  it('монотонен по амплитуде и по свежести', () => {
    expect(eventWeight(0.5, 1)).toBeGreaterThan(eventWeight(0.3, 1))
    expect(eventWeight(1, 1)).toBeGreaterThan(eventWeight(1, 0.5))
  })

  it('три срабатывания подряд заметно глушат событие', () => {
    let freshness = 1
    const weights: number[] = []
    for (let i = 0; i < 3; i++) {
      weights.push(eventWeight(1, freshness))
      freshness = spendFreshness(freshness)
    }

    expect(weights[2]!).toBeLessThan(weights[0]! * 0.65)
  })

  it('после затишья событие снова бьёт почти в полную силу', () => {
    // Главное, ради чего выбран расходуемый запас: счётчик за матч глушил бы
    // десятую смерть даже через двадцать минут после девятой.
    const afterBurst = spendFreshness(spendFreshness(1))
    const afterLull = recoverFreshness(afterBurst, 300)

    expect(eventWeight(1, afterLull)).toBeGreaterThan(eventWeight(1, 1) * 0.95)
  })
})

describe('импульс', () => {
  it('затухает к нулю', () => {
    let impulse = { valence: -0.8, arousal: 0.9 }
    for (let i = 0; i < 200; i++)
      impulse = stepImpulse(impulse, 1 / 60)

    expect(impulse.valence).toBe(0)
    expect(impulse.arousal).toBe(0)
  })

  it('затухает много быстрее медленной оси аффекта', () => {
    // Смысл отдельного импульса в том, что рывок укладывается в доли
    // секунды, тогда как валентность идёт секундами. Если это перестанет
    // быть верным, два механизма сольются в один и рывок пропадёт.
    let impulse = { valence: 1, arousal: 1 }
    for (let i = 0; i < 60; i++)
      impulse = stepImpulse(impulse, 1 / 60)

    expect(Math.abs(impulse.valence)).toBeLessThan(0.1)
  })

  it('не зависит от частоты кадров', () => {
    const from = { valence: 1, arousal: -0.5 }
    const big = stepImpulse(from, 0.2)

    let small = from
    for (let i = 0; i < 12; i++)
      small = stepImpulse(small, 0.2 / 12)

    expect(small.valence).toBeCloseTo(big.valence, 6)
    expect(small.arousal).toBeCloseTo(big.arousal, 6)
  })

  it.each([0, -1, Number.NaN])('не меняется при некорректном delta: %p', (delta) => {
    const from = { valence: 0.3, arousal: 0.4 }
    expect(stepImpulse(from, delta)).toEqual(from)
  })

  it('сохраняет знак: событие толкает в свою сторону, а не колеблет', () => {
    let impulse = { valence: -0.7, arousal: 0.7 }
    for (let i = 0; i < 20; i++) {
      impulse = stepImpulse(impulse, 1 / 60)
      expect(impulse.valence).toBeLessThanOrEqual(0)
      expect(impulse.arousal).toBeGreaterThanOrEqual(0)
    }
  })
})
