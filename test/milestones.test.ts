import { describe, expect, it } from 'vitest'
import { EVENT_KINDS } from '../shared/events'
import { applyMilestone, isLevelLandmark, LEVEL_LANDMARKS, MAX_LEVEL, milestoneProgress, NO_MILESTONES } from '../shared/milestones'

describe('вехи', () => {
  it('повторное применение безвредно', () => {
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
    expect(milestoneProgress({ aghanim: true, shard: true })).toBeCloseTo(1, 9)
  })

  it('достроенность монотонна', () => {
    let m = NO_MILESTONES
    let previous = -1
    for (const kind of ['aghanim', 'shard'] as const) {
      m = applyMilestone(m, kind)
      const value = milestoneProgress(m)
      expect(value).toBeGreaterThan(previous)
      previous = value
    }
  })
})

describe('рубежи уровня', () => {
  // Рубежи круглые, а не привязанные к талантам или ультимейту: у части
  // героев талантов больше четырёх, а уровни ультимейта у некоторых свои.
  // Зашитое допущение сломалось бы на конкретном герое молча.
  it('распознаёт заявленные рубежи', () => {
    for (const level of LEVEL_LANDMARKS)
      expect(isLevelLandmark(level)).toBe(true)
  })

  it('не срабатывает на прочих уровнях', () => {
    for (const level of [1, 6, 9, 11, 15, 25, 29])
      expect(isLevelLandmark(level), `уровень ${level}`).toBe(false)
  })

  it('все рубежи лежат в пределах максимального уровня', () => {
    for (const level of LEVEL_LANDMARKS) {
      expect(level).toBeGreaterThan(0)
      expect(level).toBeLessThanOrEqual(MAX_LEVEL)
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
