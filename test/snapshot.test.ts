import { describe, expect, it } from 'vitest'
import { readSnapshot, scoreLead } from '../shared/snapshot'

function raw(overrides: Record<string, unknown> = {}) {
  return {
    hero: { alive: true, level: 12, health: 900, max_health: 1800, stunned: false },
    player: { team_name: 'radiant', kills: 4, deaths: 2, kill_streak: 1, gpm: 520, xpm: 610 },
    map: { matchid: '777', game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS', radiant_score: 10, dire_score: 6 },
    ...overrides,
  }
}

describe('readSnapshot: терпимость к пропускам', () => {
  // Клиент Dota опускает ключи, для которых у него нет значения, — фикстуры
  // `*_incomplete.json` существуют ровно поэтому. Разбор обязан это
  // переживать, а не требовать полного набора.
  it('разбирает минимальный снапшот', () => {
    const snapshot = readSnapshot({ hero: { alive: true, level: 1 }, player: { kills: 0 } })

    expect(snapshot).not.toBeNull()
    expect(snapshot!.hero.level).toBe(1)
    expect(snapshot!.map.matchId).toBe('')
  })

  it('недостающие числа становятся нулями, а не NaN', () => {
    const snapshot = readSnapshot({ hero: { alive: true, level: 3 }, player: { kills: 1 } })!

    for (const value of [snapshot.hero.health, snapshot.hero.respawnSeconds, snapshot.player.gpm])
      expect(Number.isFinite(value)).toBe(true)
  })

  it('принимает matchid и строкой, и числом', () => {
    expect(readSnapshot(raw({ map: { matchid: '42' } }))!.map.matchId).toBe('42')
    expect(readSnapshot(raw({ map: { matchid: 42 } }))!.map.matchId).toBe('42')
  })
})

describe('readSnapshot: отбраковка', () => {
  it.each([
    ['не объект', 42],
    ['null', null],
    ['массив', []],
    ['пустой объект — так Dota шлёт конец матча', {}],
  ])('возвращает null: %s', (_label, value) => {
    expect(readSnapshot(value)).toBeNull()
  })

  it('отбраковывает снапшот без героя или игрока', () => {
    expect(readSnapshot({ player: { kills: 0 } })).toBeNull()
    expect(readSnapshot({ hero: { alive: true, level: 1 } })).toBeNull()
  })

  it('отбраковывает нелогический alive', () => {
    expect(readSnapshot(raw({ hero: { alive: 'yes', level: 5 } }))).toBeNull()
  })
})

describe('доля здоровья', () => {
  // Считаем сами, а не берём `health_percent`: он приходит не всегда, и
  // расхождение двух источников одной величины ловится потом неделями.
  it('считается из health и max_health', () => {
    expect(readSnapshot(raw())!.hero.healthFraction).toBeCloseTo(0.5, 6)
  })

  it('ноль при нулевом максимуме, а не NaN', () => {
    const snapshot = readSnapshot(raw({ hero: { alive: false, level: 5, health: 0, max_health: 0 } }))!
    expect(snapshot.hero.healthFraction).toBe(0)
  })

  it('зажимается в 0..1 даже при несогласованных числах', () => {
    const over = readSnapshot(raw({ hero: { alive: true, level: 5, health: 3000, max_health: 1000 } }))!
    expect(over.hero.healthFraction).toBe(1)
  })
})

describe('преимущество в счёте', () => {
  it('считается со стороны своей команды', () => {
    expect(scoreLead(readSnapshot(raw())!)).toBe(4)
    expect(scoreLead(readSnapshot(raw({
      player: { team_name: 'dire', kills: 0 },
    }))!)).toBe(-4)
  })

  it('ноль, когда команда неизвестна', () => {
    // Единственный кросс-командный сигнал, который у нас есть; если сторона
    // неизвестна, честнее отдать ноль, чем угадать знак.
    expect(scoreLead(readSnapshot(raw({ player: { kills: 0 } }))!)).toBe(0)
  })
})
