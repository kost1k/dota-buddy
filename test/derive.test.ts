import type { MatchSnapshot } from '../shared/snapshot'
import { describe, expect, it } from 'vitest'
import { deriveEvents, isMatchBoundary } from '../shared/derive'
import { baselineSnapshot } from '../shared/synthetic'

type Hero = MatchSnapshot['hero']
type Player = MatchSnapshot['player']
type Map = MatchSnapshot['map']

function snap(hero: Partial<Hero> = {}, player: Partial<Player> = {}, map: Partial<Map> = {}): MatchSnapshot {
  const base = baselineSnapshot()
  return {
    hero: { ...base.hero, ...hero },
    player: { ...base.player, ...player },
    map: { ...base.map, ...map },
  }
}

describe('deriveEvents: первый снапшот', () => {
  // Без этого подключение посреди матча выстрелило бы всем разом: и
  // аганимом, и уровнем, и стриком — как будто всё случилось сейчас.
  it('на первом снапшоте не выводит ничего', () => {
    const rich = snap({ level: 25, aghanimsScepter: true }, { killStreak: 7 })
    expect(deriveEvents(null, rich)).toEqual([])
  })

  it('на одинаковых снапшотах не выводит ничего', () => {
    expect(deriveEvents(snap(), snap())).toEqual([])
  })
})

describe('deriveEvents: жизнь и смерть', () => {
  it('ловит смерть', () => {
    expect(deriveEvents(snap(), snap({ alive: false }))).toContain('death')
  })

  it('ловит респавн', () => {
    expect(deriveEvents(snap({ alive: false }), snap())).toContain('respawn')
  })

  it('не повторяет смерть, пока герой остаётся мёртвым', () => {
    const dead = snap({ alive: false })
    const stillDead = snap({ alive: false, respawnSeconds: 5 })
    expect(deriveEvents(dead, stillDead)).not.toContain('death')
  })
})

describe('deriveEvents: килстрик', () => {
  it('срабатывает с порога и только на росте', () => {
    expect(deriveEvents(snap({}, { killStreak: 2 }), snap({}, { killStreak: 3 }))).toContain('streak')
    expect(deriveEvents(
      snap({}, { killStreak: 3 }),
      snap({ health: 500 }, { killStreak: 3 }),
    )).not.toContain('streak')
  })

  it('не срабатывает ниже порога', () => {
    expect(deriveEvents(snap({}, { killStreak: 1 }), snap({}, { killStreak: 2 }))).not.toContain('streak')
  })
})

describe('deriveEvents: уровень и вехи', () => {
  it('различает обычный уровень и круглый рубеж', () => {
    expect(deriveEvents(snap({ level: 9 }), snap({ level: 10 }))).toContain('levelLandmark')
    expect(deriveEvents(snap({ level: 10 }), snap({ level: 11 }))).toContain('levelUp')
    expect(deriveEvents(snap({ level: 10 }), snap({ level: 11 }))).not.toContain('levelLandmark')
  })

  it('ловит аганим и шард по одному разу', () => {
    expect(deriveEvents(snap(), snap({ aghanimsScepter: true }))).toContain('aghanims')
    expect(deriveEvents(
      snap({ aghanimsScepter: true }),
      snap({ aghanimsScepter: true, health: 100 }),
    )).not.toContain('aghanims')
    expect(deriveEvents(snap(), snap({ aghanimsShard: true }))).toContain('shard')
  })

  it('ловит байбек по росту кулдауна с нуля', () => {
    // Сам факт покупки GSI не отдаёт — видно только по кулдауну.
    expect(deriveEvents(snap(), snap({ buybackCooldown: 480 }))).toContain('buyback')
  })
})

describe('deriveEvents: несколько событий разом', () => {
  it('выводит все сработавшие, не только первое', () => {
    const events = deriveEvents(
      snap({ level: 9 }),
      snap({ level: 10, aghanimsScepter: true }, { kills: 1 }),
    )

    expect(events).toContain('kill')
    expect(events).toContain('levelLandmark')
    expect(events).toContain('aghanims')
  })
})

describe('граница матча', () => {
  it('смена идентификатора — граница', () => {
    expect(isMatchBoundary(snap(), snap({}, {}, { matchId: 'other' }))).toBe(true)
  })

  it('откат монотонных счётчиков — тоже граница', () => {
    // Идентификатор может прийти тем же после перезапуска, а состояние уже
    // другое. Счётчики матча монотонны, их откат выдаёт новый матч.
    const before = snap({ level: 18 }, { kills: 7 })
    expect(isMatchBoundary(before, snap({ level: 18 }, { kills: 0 }))).toBe(true)
    expect(isMatchBoundary(before, snap({ level: 1 }, { kills: 7 }))).toBe(true)
  })

  it('обычное продолжение матча границей не считается', () => {
    expect(isMatchBoundary(
      snap({}, { kills: 3 }),
      snap({ health: 200 }, { kills: 4 }),
    )).toBe(false)
  })

  it('первый снапшот границей не считается', () => {
    expect(isMatchBoundary(null, snap())).toBe(false)
  })
})
