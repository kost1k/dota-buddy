import { describe, expect, it } from 'vitest'
import { parseOverlayMessage } from '../shared/gsi-message'

// Протокол, который сервер шлёт СЕЙЧАС. На рубеже 2 он сменится на поток
// выводимых событий (ADR-0002) — тогда эти тесты переписываются вместе с ним.

function validUpdate(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: 'update',
    data: {
      hero: { alive: true, level: 7 },
      player: { gpm: 512, xpm: 640, kills: 3, kill_streak: 2 },
      map: { game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS', clock_time: 900 },
      ...overrides,
    },
  })
}

describe('parseOverlayMessage: принимает валидное', () => {
  it('разбирает update', () => {
    const message = parseOverlayMessage(validUpdate())

    expect(message).not.toBeNull()
    expect(message!.type).toBe('update')
    expect(message!.data!.player.gpm).toBe(512)
    expect(message!.data!.hero.level).toBe(7)
  })

  it('разбирает death', () => {
    const raw = JSON.parse(validUpdate())
    raw.type = 'death'
    raw.data.hero.alive = false

    const message = parseOverlayMessage(JSON.stringify(raw))

    expect(message!.type).toBe('death')
    expect(message!.data!.hero.alive).toBe(false)
  })

  it('разбирает idle с data: null', () => {
    const message = parseOverlayMessage(JSON.stringify({ type: 'idle', data: null }))

    expect(message).toEqual({ type: 'idle', data: null })
  })

  it('разбирает idle без поля data', () => {
    expect(parseOverlayMessage(JSON.stringify({ type: 'idle' }))).toEqual({
      type: 'idle',
      data: null,
    })
  })

  it('не требует полей map — сервер шлёт их опционально', () => {
    const message = parseOverlayMessage(validUpdate({ map: {} }))

    expect(message).not.toBeNull()
    expect(message!.data!.map).toEqual({})
  })
})

describe('parseOverlayMessage: отбраковывает мусор', () => {
  it.each([
    ['битый JSON', '{не json'],
    ['пустая строка', ''],
    ['не объект', '42'],
    ['null', 'null'],
    ['массив', '[]'],
  ])('возвращает null: %s', (_label, raw) => {
    expect(parseOverlayMessage(raw)).toBeNull()
  })

  it('отбраковывает неизвестный type', () => {
    expect(parseOverlayMessage(JSON.stringify({ type: 'explode', data: null }))).toBeNull()
  })

  it('отбраковывает update без data', () => {
    expect(parseOverlayMessage(JSON.stringify({ type: 'update', data: null }))).toBeNull()
  })

  it.each(['hero', 'player'])('отбраковывает update без блока %s', (block) => {
    const raw = JSON.parse(validUpdate())
    delete raw.data[block]

    expect(parseOverlayMessage(JSON.stringify(raw))).toBeNull()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, '512', null])(
    'отбраковывает нечисловой gpm: %p',
    (gpm) => {
      const raw = JSON.parse(validUpdate())
      raw.data.player.gpm = gpm

      expect(parseOverlayMessage(JSON.stringify(raw))).toBeNull()
    },
  )

  it('отбраковывает нелогический hero.alive', () => {
    const raw = JSON.parse(validUpdate())
    raw.data.hero.alive = 'yes'

    expect(parseOverlayMessage(JSON.stringify(raw))).toBeNull()
  })
})
