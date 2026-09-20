import { describe, expect, it } from 'vitest'
import { parseOverlayMessage } from '../shared/overlay-message'
import { baselineSnapshot } from '../shared/synthetic'

const snapshot = baselineSnapshot()
const event = {
  id: 7,
  kindId: 'death',
  tier: 'mid',
  weight: 0.6,
  direction: { valence: -0.9, arousal: 0.7 },
}

describe('parseOverlayMessage: принимает валидное', () => {
  it('разбирает состояние', () => {
    const message = parseOverlayMessage(JSON.stringify({ type: 'state', snapshot }))
    expect(message).toEqual({ type: 'state', snapshot })
  })

  it('разбирает событие', () => {
    const message = parseOverlayMessage(JSON.stringify({ type: 'event', event }))
    expect(message).toEqual({ type: 'event', event })
  })

  it('разбирает синхронизацию со снапшотом и без него', () => {
    expect(parseOverlayMessage(JSON.stringify({ type: 'sync', snapshot }))).toEqual({ type: 'sync', snapshot })
    expect(parseOverlayMessage(JSON.stringify({ type: 'sync', snapshot: null }))).toEqual({ type: 'sync', snapshot: null })
  })

  it('разбирает сон', () => {
    expect(parseOverlayMessage(JSON.stringify({ type: 'idle' }))).toEqual({ type: 'idle' })
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

  it('отбраковывает неизвестный тип', () => {
    expect(parseOverlayMessage(JSON.stringify({ type: 'explode' }))).toBeNull()
  })

  it('отбраковывает состояние без снапшота', () => {
    expect(parseOverlayMessage(JSON.stringify({ type: 'state' }))).toBeNull()
    expect(parseOverlayMessage(JSON.stringify({ type: 'state', snapshot: { hero: {} } }))).toBeNull()
  })

  it('отбраковывает событие неверной формы', () => {
    expect(parseOverlayMessage(JSON.stringify({ type: 'event', event: { kindId: 'death' } }))).toBeNull()
  })
})
