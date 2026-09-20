import { describe, expect, it } from 'vitest'
import { readSnapshot } from '../shared/snapshot'
import { baselineSnapshot, buildRawSnapshot, SCENARIOS } from '../shared/synthetic'

describe('сборка синтетических пакетов', () => {
  // Главный инвариант: сборка и разбор обратны друг другу. Если они
  // разойдутся, пульт будет проверять не то, что приходит из настоящей
  // игры, и вся его польза испарится незаметно.
  it('круговое преобразование не теряет и не искажает данные', () => {
    const before = baselineSnapshot()
    const after = readSnapshot(buildRawSnapshot(before))

    expect(after).toEqual(before)
  })

  it('круговое преобразование выдерживает нетривиальное состояние', () => {
    const before = baselineSnapshot()
    before.hero.health = 437
    before.hero.maxHealth = 1900
    before.hero.healthFraction = 437 / 1900
    before.hero.alive = false
    before.hero.stunned = true
    before.hero.aghanimsScepter = true
    before.player.team = 'dire'
    before.player.killStreak = 5
    before.map.radiantScore = 14
    before.map.direScore = 21

    expect(readSnapshot(buildRawSnapshot(before))).toEqual(before)
  })
})

describe('сценарии', () => {
  it('каждый сценарий проходит целиком и остаётся разбираемым', () => {
    for (const scenario of SCENARIOS) {
      let snapshot = baselineSnapshot()
      for (const step of scenario.steps) {
        snapshot = step.patch(snapshot)
        expect(readSnapshot(buildRawSnapshot(snapshot)), scenario.id).toEqual(snapshot)
      }
    }
  })

  it('доля здоровья пересчитывается при изменении здоровья', () => {
    const damage = SCENARIOS.find(s => s.id === 'damage')!
    let snapshot = baselineSnapshot()
    for (const step of damage.steps)
      snapshot = step.patch(snapshot)

    expect(snapshot.hero.healthFraction).toBeCloseTo(700 / 1800, 6)
  })

  it('смерть доходит до состояния «мёртв» и возвращается живым', () => {
    const death = SCENARIOS.find(s => s.id === 'death')!
    let snapshot = baselineSnapshot()
    const aliveStates: boolean[] = []
    for (const step of death.steps) {
      snapshot = step.patch(snapshot)
      aliveStates.push(snapshot.hero.alive)
    }

    expect(aliveStates).toContain(false)
    expect(aliveStates.at(-1)).toBe(true)
    expect(snapshot.player.deaths).toBe(1)
  })

  it('идентификаторы сценариев уникальны', () => {
    const ids = SCENARIOS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
