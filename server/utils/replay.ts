/**
 * Воспроизведение записанной GSI-сессии.
 *
 * Второй источник пакетов рядом с живой Дотой и пультом. Все трое входят в
 * систему одной дверью (`ingestRawBody`), различаясь только тем, откуда
 * берут тело: иначе воспроизведение проверяло бы себя, а не пайплайн.
 */

import type { ReplayMode, ReplayStatus } from '#shared/replay'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { ingestRawBody } from './ingest'

/** Строка записи: метка приёма и сырое тело пакета, как его прислала Dota. */
export interface RecordedPacket {
  at: number
  body: unknown
}

/**
 * Разбирает файл записи (JSON Lines).
 *
 * Битые строки пропускаются молча и намеренно: рекордер дописывает в конец
 * и не гарантирует целостность последней строки — процесс может быть убит
 * посреди пакета. Ронять на этом всю запись нельзя, переснять матч нельзя
 * тоже.
 */
export function parseRecording(text: string): RecordedPacket[] {
  const packets: RecordedPacket[] = []

  for (const line of text.split('\n')) {
    if (!line.trim())
      continue

    try {
      const parsed = JSON.parse(line) as RecordedPacket
      if (typeof parsed?.at === 'number')
        packets.push({ at: parsed.at, body: parsed.body })
    }
    catch {
      continue
    }
  }

  return packets
}

/**
 * Записи в каталоге, по имени файла.
 *
 * Отсутствующий каталог — пустой список, а не ошибка: запись вещь локальная,
 * на машине без выездов каталога просто нет, и пульт должен открываться.
 */
export async function listRecordings(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map(entry => entry.name)
      .sort()
  }
  catch {
    return []
  }
}

/**
 * Превращает имя из листинга в путь. `null`, если имя уводит за каталог.
 *
 * Наружу и внутрь ходит только имя файла: полный путь клиент не задаёт
 * никогда, иначе ручка воспроизведения читала бы с диска что угодно.
 */
export function resolveRecording(dir: string, name: string): string | null {
  if (name !== basename(name))
    return null

  const path = join(dir, name)
  if (resolve(path) !== join(resolve(dir), name))
    return null

  return path
}

/** Читает файл записи целиком. Пятиминутный отрезок — это 1.6 Мб. */
export async function readRecording(path: string): Promise<RecordedPacket[]> {
  return parseRecording(await readFile(path, 'utf8'))
}

/**
 * Пауза перед пакетом с номером `index`, в миллисекундах.
 *
 * Считается из разницы соседних меток, а не из среднего интервала: каденция
 * GSI неравномерна (медиана 1143 мс, p95 1198 мс, а в паузе матча разрывы
 * совсем другие), и усреднение стёрло бы именно то, ради чего делается
 * запись.
 *
 * Метки, идущие назад, дают ноль: запись с нарушенным порядком — дефект,
 * из-за которого в рекордере появилась очередь, и воспроизведение такого
 * файла не должно вставать намертво.
 */
export function packetDelay(packets: RecordedPacket[], index: number, speed: number): number {
  if (index <= 0 || index >= packets.length)
    return 0

  const gap = packets[index]!.at - packets[index - 1]!.at
  if (gap <= 0)
    return 0

  return gap / speed
}

/**
 * Куда плеер отдаёт пакеты.
 *
 * Зависимость вынесена наружу, чтобы плеер не знал ни про `matchState`, ни
 * про рассылку: темп и управление проверяются отдельно от пайплайна, иначе
 * тест на паузы тащил бы за собой весь вывод событий.
 *
 * Метод ОДИН намеренно. Раньше их было два, и слово «сброс» на другой
 * стороне шва значило не то же самое: в production — молча, в приёме — с
 * оповещением оверлеев. Пустое тело уже означает конец матча, так что
 * отдельному методу нечего выражать, а порядок «сначала сброс, потом
 * пакет» перестаёт быть устным договором — это просто два `ingest`.
 */
export interface ReplaySink {
  ingest: (body: unknown) => void
}

export function createReplayPlayer(sink: ReplaySink) {
  let packets: RecordedPacket[] = []
  let file: string | null = null
  let index = 0
  let mode: ReplayMode = 'idle'
  let speed = 1
  let timer: ReturnType<typeof setTimeout> | null = null

  /**
   * Сброс состояния матча. Пустое тело — то же, чем Dota сообщает о конце
   * матча и сессии; остановка воспроизведения этим и является.
   */
  function resetMatch() {
    sink.ingest({})
  }

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  /** Ставит таймер на следующий пакет. Конец записи останавливает плеер. */
  function schedule() {
    clearTimer()

    if (index >= packets.length) {
      mode = 'idle'
      return
    }

    timer = setTimeout(step, packetDelay(packets, index, speed))
  }

  function step() {
    const packet = packets[index]
    if (!packet) {
      mode = 'idle'
      return
    }

    sink.ingest(packet.body)
    index += 1
    schedule()
  }

  return {
    load(name: string, loaded: RecordedPacket[]) {
      clearTimer()
      file = name
      packets = loaded
      index = 0
      mode = 'idle'
      // Другой файл — заведомо другой матч: без сброса в состоянии остались
      // бы уровень, вехи и свежесть от предыдущего.
      resetMatch()
    },

    play() {
      if (mode === 'playing' || index >= packets.length)
        return

      // С паузы плеер продолжает ожиданием, а не подачей: пакет на текущем
      // номере ещё не сыгран, и выдавать его вне темпа значило бы врать про
      // тайминги ровно в тот момент, когда на них смотрят.
      const resuming = mode === 'paused'
      mode = 'playing'

      if (resuming)
        schedule()
      else
        step()
    },

    pause() {
      if (mode !== 'playing')
        return

      clearTimer()
      mode = 'paused'
    },

    /**
     * Перемотка: состояние матча сбрасывается, целевой пакет принимается
     * как первый.
     *
     * Иначе дифф между старым и новым снапшотом выдал бы залп событий —
     * перепрыгнутая смерть, три уровня и аганим разом. На первом пакете
     * `deriveEvents` намеренно молчит, поэтому перемотка честно означает
     * «смотрим отсюда», а не «досматриваем в ускорении».
     */
    seek(target: number) {
      if (packets.length === 0)
        return

      const clamped = Math.max(0, Math.min(Math.trunc(target), packets.length - 1))
      clearTimer()
      resetMatch()
      sink.ingest(packets[clamped]!.body)
      index = clamped + 1

      if (mode === 'playing')
        schedule()
    },

    /**
     * Скорость. На ходу пересчитывает ожидание следующего пакета целиком,
     * не учитывая уже отсчитанное: ошибка не больше одного интервала и
     * гасится первым же пакетом, а точный учёт потребовал бы держать
     * собственные часы.
     */
    setSpeed(next: number) {
      if (!(next > 0))
        return

      speed = next
      if (mode === 'playing')
        schedule()
    },

    /** Полная остановка: в начало записи, с чистым состоянием матча. */
    stop() {
      clearTimer()
      index = 0
      mode = 'idle'
      resetMatch()
    },

    status(): ReplayStatus {
      return { file, mode, index, total: packets.length, speed }
    },
  }
}

/**
 * Плеер сервера. Один на процесс — как и состояние матча, и по той же
 * причине: поток GSI один, оверлей локальный.
 *
 * Пакеты идут в общий приём (`ingestRawBody`), а не в собственную дорогу:
 * иначе воспроизведение проверяло бы себя, а не пайплайн.
 */
export const replayPlayer = createReplayPlayer({
  ingest: body => ingestRawBody(body),
})
