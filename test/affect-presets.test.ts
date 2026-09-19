import { describe, expect, it } from 'vitest'
import { AFFECT_PRESETS, AFFECT_RANGE } from '../shared/affect'

const presets = Object.entries(AFFECT_PRESETS)

describe('пресеты аффекта', () => {
  it('содержит четыре именованных настроения', () => {
    expect(presets).toHaveLength(4)
  })

  it.each(presets)('%s лежит внутри диапазонов из CONTEXT.md', (_name, point) => {
    expect(point.valence).toBeGreaterThanOrEqual(AFFECT_RANGE.valence[0])
    expect(point.valence).toBeLessThanOrEqual(AFFECT_RANGE.valence[1])
    expect(point.arousal).toBeGreaterThanOrEqual(AFFECT_RANGE.arousal[0])
    expect(point.arousal).toBeLessThanOrEqual(AFFECT_RANGE.arousal[1])
  })

  // Главный инвариант. Пресеты существуют ради тикета 05, где на них
  // проверяют, читается ли аффект и различимы ли оси по отдельности. Если
  // они скучкуются в одном углу плоскости, проверять будет нечего.
  it('занимает все четыре квадранта плоскости', () => {
    const quadrant = (p: { valence: number, arousal: number }) =>
      `${p.valence >= 0 ? 'pos' : 'neg'}-${p.arousal >= 0.5 ? 'high' : 'low'}`

    const covered = new Set(presets.map(([, point]) => quadrant(point)))

    expect([...covered].sort()).toEqual([
      'neg-high',
      'neg-low',
      'pos-high',
      'pos-low',
    ])
  })

  it('различает пресеты заметно, а не на доли процента', () => {
    for (const [nameA, a] of presets) {
      for (const [nameB, b] of presets) {
        if (nameA >= nameB)
          continue

        const distance = Math.hypot(a.valence - b.valence, a.arousal - b.arousal)
        expect(distance, `${nameA} и ${nameB} слишком близки`).toBeGreaterThan(0.3)
      }
    }
  })
})
