import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { stepAffect } from '../shared/affect'
import { accumulateDamage, baseArousal, baseValence } from '../shared/affect-signals'
import { readSnapshot } from '../shared/snapshot'

/**
 * Качество поведения на живой записи.
 *
 * Отдельно от `session-excerpt.test.ts`: тот отвечает на вопрос «те ли
 * данные мы разбираем», этот — на вопрос «как это выглядит». Разные
 * предметы, и ломаются они по разным причинам.
 */

const records = readFileSync(
  fileURLToPath(new URL('./fixtures/session-excerpt.jsonl', import.meta.url)),
  'utf8',
).split('\n').filter(Boolean).map(line => JSON.parse(line) as { at: number, body: unknown })

describe('качество аффекта на живой записи', () => {
  /**
   * Проигрывает отрезок через настоящий конвейер на 60 кадрах и возвращает
   * то, что видно глазу.
   *
   * Эти пороги — не украшение. Прежняя конструкция давала на полной записи
   * 63% покоя и 5.4 видимых качания в минуту, и бадди трясло всю игру.
   * Числа здесь не дают вернуть тот шум «поправкой по вкусу»: подкрутить
   * постоянную можно, но молча ухудшить поведение — нет.
   */
  function replay() {
    const FPS = 60
    const STEP = 1 / FPS

    let state = { valence: 0, arousal: 0 }
    let accumulated = 0
    let previous: ReturnType<typeof readSnapshot> = null
    let previousAt = 0

    let frames = 0
    let resting = 0
    let seconds = 0
    let peak = 0

    // Качание считаем видимым, если размах хода сопоставим с порогом
    // различения движения: развороты мельче глазу недоступны.
    const VISIBLE = 0.03
    let direction = 0
    let swingFrom = 0
    let swings = 0
    let previousArousal = 0

    for (const record of records) {
      const snapshot = readSnapshot(record.body)
      if (!snapshot)
        continue

      const elapsed = previousAt > 0 ? (record.at - previousAt) / 1000 : 0
      accumulated = accumulateDamage(accumulated, previous, snapshot, elapsed)
      const target = {
        valence: baseValence(snapshot),
        arousal: baseArousal(snapshot, accumulated),
      }

      if (elapsed > 0 && elapsed < 5) {
        for (let t = 0; t < elapsed; t += STEP) {
          state = stepAffect(state, target, STEP)

          const heading = Math.sign(state.arousal - previousArousal)
          if (heading !== 0 && heading !== direction) {
            if (Math.abs(previousArousal - swingFrom) >= VISIBLE)
              swings++
            swingFrom = previousArousal
            direction = heading
          }

          if (state.arousal <= 0.05)
            resting++
          peak = Math.max(peak, state.arousal)
          previousArousal = state.arousal
          frames++
        }
        seconds += elapsed
      }

      previous = snapshot
      previousAt = record.at
    }

    return {
      restingShare: resting / frames,
      swingsPerMinute: swings / (seconds / 60),
      peak,
    }
  }

  it('бадди большую часть отрезка неподвижен', () => {
    expect(replay().restingShare).toBeGreaterThan(0.75)
  })

  it('не трясётся: видимых качаний мало', () => {
    expect(replay().swingsPerMinute).toBeLessThan(3.5)
  })

  // Обратная сторона: покой не должен достигаться ценой безразличия. В
  // отрезке есть смерть, и на ней ось обязана дойти до верха.
  it('на смерти доходит до верха шкалы', () => {
    expect(replay().peak).toBeGreaterThan(0.8)
  })
})
