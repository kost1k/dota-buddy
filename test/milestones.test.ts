import { describe, expect, it } from 'vitest'
import { EVENT_KINDS } from '../shared/events'
import { applyMilestone, MAX_TALENTS, milestoneProgress, NO_MILESTONES } from '../shared/milestones'

describe('вехи', () => {
  it('таланты копятся до потолка и дальше не растут', () => {
    let m = NO_MILESTONES
    for (let i = 0; i < MAX_TALENTS + 3; i++)
      m = applyMilestone(m, 'talent')

    expect(m.talents).toBe(MAX_TALENTS)
  })

  it('повторное применение единичной вехи безвредно', () => {
    const once = applyMilestone(NO_MILESTONES, 'aghanim')
    expect(applyMilestone(once, 'aghanim')).toEqual(once)
  })

  it('не мутирует входной объект', () => {
    const before = { ...NO_MILESTONES }
    applyMilestone(before, 'shard')
    expect(before).toEqual(NO_MILESTONES)
  })

  it('достроенность идёт от нуля к единице', () => {
    expect(milestoneProgress(NO_MILESTONES)).toBe(0)
    expect(milestoneProgress({ talents: MAX_TALENTS, aghanim: true, shard: true })).toBeCloseTo(1, 9)
  })

  it('достроенность монотонна', () => {
    let m = NO_MILESTONES
    let previous = -1
    for (const kind of ['talent', 'talent', 'aghanim', 'talent', 'shard', 'talent'] as const) {
      m = applyMilestone(m, kind)
      const value = milestoneProgress(m)
      expect(value).toBeGreaterThan(previous)
      previous = value
    }
  })
})

describe('каталог событий', () => {
  // Инвариант, который легко нарушить при добавлении события: веха без
  // флага oneShot тратила бы свежесть, и однократное событие приглушалось
  // бы неизвестно от чего.
  it('каждое событие с вехой помечено как однократное', () => {
    for (const kind of EVENT_KINDS) {
      if (kind.milestone)
        expect(kind.oneShot, `${kind.id}: веха без oneShot`).toBe(true)
    }
  })

  it('идентификаторы уникальны', () => {
    const ids = EVENT_KINDS.map(k => k.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('амплитуда и направление в допустимых пределах', () => {
    for (const kind of EVENT_KINDS) {
      expect(kind.amplitude, kind.id).toBeGreaterThan(0)
      expect(kind.amplitude, kind.id).toBeLessThanOrEqual(1)
      expect(Math.abs(kind.direction.valence), kind.id).toBeLessThanOrEqual(1)
      expect(Math.abs(kind.direction.arousal), kind.id).toBeLessThanOrEqual(1)
    }
  })
})
