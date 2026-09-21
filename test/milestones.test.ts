import { describe, expect, it } from 'vitest'
import { isLevelLandmark, LEVEL_LANDMARKS, MAX_LEVEL } from '../shared/milestones'

describe('рубежи уровня', () => {
  // Рубежи круглые, а не привязанные к талантам или ультимейту: у части
  // героев талантов больше четырёх, а уровни ультимейта у некоторых свои.
  // Зашитое допущение сломалось бы на конкретном герое молча.
  it('распознаёт заявленные рубежи', () => {
    for (const level of LEVEL_LANDMARKS)
      expect(isLevelLandmark(level)).toBe(true)
  })

  it('не срабатывает на прочих уровнях', () => {
    for (const level of [1, 6, 9, 11, 15, 25, 29])
      expect(isLevelLandmark(level), `уровень ${level}`).toBe(false)
  })

  it('все рубежи лежат в пределах максимального уровня', () => {
    for (const level of LEVEL_LANDMARKS) {
      expect(level).toBeGreaterThan(0)
      expect(level).toBeLessThanOrEqual(MAX_LEVEL)
    }
  })
})
