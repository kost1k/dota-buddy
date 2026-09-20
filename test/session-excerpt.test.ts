import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { deriveEvents } from '../shared/derive'
import { readSnapshot } from '../shared/snapshot'

/**
 * Проверка разбора и вывода событий на ЖИВЫХ данных.
 *
 * Синтетика отвечает на вопрос «правильно ли работает логика», и отвечает
 * исчерпывающе. Этот файл отвечает на другой: «те ли данные мы вообще
 * разбираем». Фикстура — пять минут настоящего матча, и ловит она ровно то,
 * чего синтетика поймать не может, потому что синтетику пишем мы сами из
 * тех же представлений, по которым написан разбор.
 *
 * Происхождение и состав отрезка — `fixtures/README.md`.
 */

const lines = readFileSync(
  fileURLToPath(new URL('./fixtures/session-excerpt.jsonl', import.meta.url)),
  'utf8',
).split('\n').filter(Boolean)

const records = lines.map(line => JSON.parse(line) as { at: number, body: unknown })

describe('живая запись: разбор', () => {
  it('фикстура на месте и цела', () => {
    expect(records).toHaveLength(261)
  })

  // Главная проверка файла. Упадёт, если в `readSnapshot` разъедется имя
  // поля, требование обязательности или тип: настоящая Dota присылает
  // snake_case и опускает ключи, и здесь это настоящие её пакеты.
  it('разбирает каждый пакет отрезка', () => {
    const parsed = records.map(r => readSnapshot(r.body))

    expect(parsed.filter(Boolean)).toHaveLength(records.length)
  })

  it('читает игрока, команду и счёт', () => {
    const first = readSnapshot(records[0]!.body)!
    const last = readSnapshot(records[records.length - 1]!.body)!

    expect(first.player.team).toBe('radiant')
    expect(first.hero.level).toBe(18)
    expect(last.hero.level).toBe(20)
    expect(last.map.radiantScore).toBe(27)
    expect(last.map.direScore).toBe(41)
  })

  // `matchid` приходит строкой — подтверждено на записи. Заглушка стоит
  // потому, что фикстура обезличена, но ТИП обязан сохраниться.
  it('идентификатор матча остаётся строкой', () => {
    expect(readSnapshot(records[0]!.body)!.map.matchId).toBe('0')
  })
})

describe('живая запись: вывод событий', () => {
  function derivedCounts(): Record<string, number> {
    const counts: Record<string, number> = {}
    let previous = null

    for (const record of records) {
      const snapshot = readSnapshot(record.body)
      if (!snapshot)
        continue
      for (const kind of deriveEvents(previous, snapshot))
        counts[kind] = (counts[kind] ?? 0) + 1
      previous = snapshot
    }

    return counts
  }

  // Полный набор событий отрезка, а не отдельные ожидания: так тест ловит
  // и пропажу события, и появление лишнего. Второе важнее — ложное
  // срабатывание на живых данных синтетикой не ловится вовсе.
  it('выводит ровно ожидаемые события', () => {
    expect(derivedCounts()).toEqual({
      death: 1,
      respawn: 1,
      buyback: 1,
      levelUp: 1,
      levelLandmark: 1,
    })
  })
})

describe('живая запись: каденция', () => {
  // Число из этой же записи. Оно закреплено не ради самого числа, а чтобы
  // подмена фикстуры чем-то нереалистичным не прошла незаметно: на этой
  // каденции стоят постоянные времени аффекта.
  it('идёт примерно раз в секунду', () => {
    const deltas = records.slice(1).map((r, i) => r.at - records[i]!.at).sort((a, b) => a - b)
    const median = deltas[Math.floor(deltas.length / 2)]!

    expect(median).toBeGreaterThan(1000)
    expect(median).toBeLessThan(1300)
  })
})
