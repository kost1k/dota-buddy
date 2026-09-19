/**
 * Разбор сообщений, приходящих оверлею по WebSocket.
 *
 * Это протокол, который сервер шлёт СЕЙЧАС: сырой снапшот матча. На рубеже 2
 * он сменится на поток выводимых событий (ADR-0002), и модуль переписывается
 * вместе с ним.
 *
 * Модуль намеренно принимает строку, а не разобранный объект: у вызывающего
 * тогда один режим отказа вместо двух (битый JSON и неверная форма), и
 * обрабатывать его нужно в одном месте.
 */

export interface HeroSnapshot {
  alive: boolean
  level: number
}

export interface PlayerSnapshot {
  gpm: number
  xpm: number
  kills: number
  kill_streak: number
}

export interface MapSnapshot {
  game_state?: string
  game_time?: number
  clock_time?: number
  matchid?: string
}

export interface MatchSnapshot {
  hero: HeroSnapshot
  player: PlayerSnapshot
  map: MapSnapshot
}

export type OverlayMessage
  = | { type: 'update' | 'death', data: MatchSnapshot }
    | { type: 'idle', data: null }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function readHero(value: unknown): HeroSnapshot | null {
  if (!isObject(value))
    return null
  if (typeof value.alive !== 'boolean' || !isFiniteNumber(value.level))
    return null

  return { alive: value.alive, level: value.level }
}

function readPlayer(value: unknown): PlayerSnapshot | null {
  if (!isObject(value))
    return null

  const { gpm, xpm, kills, kill_streak: killStreak } = value
  if (!isFiniteNumber(gpm) || !isFiniteNumber(xpm) || !isFiniteNumber(kills))
    return null

  // Сервер всегда нормализует kill_streak, но полагаться на это не стоит:
  // между версиями сервера и оверлея бывает рассинхрон.
  if (killStreak !== undefined && !isFiniteNumber(killStreak))
    return null

  return { gpm, xpm, kills, kill_streak: killStreak ?? 0 }
}

/** Поля карты опциональны: берём только присутствующие и верного типа. */
function readMap(value: unknown): MapSnapshot {
  if (!isObject(value))
    return {}

  const map: MapSnapshot = {}
  if (typeof value.game_state === 'string')
    map.game_state = value.game_state
  if (isFiniteNumber(value.game_time))
    map.game_time = value.game_time
  if (isFiniteNumber(value.clock_time))
    map.clock_time = value.clock_time
  if (typeof value.matchid === 'string')
    map.matchid = value.matchid

  return map
}

/**
 * Возвращает разобранное сообщение или `null`, если оно непригодно по любой
 * причине. Никогда не бросает.
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

  if (payload.type === 'idle')
    return { type: 'idle', data: null }

  if (payload.type !== 'update' && payload.type !== 'death')
    return null

  if (!isObject(payload.data))
    return null

  const hero = readHero(payload.data.hero)
  const player = readPlayer(payload.data.player)
  if (!hero || !player)
    return null

  return {
    type: payload.type,
    data: { hero, player, map: readMap(payload.data.map) },
  }
}
