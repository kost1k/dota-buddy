import type { Peer } from 'crossws'
import { beforeEach, describe, expect, it } from 'vitest'
import { ingestRawBody } from '../server/utils/ingest'
import { matchState } from '../server/utils/match-state'
import { wsService } from '../server/utils/ws'
import { baselineSnapshot, buildRawSnapshot } from '../shared/synthetic'

/**
 * Приём сырого тела: одна дверь для всех источников пакетов.
 *
 * Живая Dota, пульт и воспроизведение записи входят сюда одинаково. Если бы
 * у каждого была своя дорога, воспроизведение проверяло бы себя, а не
 * пайплайн, — а это единственное, ради чего оно делается.
 */

/** Собирает то, что ушло бы в оверлей. Настоящий сокет тут не нужен. */
function collectBroadcasts() {
  const messages: any[] = []
  const peer = {
    id: 'test',
    send: (data: string) => { messages.push(JSON.parse(data)) },
  } as unknown as Peer

  wsService.add(peer)
  return { messages, done: () => wsService.remove(peer) }
}

describe('приём сырого тела', () => {
  beforeEach(() => {
    matchState.reset()
  })

  it('пустое тело — это сон, а не ошибка', () => {
    // Dota шлёт пустой объект при окончании матча или сессии.
    expect(ingestRawBody({}).mode).toBe('idle')
  })

  it('снапшот доезжает событиями', () => {
    const base = baselineSnapshot()
    ingestRawBody(buildRawSnapshot(base))

    const result = ingestRawBody(buildRawSnapshot({
      ...base,
      hero: { ...base.hero, level: base.hero.level + 1 },
    }))

    expect(result.mode).toBe('state')
    expect(result.mode === 'state' && result.events.map(e => e.kindId)).toContain('levelUp')
  })

  it('состояние уходит в оверлей раньше события', () => {
    // Событие описывает ИЗМЕНЕНИЕ, и клиент должен увидеть новое положение
    // прежде, чем ему скажут, что произошло.
    const base = baselineSnapshot()
    ingestRawBody(buildRawSnapshot(base))

    const { messages, done } = collectBroadcasts()
    ingestRawBody(buildRawSnapshot({
      ...base,
      hero: { ...base.hero, level: base.hero.level + 1 },
    }))
    done()

    expect(messages.map(m => m.type)).toEqual(['state', 'event'])
  })

  it('пустое тело оповещает оверлеи, а не только чистит память', () => {
    const base = baselineSnapshot()
    ingestRawBody(buildRawSnapshot(base))

    const { messages, done } = collectBroadcasts()
    ingestRawBody({})
    done()

    expect(messages.map(m => m.type)).toEqual(['idle'])
    expect(matchState.snapshot()).toBeNull()
  })

  it('граница матча оповещает оверлеи, потом отдаёт новое состояние', () => {
    // Сброс молча оставлял оверлей с накопленным уроном и следом события от
    // прошлого матча: он узнавал о новом матче только по следующему `state`.
    const base = baselineSnapshot()
    ingestRawBody(buildRawSnapshot(base))

    const { messages, done } = collectBroadcasts()
    ingestRawBody(buildRawSnapshot({
      ...base,
      map: { ...base.map, matchId: 'next' },
    }))
    done()

    expect(messages.map(m => m.type)).toEqual(['idle', 'state'])
  })

  it('граница матча возвращает свежесть к начальной', () => {
    const base = baselineSnapshot()
    const at = (patch: Partial<typeof base.hero>, matchId = base.map.matchId) =>
      buildRawSnapshot({ ...base, hero: { ...base.hero, ...patch }, map: { ...base.map, matchId } })

    ingestRawBody(at({}))
    const first = ingestRawBody(at({ alive: false }))
    const fresh = first.mode === 'state' ? first.events[0]!.weight : 0

    // Тот же матч: повтор приглушён.
    ingestRawBody(at({ alive: true }))
    const again = ingestRawBody(at({ alive: false }))
    const damped = again.mode === 'state' ? again.events[0]!.weight : 0
    expect(damped).toBeLessThan(fresh)

    // Новый матч: первый снапшот событий не даёт, свежесть как в начале.
    const boundary = ingestRawBody(at({ alive: true }, 'next'))
    expect(boundary.mode === 'state' && boundary.events).toEqual([])

    ingestRawBody(at({}, 'next'))
    const after = ingestRawBody(at({ alive: false }, 'next'))
    const afterBoundary = after.mode === 'state' ? after.events[0]!.weight : 0
    expect(afterBoundary).toBeCloseTo(fresh, 9)
  })
})
