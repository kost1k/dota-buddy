import { describe, expect, it } from 'vitest'
import { isAwake } from '../shared/liveness'

// Время инжектируется, таймеров нет — поэтому тест не зависит от реального
// хода часов и не мигает.

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
