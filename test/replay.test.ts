import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ingestRawBody } from '../server/utils/ingest'
import { matchState } from '../server/utils/match-state'
import { createReplayPlayer, listRecordings, packetDelay, parseRecording, readRecording, replayPlayer, resolveRecording } from '../server/utils/replay'
import { deriveEvents } from '../shared/derive'
import { REPLAY_MODE_LABELS, shownPacket } from '../shared/replay'
import { readSnapshot } from '../shared/snapshot'
import { baselineSnapshot } from '../shared/synthetic'

/**
 * Воспроизведение записанной GSI-сессии.
 *
 * Запись — единственный канал доставки реальных данных с игрового ПК на
 * машину разработки, и проверять её надо тем же, чем она делается: синтетика
 * не воспроизводит ни таймингов, ни каденции.
 */

describe('разбор записи', () => {
  it('читает строку на пакет', () => {
    const text = [
      '{"at":1000,"body":{"map":{"matchid":"1"}}}',
      '{"at":2000,"body":{"map":{"matchid":"1"}}}',
      '',
    ].join('\n')

    expect(parseRecording(text)).toEqual([
      { at: 1000, body: { map: { matchid: '1' } } },
      { at: 2000, body: { map: { matchid: '1' } } },
    ])
  })

  it('терпит недописанную последнюю строку', () => {
    // Рекордер дописывает в конец и не гарантирует целостность последней
    // строки: файл может оборваться на середине пакета, если процесс убит
    // посреди матча. Терять из-за этого всю запись нельзя — переснять её
    // нельзя тоже.
    const text = '{"at":1000,"body":{}}\n{"at":2000,"bo'

    expect(parseRecording(text)).toHaveLength(1)
  })
})

describe('темп воспроизведения', () => {
  const packets = [
    { at: 1000, body: {} },
    { at: 2143, body: {} },
    { at: 8000, body: {} },
  ]

  it('пауза берётся из разницы меток, а не из среднего интервала', () => {
    // Каденция GSI неравномерна: медиана 1143 мс, но в паузе матча разрывы
    // совсем другие. Усреднение убило бы ровно то, ради чего делается
    // запись, — реальные тайминги.
    expect(packetDelay(packets, 1, 1)).toBe(1143)
    expect(packetDelay(packets, 2, 1)).toBe(5857)
  })

  it('первый пакет играется сразу', () => {
    expect(packetDelay(packets, 0, 1)).toBe(0)
  })

  it('скорость делит паузу', () => {
    expect(packetDelay(packets, 1, 10)).toBe(114.3)
  })

  it('метки, идущие назад, не дают отрицательной паузы', () => {
    const backwards = [{ at: 5000, body: {} }, { at: 1000, body: {} }]
    expect(packetDelay(backwards, 1, 1)).toBe(0)
  })
})

/** Пустое тело — то же, чем Dota сообщает о конце матча: это и есть сброс. */
function isReset(body: unknown) {
  return typeof body === 'object' && body !== null && Object.keys(body).length === 0
}

/**
 * Плеер, отвязанный от сервера: вместо приёма — сборщик тел.
 *
 * Сбросы считаются по пустым телам, а не отдельным методом: у шва один метод,
 * и тест смотрит ровно на то, что видит production.
 */
function testPlayer(packets: { at: number, body: unknown }[]) {
  const played: unknown[] = []
  let resets = 0
  const player = createReplayPlayer({
    ingest: (body) => {
      if (isReset(body))
        resets += 1
      else
        played.push(body)
    },
  })
  player.load('session.jsonl', packets)
  // Счётчик обнуляется после загрузки: она сама сбрасывает состояние, и без
  // этого каждый тест начинался бы с единицы.
  resets = 0
  return { player, played, resets: () => resets }
}

const THREE = [
  { at: 1000, body: { n: 0 } },
  { at: 2000, body: { n: 1 } },
  { at: 3000, body: { n: 2 } },
]

describe('плеер записи', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('первый пакет уходит сразу, следующие — по своим паузам', () => {
    const { player, played } = testPlayer(THREE)

    player.play()
    expect(played).toEqual([{ n: 0 }])

    vi.advanceTimersByTime(1000)
    expect(played).toEqual([{ n: 0 }, { n: 1 }])
  })

  it('пауза останавливает подачу, воспроизведение продолжает с того же места', () => {
    const { player, played } = testPlayer(THREE)

    player.play()
    player.pause()
    vi.advanceTimersByTime(10000)
    expect(played).toHaveLength(1)

    player.play()
    vi.advanceTimersByTime(1000)
    expect(played).toHaveLength(2)
  })

  it('на конце записи плеер сам останавливается', () => {
    const { player, played } = testPlayer(THREE)

    player.play()
    vi.advanceTimersByTime(60000)

    expect(played).toHaveLength(3)
    expect(player.status().mode).toBe('idle')
  })
})

describe('управление плеером', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('перемотка начинает с чистого состояния матча', () => {
    // Иначе дифф между старым и новым снапшотом выдал бы залп событий:
    // перепрыгнутая смерть, три уровня и аганим разом. Перемотка означает
    // «смотрим отсюда», а не «досматриваем в ускорении».
    const { player, played, resets } = testPlayer(THREE)

    player.seek(2)

    expect(resets()).toBe(1)
    expect(played).toEqual([{ n: 2 }])
    expect(player.status().index).toBe(3)
  })

  it('перемотка на ходу не останавливает воспроизведение', () => {
    const { player, played } = testPlayer([...THREE, { at: 4000, body: { n: 3 } }])

    player.play()
    player.seek(1)
    vi.advanceTimersByTime(1000)

    expect(played.at(-1)).toEqual({ n: 2 })
    expect(player.status().mode).toBe('playing')
  })

  it('смена скорости пересчитывает ожидание следующего пакета', () => {
    const { player, played } = testPlayer(THREE)

    player.play()
    player.setSpeed(10)
    vi.advanceTimersByTime(100)

    expect(played).toHaveLength(2)
  })

  it('стоп возвращает плеер в начало и сбрасывает состояние матча', () => {
    const { player, resets } = testPlayer(THREE)

    player.play()
    player.stop()

    expect(player.status()).toMatchObject({ mode: 'idle', index: 0 })
    expect(resets()).toBe(1)
  })

  it('загрузка другой записи сбрасывает состояние матча', () => {
    // Другой файл — заведомо другой матч: без сброса в состоянии остались бы
    // уровень, вехи и свежесть от предыдущего.
    const { player, resets } = testPlayer(THREE)

    player.load('other.jsonl', THREE)

    expect(resets()).toBe(1)
    expect(player.status().file).toBe('other.jsonl')
  })
})

/**
 * Приёмка тикета: записанная сессия проигрывается и даёт те же события.
 *
 * Эталон считается независимо — прямым прогоном `deriveEvents` по тем же
 * строкам, мимо плеера, состояния матча и рассылки. Сравнивать воспроизведение
 * с самим собой смысла нет.
 */
describe('живая запись через плеер', () => {
  const fixture = parseRecording(readFileSync(
    fileURLToPath(new URL('./fixtures/session-excerpt.jsonl', import.meta.url)),
    'utf8',
  ))

  function referenceEvents(): string[] {
    let previous: ReturnType<typeof readSnapshot> = null
    const kinds: string[] = []

    for (const packet of fixture) {
      const snapshot = readSnapshot(packet.body)
      if (!snapshot) {
        previous = null
        continue
      }
      kinds.push(...deriveEvents(previous, snapshot))
      previous = snapshot
    }

    return kinds
  }

  function playThrough(speed: number): string[] {
    const kinds: string[] = []
    matchState.reset()

    const player = createReplayPlayer({
      ingest: (body) => {
        const result = ingestRawBody(body)
        if (result.mode === 'state')
          kinds.push(...result.events.map(event => event.kindId))
      },
      reset: () => matchState.reset(),
    })

    player.load('session-excerpt.jsonl', fixture)
    player.setSpeed(speed)
    player.play()
    vi.advanceTimersByTime(600_000)

    return kinds
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('фикстура проигрывается целиком', () => {
    matchState.reset()
    const player = createReplayPlayer({ ingest: () => {}, reset: () => {} })
    player.load('session-excerpt.jsonl', fixture)
    player.play()
    vi.advanceTimersByTime(600_000)

    expect(player.status()).toMatchObject({ mode: 'idle', index: fixture.length })
  })

  it('даёт те же события, что прямой разбор', () => {
    expect(playThrough(1)).toEqual(referenceEvents())
  })

  it('ускорение не меняет вывод событий', () => {
    expect(playThrough(10)).toEqual(playThrough(1))
  })

  it('читается с диска', async () => {
    const path = fileURLToPath(new URL('./fixtures/session-excerpt.jsonl', import.meta.url))
    await expect(readRecording(path)).resolves.toHaveLength(fixture.length)
  })
})

describe('каталог записей', () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dota-buddy-replay-'))
    await writeFile(join(dir, 'session.jsonl'), '{"at":1,"body":{}}\n', 'utf8')
    await writeFile(join(dir, 'notes.txt'), 'не запись', 'utf8')
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('показывает только файлы записей', async () => {
    await expect(listRecordings(dir)).resolves.toEqual(['session.jsonl'])
  })

  it('несуществующий каталог — пустой список, а не падение', async () => {
    // Запись — вещь локальная: на машине без выездов каталога просто нет, и
    // пульт должен открываться, а не встречать ошибкой.
    await expect(listRecordings(join(dir, 'нет-такого'))).resolves.toEqual([])
  })

  it('имя за пределами каталога отвергается', () => {
    // Наружу и внутрь ходит только имя из листинга; полный путь клиент не
    // задаёт никогда.
    expect(resolveRecording(dir, '../../etc/passwd')).toBeNull()
    expect(resolveRecording(dir, 'session.jsonl')).toBe(join(dir, 'session.jsonl'))
  })
})

describe('плеер сервера', () => {
  it('подключён к состоянию матча и приёму пакетов', () => {
    // Проверяется именно проводка: плеер сам по себе ничего не знает ни про
    // состояние матча, ни про рассылку, и ошибиться тут можно молча.
    matchState.reset()
    matchState.ingest(baselineSnapshot())
    expect(matchState.snapshot()).not.toBeNull()

    replayPlayer.load('session.jsonl', [{ at: 1, body: {} }])

    expect(matchState.snapshot()).toBeNull()
  })
})

describe('показываемый пакет', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('на единицу меньше сыгранного: `seek` и `index` меряют разное', () => {
    // Сыграно 5 пакетов — показан пятый, у которого номер 4.
    expect(shownPacket({ file: 'f', mode: 'playing', index: 5, total: 10, speed: 1 })).toBe(4)
  })

  it('до первого пакета не уходит в минус', () => {
    expect(shownPacket({ file: null, mode: 'idle', index: 0, total: 0, speed: 1 })).toBe(0)
  })

  it('перемотка на показанный пакет не сдвигает картинку', () => {
    // Смысл единицы: подать в `seek` то, что вернул `shownPacket`, — значит
    // остаться на месте. Раньше это держалось на одном символе в разметке.
    const packets = [0, 1, 2, 3, 4].map(n => ({ at: 1000 + n * 1000, body: { n } }))
    const { player, played } = testPlayer(packets)

    player.play()
    vi.advanceTimersByTime(3000)
    const before = player.status()
    player.seek(shownPacket(before))

    expect(played.at(-1)).toEqual(packets[shownPacket(before)]!.body)
    expect(shownPacket(player.status())).toBe(shownPacket(before))
  })
})

describe('подписи режимов', () => {
  it('есть у каждого режима', () => {
    for (const mode of ['idle', 'playing', 'paused'] as const)
      expect(REPLAY_MODE_LABELS[mode]).toBeTruthy()
  })
})
