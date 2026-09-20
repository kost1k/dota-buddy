/**
 * Протокол WebSocket между сервером и оверлеем.
 *
 * Сервер отдаёт И состояние, И события, потому что они нужны разному:
 * непрерывное состояние питает оси аффекта, дискретные события — реакции.
 * Отдавать только события значило бы лишить оси подпитки; только состояние
 * — заставить клиент диффить, а этого он делать не должен (ADR-0002).
 *
 * `sync` уходит при подключении: клиент, открывшийся посреди матча, иначе
 * не знал бы ни уровня, ни вех, ни счёта. Вехи и уровень при этом отдельно
 * не передаются — они поля снапшота, и выводить их из него надёжнее, чем
 * накапливать параллельно и потом сверять.
 */

import type { BuddyEvent } from './events'
import type { MatchSnapshot } from './snapshot'

export type OverlayMessage
  = | { type: 'sync', snapshot: MatchSnapshot | null }
    | { type: 'state', snapshot: MatchSnapshot }
    | { type: 'event', event: BuddyEvent }
    | { type: 'idle' }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function looksLikeSnapshot(value: unknown): value is MatchSnapshot {
  return isObject(value) && isObject(value.hero) && isObject(value.player) && isObject(value.map)
}

function looksLikeEvent(value: unknown): value is BuddyEvent {
  return isObject(value)
    && typeof value.id === 'number'
    && typeof value.kindId === 'string'
    && typeof value.weight === 'number'
    && isObject(value.direction)
}

/**
 * Возвращает разобранное сообщение или `null`, если оно непригодно по любой
 * причине. Никогда не бросает.
 *
 * Принимает строку, а не разобранный объект, намеренно: у вызывающего тогда
 * один режим отказа вместо двух — битый JSON и неверная форма, — и
 * обрабатывать его нужно в одном месте.
 */
export function parseOverlayMessage(raw: string): OverlayMessage | null {
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  }
  catch {
    return null
  }

  if (!isObject(payload))
    return null

  switch (payload.type) {
    case 'idle':
      return { type: 'idle' }
    case 'sync':
      return {
        type: 'sync',
        snapshot: looksLikeSnapshot(payload.snapshot) ? payload.snapshot : null,
      }
    case 'state':
      return looksLikeSnapshot(payload.snapshot)
        ? { type: 'state', snapshot: payload.snapshot }
        : null
    case 'event':
      return looksLikeEvent(payload.event)
        ? { type: 'event', event: payload.event }
        : null
    default:
      return null
  }
}
