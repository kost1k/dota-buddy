import type { MatchSnapshot } from '../shared/snapshot'
import { describe, expect, it } from 'vitest'
import { baseArousal, baseValence } from '../shared/affect-signals'
import { baselineSnapshot } from '../shared/synthetic'

function snap(hero: Partial<MatchSnapshot['hero']> = {}, player: Partial<MatchSnapshot['player']> = {}, map: Partial<MatchSnapshot['map']> = {}): MatchSnapshot {
  const base = baselineSnapshot()
  return {
    hero: { ...base.hero, ...hero },
    player: { ...base.player, ...player },
    map: { ...base.map, ...map },
  }
}

describe('валентность: преимущество в счёте', () => {
  it('ноль при равном счёте', () => {
    expect(baseValence(snap())).toBeCloseTo(0, 9)
  })

  it('монотонна по преимуществу', () => {
    let previous = Number.NEGATIVE_INFINITY
    for (const lead of [-30, -10, -3, 0, 3, 10, 30]) {
      const value = baseValence(snap({}, {}, { radiantScore: Math.max(lead, 0), direScore: Math.max(-lead, 0) }))
      expect(value).toBeGreaterThan(previous)
      previous = value
    }
  })

  it('насыщается, а не растёт без предела', () => {
    // Разрыв в тридцать килов не втрое сильнее разрыва в десять: к этому
    // моменту всё уже ясно.
    const ten = baseValence(snap({}, {}, { radiantScore: 10, direScore: 0 }))
    const thirty = baseValence(snap({}, {}, { radiantScore: 30, direScore: 0 }))

    expect(thirty).toBeGreaterThan(ten)
    expect(thirty).toBeLessThan(ten * 1.6)
  })

  it('оставляет запас шкалы под смещение от событий', () => {
    const huge = baseValence(snap({}, {}, { radiantScore: 60, direScore: 0 }))
    expect(Math.abs(huge)).toBeLessThan(0.8)
  })

  it('знак зависит от своей стороны', () => {
    const map = { radiantScore: 12, direScore: 4 }
    expect(baseValence(snap({}, { team: 'radiant' }, map))).toBeGreaterThan(0)
    expect(baseValence(snap({}, { team: 'dire' }, map))).toBeLessThan(0)
  })
})

describe('возбуждение: скорость урона', () => {
  it('ноль в покое: полное здоровье, без дебаффов', () => {
    expect(baseArousal(snap(), snap(), 1)).toBe(0)
  })

  it('растёт со СКОРОСТЬЮ потери, а не с уровнем здоровья', () => {
    // Главный инвариант. Тревожит не «осталось 40%», а «сняли 40% за две
    // секунды»; стабильные 40% в лесу тревожить не должны.
    const from = snap({ health: 1000, maxHealth: 1000, healthFraction: 1 })
    const to = snap({ health: 400, maxHealth: 1000, healthFraction: 0.4 })

    const fast = baseArousal(from, to, 0.5)
    const slow = baseArousal(from, to, 20)

    expect(fast).toBeGreaterThan(slow)
    expect(fast).toBeGreaterThan(0.7)
  })

  it('стабильное здоровье не тревожит, каким бы оно ни было', () => {
    const steady = snap({ health: 700, maxHealth: 1000, healthFraction: 0.7 })
    expect(baseArousal(steady, steady, 1)).toBeLessThan(0.1)
  })

  it('восстановление здоровья не считается уроном', () => {
    const hurt = snap({ health: 300, maxHealth: 1000, healthFraction: 0.3 })
    const healed = snap({ health: 900, maxHealth: 1000, healthFraction: 0.9 })
    expect(baseArousal(hurt, healed, 1)).toBeLessThan(0.1)
  })

  it.each([0, -1, Number.NaN])('не ломается на некорректном времени: %p', (dt) => {
    const from = snap({ healthFraction: 1 })
    const to = snap({ healthFraction: 0.2 })
    const value = baseArousal(from, to, dt)
    expect(Number.isFinite(value)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(0)
  })
})

describe('возбуждение: дебаффы и низкое здоровье', () => {
  it('обездвиживание тревожнее прочих дебаффов', () => {
    const stunned = baseArousal(snap(), snap({ stunned: true }), 1)
    const silenced = baseArousal(snap(), snap({ silenced: true }), 1)

    expect(stunned).toBeGreaterThan(silenced)
    expect(silenced).toBeGreaterThan(0)
  })

  it('два дебаффа не вдвое тревожнее одного', () => {
    const one = baseArousal(snap(), snap({ stunned: true }), 1)
    const two = baseArousal(snap(), snap({ stunned: true, silenced: true }), 1)
    expect(two).toBeCloseTo(one, 9)
  })

  it('низкое здоровье добавляет поправку', () => {
    // Иначе тихое умирание от яда не дало бы ничего: урон медленный,
    // дебаффа может не быть.
    const low = snap({ health: 80, maxHealth: 1000, healthFraction: 0.08 })
    expect(baseArousal(low, low, 1)).toBeGreaterThan(0.25)
  })

  it('мёртвый герой поправку по здоровью не получает', () => {
    const dead = snap({ alive: false, health: 0, healthFraction: 0 })
    expect(baseArousal(dead, dead, 1)).toBe(0)
  })

  it('никогда не выходит за 0..1', () => {
    const from = snap({ healthFraction: 1 })
    const to = snap({ healthFraction: 0.01, stunned: true, silenced: true, hasDebuff: true })
    const value = baseArousal(from, to, 0.1)
    expect(value).toBeLessThanOrEqual(1)
    expect(value).toBeGreaterThanOrEqual(0)
  })
})
