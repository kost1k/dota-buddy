import { describe, expect, it } from 'vitest'
import { ESCALATION_TIERS } from '../shared/escalation'
import { EVENT_KINDS, eventSummary, findEventKind } from '../shared/events'

/**
 * Каталог событий и подпись к сработавшему.
 *
 * Подпись собирается из ДВУХ таблиц — каталога и ярусов, — и до сих пор
 * собиралась в разметке пульта, то есть знание об их связи жило на странице.
 */

describe('каталог событий', () => {
  it('идентификаторы уникальны', () => {
    const ids = EVENT_KINDS.map(kind => kind.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('у каждого типа есть подпись и известный ярус', () => {
    for (const kind of EVENT_KINDS) {
      expect(kind.label).toBeTruthy()
      expect(ESCALATION_TIERS[kind.tier]).toBeDefined()
    }
  })

  it('находит по идентификатору и молчит на неизвестном', () => {
    expect(findEventKind('death')?.label).toBe('Смерть')
    expect(findEventKind('нет такого')).toBeUndefined()
  })
})

describe('подпись сработавшего события', () => {
  it('называет тип, ярус и вес', () => {
    const death = findEventKind('death')!

    expect(eventSummary(death, 0.75)).toBe('Смерть → Средний, вес 0.75')
  })

  it('вес округляет до двух знаков: на пульте важен порядок, а не точность', () => {
    const kill = findEventKind('kill')!

    expect(eventSummary(kill, 0.123456)).toContain('вес 0.12')
  })

  it('собирается для любого типа каталога', () => {
    for (const kind of EVENT_KINDS)
      expect(eventSummary(kind, kind.amplitude)).toContain(kind.label)
  })
})
