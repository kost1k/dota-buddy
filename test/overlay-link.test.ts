import type { BuddyEvent } from '../shared/events'
import type { LinkEffect, LinkState } from '../shared/overlay-link'
import { describe, expect, it } from 'vitest'
import { EMPTY_LINK_STATE, isAwake, reduceOverlayMessage } from '../shared/overlay-link'
import { baselineSnapshot } from '../shared/synthetic'

type Snap = ReturnType<typeof baselineSnapshot>

function snap(hero: Partial<Snap['hero']> = {}, player: Partial<Snap['player']> = {}): Snap {
  const base = baselineSnapshot()
  return {
    hero: { ...base.hero, ...hero },
    player: { ...base.player, ...player },
    map: base.map,
  }
}

function hurt(fraction: number): Snap {
  return snap({ health: 600 * fraction, healthFraction: fraction })
}

const EVENT: BuddyEvent = {
  id: 1,
  kindId: 'levelUp',
  tier: 'micro',
  weight: 0.3,
  direction: { valence: 0.5, arousal: 0.25 },
}

/** Прогоняет цепочку сообщений, возвращая итоговое состояние и все эффекты. */
function run(
  messages: { message: Parameters<typeof reduceOverlayMessage>[1], at: number }[],
  from: LinkState = EMPTY_LINK_STATE,
) {
  let state = from
  const effects: LinkEffect[] = []
  for (const { message, at } of messages) {
    const step = reduceOverlayMessage(state, message, at)
    state = step.state
    effects.push(...step.effects)
  }
  return { state, effects }
}

/** Возбуждение из последнего эффекта основы. */
function arousalOf(effects: LinkEffect[]): number {
  const base = effects.filter(effect => effect.type === 'base').at(-1)
  return base ? base.affect.arousal : Number.NaN
}

describe('связь оверлея', () => {
  it('одно событие даёт ровно один эффект применения', () => {
    const { effects } = run([{ message: { type: 'event', event: EVENT }, at: 1000 }])

    expect(effects).toEqual([{ type: 'react', event: EVENT }])
  })

  it('состояние будит, синхронизация — нет', () => {
    const synced = run([{ message: { type: 'sync', snapshot: snap() }, at: 1000 }])
    expect(synced.state.lastMessageAt).toBeNull()

    const updated = run([{ message: { type: 'state', snapshot: snap() }, at: 2000 }])
    expect(updated.state.lastMessageAt).toBe(2000)

    const reacted = run([{ message: { type: 'event', event: EVENT }, at: 3000 }])
    expect(reacted.state.lastMessageAt).toBe(3000)
  })

  it('копит урон между снапшотами', () => {
    const { state } = run([
      { message: { type: 'state', snapshot: snap() }, at: 1000 },
      { message: { type: 'state', snapshot: hurt(0.7) }, at: 2000 },
      { message: { type: 'state', snapshot: hurt(0.5) }, at: 3000 },
    ])

    // 0.3 потеряно, затухло за секунду, плюс ещё 0.2 — заведомо больше
    // каждого шага по отдельности и меньше их суммы.
    expect(state.accumulatedDamage).toBeGreaterThan(0.3)
    expect(state.accumulatedDamage).toBeLessThan(0.5)
  })

  it('тот же снапшот после урона тревожнее принятого как первый', () => {
    const damaged = run([
      { message: { type: 'state', snapshot: snap() }, at: 1000 },
      { message: { type: 'state', snapshot: hurt(0.2) }, at: 2000 },
    ])
    const asFirst = run([{ message: { type: 'sync', snapshot: hurt(0.2) }, at: 2000 }])

    expect(arousalOf(damaged.effects)).toBeGreaterThan(arousalOf(asFirst.effects))
  })

  it('синхронизация принимает снапшот как первый', () => {
    // Разрыв посреди боя: до паузы было полное здоровье, после — пятая
    // часть. Без обнуления накопителя это выглядело бы как свежий урон.
    const before = run([
      { message: { type: 'state', snapshot: snap() }, at: 1000 },
    ]).state

    const { state } = run(
      [{ message: { type: 'sync', snapshot: hurt(0.2) }, at: 60_000 }],
      before,
    )

    expect(state.accumulatedDamage).toBe(0)
    expect(state.previousSnapshot).toEqual(hurt(0.2))
    expect(state.previousAt).toBe(60_000)
  })

  it('синхронизация без снапшота не трогает оси', () => {
    const { state, effects } = run([{ message: { type: 'sync', snapshot: null }, at: 1000 }])

    expect(effects).toEqual([])
    expect(state.snapshot).toBeNull()
  })

  it('тишина сбрасывает всё и возвращает оси в нейтраль', () => {
    const before = run([
      { message: { type: 'state', snapshot: snap() }, at: 1000 },
      { message: { type: 'state', snapshot: hurt(0.4) }, at: 2000 },
    ]).state
    expect(before.accumulatedDamage).toBeGreaterThan(0)

    const { state, effects } = run([{ message: { type: 'idle' }, at: 3000 }], before)

    expect(state).toEqual(EMPTY_LINK_STATE)
    expect(effects).toEqual([{ type: 'base', affect: { valence: 0, arousal: 0 } }])
  })

  it('не мутирует переданное состояние', () => {
    const before = { ...EMPTY_LINK_STATE }
    reduceOverlayMessage(before, { type: 'state', snapshot: hurt(0.5) }, 1000)

    expect(before).toEqual(EMPTY_LINK_STATE)
  })
})

/**
 * Вторая половина правила живости: сколько тишины считается концом матча.
 * Первую — какие сообщения будят — держит редьюсер выше.
 *
 * Время инжектируется, таймеров нет, поэтому тест не зависит от хода часов.
 */
const TIMEOUT = 15_000

describe('isAwake', () => {
  it('спит, пока не пришло ни одного сообщения', () => {
    expect(isAwake(null, 1_000, TIMEOUT)).toBe(false)
  })

  it('бодрствует сразу после сообщения', () => {
    expect(isAwake(1_000, 1_000, TIMEOUT)).toBe(true)
  })

  it('бодрствует, пока не истёк таймаут', () => {
    expect(isAwake(1_000, 1_000 + TIMEOUT - 1, TIMEOUT)).toBe(true)
  })

  it('засыпает ровно на границе таймаута', () => {
    expect(isAwake(1_000, 1_000 + TIMEOUT, TIMEOUT)).toBe(false)
  })

  it('спит, когда таймаут давно позади', () => {
    expect(isAwake(1_000, 500_000, TIMEOUT)).toBe(false)
  })

  it('не засыпает, если часы качнулись назад', () => {
    expect(isAwake(5_000, 4_000, TIMEOUT)).toBe(true)
  })
})
