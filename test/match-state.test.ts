import { describe, expect, it } from 'vitest'
import { matchState } from '../server/utils/match-state'
import { baselineSnapshot } from '../shared/synthetic'

type Snap = ReturnType<typeof baselineSnapshot>

function snap(hero: Partial<Snap['hero']> = {}, player: Partial<Snap['player']> = {}, map: Partial<Snap['map']> = {}): Snap {
  const base = baselineSnapshot()
  return {
    hero: { ...base.hero, ...hero },
    player: { ...base.player, ...player },
    map: { ...base.map, ...map },
  }
}

describe('серверное состояние матча', () => {
  it('первый снапшот не порождает событий', () => {
    matchState.reset()
    expect(matchState.ingest(snap({ level: 20, aghanimsScepter: true }))).toEqual([])
  })

  it('выводит событие и считает вес', () => {
    matchState.reset()
    matchState.ingest(snap())
    const events = matchState.ingest(snap({ alive: false }))

    expect(events).toHaveLength(1)
    expect(events[0]!.kindId).toBe('death')
    expect(events[0]!.weight).toBeGreaterThan(0)
  })

  it('глушит повторы по свежести', () => {
    matchState.reset()
    matchState.ingest(snap())

    const weights: number[] = []
    for (let i = 0; i < 3; i++) {
      weights.push(matchState.ingest(snap({ alive: false }))[0]!.weight)
      matchState.ingest(snap({ alive: true }))
    }

    expect(weights[2]!).toBeLessThan(weights[0]! * 0.7)
  })

  it('однократные события свежестью не глушатся', () => {
    // Аганим за матч один. Приглушать нечего, и если бы он тратил свежесть,
    // приглушение пришло бы неизвестно откуда.
    matchState.reset()
    matchState.ingest(snap())
    const first = matchState.ingest(snap({ aghanimsScepter: true }))[0]!

    matchState.reset()
    matchState.ingest(snap())
    const again = matchState.ingest(snap({ aghanimsScepter: true }))[0]!

    expect(first.weight).toBeCloseTo(again.weight, 9)
  })

  it('идентификаторы событий растут и не повторяются', () => {
    matchState.reset()
    matchState.ingest(snap())
    const ids = [
      matchState.ingest(snap({ alive: false }))[0]!.id,
      matchState.ingest(snap({ alive: true }))[0]!.id,
      matchState.ingest(snap({ alive: false }))[0]!.id,
    ]

    expect(new Set(ids).size).toBe(3)
    expect(ids[2]!).toBeGreaterThan(ids[0]!)
  })

  it('граница матча сбрасывает и память, и свежесть', () => {
    matchState.reset()
    matchState.ingest(snap())
    const fresh = matchState.ingest(snap({ alive: false }))[0]!.weight

    // Тот же матч: повтор приглушён.
    matchState.ingest(snap({ alive: true }))
    const damped = matchState.ingest(snap({ alive: false }))[0]!.weight
    expect(damped).toBeLessThan(fresh)

    // Новый матч: свежесть как в начале, а первый снапшот событий не даёт.
    expect(matchState.ingest(snap({ alive: true }, {}, { matchId: 'next' }))).toEqual([])
    matchState.ingest(snap({}, {}, { matchId: 'next' }))
    const afterBoundary = matchState.ingest(snap({ alive: false }, {}, { matchId: 'next' }))[0]!.weight
    expect(afterBoundary).toBeCloseTo(fresh, 9)
  })

  it('хранит последний снапшот для синхронизации', () => {
    matchState.reset()
    expect(matchState.snapshot()).toBeNull()
    matchState.ingest(snap({ level: 13 }))
    expect(matchState.snapshot()!.hero.level).toBe(13)
  })
})
