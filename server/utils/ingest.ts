import type { BuddyEvent } from '#shared/events'
import type { MatchSnapshot } from '#shared/snapshot'
import { isMatchBoundary } from '#shared/derive'
import { readSnapshot } from '#shared/snapshot'
import { matchState } from './match-state'
import { wsService } from './ws'

/**
 * Приём сырого тела GSI: одна дверь для всех источников пакетов.
 *
 * Источников три — живая Dota через `POST /api/gsi`, пульт с синтетическими
 * снапшотами и воспроизведение записи. Разбор, вывод событий и рассылка у
 * них обязаны быть общими: иначе воспроизведение проверяло бы себя, а не
 * пайплайн, а ради проверки пайплайна оно и делается.
 *
 * Здесь НЕ делается двух вещей, и обе намеренно. Авторизация — забота
 * эндпойнта: у пакета из файла нет и не может быть токена. Запись сырого
 * тела — тоже: иначе воспроизведение дописывало бы себя в ту же запись, и
 * следующий прогон играл бы собственный хвост.
 */

export type IngestResult
  = | { mode: 'idle' }
    | { mode: 'state', snapshot: MatchSnapshot, events: BuddyEvent[] }

/**
 * Конец матча: память сбрасывается И оверлеи узнают об этом. Всегда вместе.
 *
 * Врозь эти два действия разошлись: сброс на границе матча и при остановке
 * воспроизведения молчал, и оверлей продолжал рисовать картину прошлого
 * матча до таймаута живости — пятнадцать секунд. Поэтому у сброса здесь одно
 * имя и одно место, и других поводов сбрасывать память матча быть не должно.
 */
function endMatch() {
  matchState.reset()
  wsService.broadcast({ type: 'idle' })
}

export function ingestRawBody(body: unknown): IngestResult {
  // Dota шлёт пустой объект при окончании матча или сессии. Это не ошибка, а
  // переход в сон — и заодно граница, после которой состояние матча больше
  // не имеет смысла.
  const snapshot = readSnapshot(body)
  if (!snapshot) {
    endMatch()
    return { mode: 'idle' }
  }

  // Граница матча ловится ЗДЕСЬ, а не внутри памяти матча: сброс обязан
  // быть виден оверлею, а память про сокет не знает и знать не должна.
  // Клиент получит `idle`, следом `state`, и войдёт в новый матч чистым —
  // без накопленного урона и следа события от прошлого.
  if (isMatchBoundary(matchState.snapshot(), snapshot))
    endMatch()

  const events = matchState.ingest(snapshot)

  // Состояние идёт первым: событие описывает ИЗМЕНЕНИЕ, и клиент должен
  // увидеть новое положение прежде, чем ему скажут, что произошло.
  wsService.broadcast({ type: 'state', snapshot })
  for (const derived of events)
    wsService.broadcast({ type: 'event', event: derived })

  return { mode: 'state', snapshot, events }
}
