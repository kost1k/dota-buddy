import { describe, expect, it } from 'vitest'
import { BODY_LUMA, bodyColor, hueAngle, luma } from '../shared/palette'

const AXIS = [-1, -0.5, 0, 0.5, 1]
const AROUSAL = [0, 0.25, 0.5, 0.75, 1]

describe('bodyColor: ортогональность каналов', () => {
  // Главный инвариант файла. ADR-0001 требует, чтобы оси не смешивались, а
  // замер Wilms & Oberfeld показал, что тон несёт возбуждение (ηp²=.588), а
  // не валентность (.094, знак переворачивается). Поэтому валентность идёт
  // светлотой, возбуждение — тоном, и это должно держаться численно.

  it('светлота не зависит от возбуждения', () => {
    for (const valence of AXIS) {
      const lumas = AROUSAL.map(a => luma(bodyColor(valence, a)))
      const spread = Math.max(...lumas) - Math.min(...lumas)
      expect(spread, `валентность ${valence}: разброс светлоты по возбуждению`).toBeLessThan(2)
    }
  })

  it('тон не зависит от валентности — везде, где тон вообще есть', () => {
    // Мерить нужно УГОЛ тона, а не разность каналов: подмешивание белого
    // или чёрного ради нужной светлоты неизбежно сжимает абсолютную
    // разность `r − b`, но направления тона не трогает.
    //
    // Оговорка про насыщенность существенна, а не удобна: у почти серого
    // цвета угла тона нет перцептивно, и численно он скачет от округления
    // до целых. Середина шкалы возбуждения как раз такая — см. отдельный
    // блок про нейтральную середину.
    const meaningful = AROUSAL.filter(a =>
      AXIS.every((v) => {
        const c = bodyColor(v, a)
        return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) >= 12
      }),
    )
    expect(meaningful.length, 'должны остаться насыщенные точки шкалы').toBeGreaterThan(1)

    for (const arousal of meaningful) {
      const hues = AXIS.map(v => hueAngle(bodyColor(v, arousal)))
      const spread = Math.max(...hues) - Math.min(...hues)
      expect(spread, `возбуждение ${arousal}: разброс тона по валентности`).toBeLessThan(1)
    }
  })
})

describe('bodyColor: валентность светлотой', () => {
  it('монотонно светлеет с ростом валентности', () => {
    for (const arousal of AROUSAL) {
      let previous = -1
      for (const valence of AXIS) {
        const value = luma(bodyColor(valence, arousal))
        expect(value, `возбуждение ${arousal}`).toBeGreaterThan(previous)
        previous = value
      }
    }
  })

  it('держится в коридоре, выведенном из яркости фона игры', () => {
    for (const valence of AXIS) {
      for (const arousal of AROUSAL) {
        const value = luma(bodyColor(valence, arousal))
        expect(value).toBeGreaterThanOrEqual(BODY_LUMA.min - 1)
        expect(value).toBeLessThanOrEqual(BODY_LUMA.max + 1)
      }
    }
  })

  it('выходит на края коридора на концах шкалы', () => {
    expect(luma(bodyColor(-1, 0.5))).toBeCloseTo(BODY_LUMA.min, 0)
    expect(luma(bodyColor(1, 0.5))).toBeCloseTo(BODY_LUMA.max, 0)
  })
})

describe('bodyColor: возбуждение тоном', () => {
  it('монотонно теплеет с ростом возбуждения', () => {
    for (const valence of AXIS) {
      let previous = Number.NEGATIVE_INFINITY
      for (const arousal of AROUSAL) {
        const c = bodyColor(valence, arousal)
        const warmth = c.r - c.b
        expect(warmth, `валентность ${valence}`).toBeGreaterThan(previous)
        previous = warmth
      }
    }
  })

  it('в покое холодный, на взводе тёплый', () => {
    const calm = bodyColor(0, 0)
    const tense = bodyColor(0, 1)
    expect(calm.b).toBeGreaterThan(calm.r)
    expect(tense.r).toBeGreaterThan(tense.b)
  })

  it('не использует ось красный↔зелёный', () => {
    // Разведка: красный для негативной валентности не применять, ось
    // красный↔зелёный не применять. Проверяем, что зелёный никогда не
    // доминирует — иначе мы незаметно съехали на эту ось.
    for (const valence of AXIS) {
      for (const arousal of AROUSAL) {
        const c = bodyColor(valence, arousal)
        expect(c.g).toBeLessThanOrEqual(Math.max(c.r, c.b) + 1)
      }
    }
  })
})

describe('bodyColor: корректность значений', () => {
  it.each([-2, 2, Number.NaN])('не ломается на валентности вне диапазона: %p', (v) => {
    const c = bodyColor(v, 0.5)
    for (const ch of [c.r, c.g, c.b]) {
      expect(Number.isFinite(ch)).toBe(true)
      expect(ch).toBeGreaterThanOrEqual(0)
      expect(ch).toBeLessThanOrEqual(255)
    }
  })
})

describe('bodyColor: шкала проходит через нейтральный намеренно', () => {
  // Смешивание холодного с тёплым в RGB проходит через почти ахроматичную
  // середину. Это не дефект: альтернатива — интерполяция по кругу тонов,
  // а она ведёт синий к оранжевому ЧЕРЕЗ ЗЕЛЁНЫЙ, что разведка запрещает
  // прямо. Тест стоит здесь, чтобы это не «починили» обратно.

  it('в середине шкалы возбуждения цвет почти нейтрален', () => {
    const middle = bodyColor(0, 0.5)
    const chroma = Math.max(middle.r, middle.g, middle.b) - Math.min(middle.r, middle.g, middle.b)
    expect(chroma).toBeLessThan(12)
  })

  it('на концах шкалы цвет насыщен', () => {
    for (const arousal of [0, 1]) {
      const c = bodyColor(0, arousal)
      const chroma = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)
      expect(chroma, `возбуждение ${arousal}`).toBeGreaterThan(60)
    }
  })
})
