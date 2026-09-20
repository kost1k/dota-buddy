import type { MatchSnapshot } from '../shared/snapshot'
import { describe, expect, it } from 'vitest'
import { accumulateDamage, baseArousal, baseValence } from '../shared/affect-signals'
import { baselineSnapshot } from '../shared/synthetic'

function snap(hero: Partial<MatchSnapshot['hero']> = {}, player: Partial<MatchSnapshot['player']> = {}, map: Partial<MatchSnapshot['map']> = {}): MatchSnapshot {
  const base = baselineSnapshot()
  return {
    hero: { ...base.hero, ...hero },
    player: { ...base.player, ...player },
    map: { ...base.map, ...map },
  }
}

/** Здоровье как доля: остальные поля героя в осях не участвуют. */
function hp(fraction: number, hero: Partial<MatchSnapshot['hero']> = {}) {
  return snap({ health: fraction * 1000, maxHealth: 1000, healthFraction: fraction, ...hero })
}

describe('валентность: преимущество в счёте', () => {
  it('ноль при равном счёте', () => {
    expect(baseValence(snap())).toBeCloseTo(0, 9)
  })

  it('монотонна по преимуществу', () => {
    let previous = Number.NEGATIVE_INFINITY
    for (const lead of [-30, -10, -3, 0, 3, 10, 30]) {
      const value = baseValence(snap({}, {}, { radiantScore: Math.max(lead, 0), direScore: Math.max(-lead, 0) }))
      expect(value).toBeGreaterThan(previous)
      previous = value
    }
  })

  it('насыщается, а не растёт без предела', () => {
    // Разрыв в тридцать килов не втрое сильнее разрыва в десять: к этому
    // моменту всё уже ясно.
    const ten = baseValence(snap({}, {}, { radiantScore: 10, direScore: 0 }))
    const thirty = baseValence(snap({}, {}, { radiantScore: 30, direScore: 0 }))

    expect(thirty).toBeGreaterThan(ten)
    expect(thirty).toBeLessThan(ten * 1.6)
  })

  it('оставляет запас шкалы под смещение от событий', () => {
    const huge = baseValence(snap({}, {}, { radiantScore: 60, direScore: 0 }))
    expect(Math.abs(huge)).toBeLessThan(0.8)
  })

  it('знак зависит от своей стороны', () => {
    const map = { radiantScore: 12, direScore: 4 }
    expect(baseValence(snap({}, { team: 'radiant' }, map))).toBeGreaterThan(0)
    expect(baseValence(snap({}, { team: 'dire' }, map))).toBeLessThan(0)
  })
})

describe('накопленный урон: накопление', () => {
  it('пустой накопитель без урона остаётся пустым', () => {
    expect(accumulateDamage(0, hp(1), hp(1), 1)).toBe(0)
  })

  it('потеря здоровья пополняет накопитель', () => {
    expect(accumulateDamage(0, hp(1), hp(0.7), 1)).toBeCloseTo(0.3, 2)
  })

  // Разница с прежней конструкцией. Раньше брали мгновенную скорость, и
  // серия мелких разменов давала серию отдельных выбросов. Теперь она
  // складывается в один подъём.
  it('серия мелких потерь складывается', () => {
    let value = 0
    for (let i = 0; i < 4; i++)
      value = accumulateDamage(value, hp(1 - i * 0.05), hp(1 - (i + 1) * 0.05), 0.2)

    const single = accumulateDamage(0, hp(1), hp(0.95), 0.2)
    expect(value).toBeGreaterThan(single * 3)
  })

  it('лечение накопитель не опустошает', () => {
    // Иначе хилка обрывала бы тревогу мгновенно, хотя по ощущению
    // напряжение спадает постепенно.
    const afterDamage = accumulateDamage(0, hp(1), hp(0.5), 0.5)
    const afterHeal = accumulateDamage(afterDamage, hp(0.5), hp(1), 0.5)

    expect(afterHeal).toBeGreaterThan(afterDamage * 0.8)
  })
})

describe('накопленный урон: затухание', () => {
  it('без нового урона убывает', () => {
    const decayed = accumulateDamage(0.5, hp(1), hp(1), 5)
    expect(decayed).toBeLessThan(0.5)
    expect(decayed).toBeGreaterThan(0)
  })

  // То же требование, что и у сглаживания аффекта: результат не должен
  // зависеть от того, как часто вызвали. Каденция GSI плавает.
  it('не зависит от частоты вызовов', () => {
    const oneStep = accumulateDamage(0.5, hp(1), hp(1), 4)

    let twoSteps = 0.5
    twoSteps = accumulateDamage(twoSteps, hp(1), hp(1), 2)
    twoSteps = accumulateDamage(twoSteps, hp(1), hp(1), 2)

    expect(twoSteps).toBeCloseTo(oneStep, 9)
  })

  it('на первом снапшоте только затухает', () => {
    expect(accumulateDamage(0.5, null, hp(0.1), 5)).toBeLessThan(0.5)
  })

  it.each([0, -1, Number.NaN])('переживает некорректное время: %p', (dt) => {
    const value = accumulateDamage(0.5, hp(1), hp(0.2), dt)
    expect(Number.isFinite(value)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(0)
  })
})

describe('возбуждение: урон', () => {
  it('ноль в покое: полное здоровье, пустой накопитель, без дебаффов', () => {
    expect(baseArousal(hp(1), 0)).toBe(0)
  })

  // Мёртвая зона у нуля. Без неё хвост затухания держал бы бадди вечно
  // шевелящимся, а в покое амплитуда обязана быть РОВНО нулём: движущиеся
  // стимулы перехватывают внимание и раздражают.
  it('рядовой размен не поднимает ось вовсе', () => {
    expect(baseArousal(hp(1), 0.04)).toBe(0)
  })

  it('серьёзный урон поднимает ось заметно', () => {
    expect(baseArousal(hp(1), 0.3)).toBeGreaterThan(0.5)
  })

  it('растёт по накопленному урону', () => {
    let previous = Number.NEGATIVE_INFINITY
    for (const damage of [0.1, 0.2, 0.3, 0.5]) {
      const value = baseArousal(hp(1), damage)
      expect(value).toBeGreaterThan(previous)
      previous = value
    }
  })

  // Инвариант тикета 09 сохраняется, но выражен иначе: тот же урон,
  // растянутый во времени, успевает затухнуть и тревожит слабее.
  it('тот же урон медленнее тревожит слабее', () => {
    const fast = accumulateDamage(0, hp(1), hp(0.4), 0.5)

    let slow = 0
    for (let i = 0; i < 6; i++)
      slow = accumulateDamage(slow, hp(1 - i * 0.1), hp(1 - (i + 1) * 0.1), 4)

    expect(baseArousal(hp(0.4), fast)).toBeGreaterThan(baseArousal(hp(0.4), slow))
  })

  it('стабильное здоровье не тревожит, каким бы оно ни было', () => {
    expect(baseArousal(hp(0.7), 0)).toBeLessThan(0.1)
  })
})

describe('возбуждение: дебаффы и низкое здоровье', () => {
  // Правка к тикету 09. Там дебаффы включены как «краткие, наблюдаемые,
  // означают сейчас решается». Для именованных флагов это верно; для
  // `has_debuff` измерение на живой записи дало 22% матча и 90
  // переключений — он истинен при любом отрицательном модификаторе,
  // вплоть до замедления от крипа, и посылка к нему не относится.
  it('has_debuff ось не двигает', () => {
    expect(baseArousal(hp(1, { hasDebuff: true }), 0)).toBe(0)
  })

  it('обездвиживание тревожнее прочих дебаффов', () => {
    const stunned = baseArousal(hp(1, { stunned: true }), 0)
    const silenced = baseArousal(hp(1, { silenced: true }), 0)

    expect(stunned).toBeGreaterThan(silenced)
    expect(silenced).toBeGreaterThan(0)
  })

  it('хекс считается обездвиживанием', () => {
    expect(baseArousal(hp(1, { hexed: true }), 0)).toBe(baseArousal(hp(1, { stunned: true }), 0))
  })

  it('два дебаффа не вдвое тревожнее одного', () => {
    const one = baseArousal(hp(1, { stunned: true }), 0)
    const two = baseArousal(hp(1, { stunned: true, silenced: true }), 0)
    expect(two).toBeCloseTo(one, 9)
  })

  it('низкое здоровье добавляет поправку', () => {
    // Иначе тихое умирание от яда не дало бы ничего: урон медленный,
    // дебаффа может не быть.
    expect(baseArousal(hp(0.08), 0)).toBeGreaterThan(0.25)
  })

  it('мёртвый герой поправку по здоровью не получает', () => {
    expect(baseArousal(snap({ alive: false, health: 0, healthFraction: 0 }), 0)).toBe(0)
  })

  it('никогда не выходит за 0..1', () => {
    const value = baseArousal(hp(0.01, { stunned: true, silenced: true, hasDebuff: true }), 1)
    expect(value).toBeLessThanOrEqual(1)
    expect(value).toBeGreaterThanOrEqual(0)
  })
})
