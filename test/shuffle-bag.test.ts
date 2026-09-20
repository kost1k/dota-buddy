import { describe, expect, it } from 'vitest'
import { createShuffleBag } from '../shared/shuffle-bag'

describe('мешок без возврата', () => {
  it('выдаёт каждый элемент по разу до первого повтора', () => {
    const items = ['a', 'b', 'c', 'd']
    const draw = createShuffleBag(items)
    const first = Array.from({ length: items.length }, draw)

    expect([...first].sort()).toEqual([...items].sort())
  })

  it('не повторяет элемент подряд даже на стыке раздач', () => {
    // Стык — самое коварное место: внутри раздачи повторов нет по
    // построению, а на границе двух раздач они возникают легко.
    const draw = createShuffleBag(['a', 'b', 'c', 'd'])
    let previous = draw()
    for (let i = 0; i < 400; i++) {
      const next = draw()
      expect(next, `повтор подряд на шаге ${i}`).not.toBe(previous)
      previous = next
    }
  })

  it('за много раздач использует все элементы примерно поровну', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const draw = createShuffleBag(items)
    const counts = new Map<string, number>()
    for (let i = 0; i < 500; i++) {
      const value = draw()
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }

    for (const item of items)
      expect(counts.get(item)).toBeGreaterThan(80)
  })

  it('с одним элементом работает, хотя повтор там неизбежен', () => {
    const draw = createShuffleBag(['only'])
    expect([draw(), draw(), draw()]).toEqual(['only', 'only', 'only'])
  })

  it('пустой набор — ошибка, а не тихий undefined', () => {
    expect(() => createShuffleBag([])).toThrow()
  })
})
