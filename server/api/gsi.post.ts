import { createLogger } from '../utils/logger'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getBodyAuthToken(body: Record<string, unknown>): string | null {
  if (!isObject(body.auth))
    return null
  if (typeof body.auth.token !== 'string')
    return null
  return body.auth.token
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidHero(hero: unknown): hero is { alive: boolean, level: number } {
  return isObject(hero)
    && typeof hero.alive === 'boolean'
    && isFiniteNumber(hero.level)
}

function isValidPlayer(player: unknown): player is {
  gpm: number
  xpm: number
  kills: number
  kill_streak?: number
} {
  if (!isObject(player))
    return false

  if (!isFiniteNumber(player.gpm) || !isFiniteNumber(player.xpm) || !isFiniteNumber(player.kills))
    return false

  if (player.kill_streak !== undefined && !isFiniteNumber(player.kill_streak))
    return false

  return true
}

interface SanitizedHero {
  alive: boolean
  level: number
}

interface SanitizedPlayer {
  gpm: number
  xpm: number
  kills: number
  kill_streak: number
}

interface SanitizedMap {
  game_state?: string
  game_time?: number
  clock_time?: number
  matchid?: string
}

function pickMapFieldAsNumber(map: Record<string, unknown>, key: string): number | undefined {
  const value = map[key]
  return isFiniteNumber(value) ? value : undefined
}

function pickMapFieldAsString(map: Record<string, unknown>, key: string): string | undefined {
  const value = map[key]
  return typeof value === 'string' ? value : undefined
}

function sanitizeHero(hero: { alive: boolean, level: number }): SanitizedHero {
  return {
    alive: hero.alive,
    level: hero.level,
  }
}

function sanitizePlayer(player: {
  gpm: number
  xpm: number
  kills: number
  kill_streak?: number
}): SanitizedPlayer {
  return {
    gpm: player.gpm,
    xpm: player.xpm,
    kills: player.kills,
    kill_streak: player.kill_streak ?? 0,
  }
}

function sanitizeMap(map: Record<string, unknown>): SanitizedMap {
  return {
    game_state: pickMapFieldAsString(map, 'game_state'),
    game_time: pickMapFieldAsNumber(map, 'game_time'),
    clock_time: pickMapFieldAsNumber(map, 'clock_time'),
    matchid: pickMapFieldAsString(map, 'matchid'),
  }
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const expectedSecret = runtimeConfig.gsiSecret?.trim()
  const logger = createLogger(runtimeConfig.logLevel)
  const sourceIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown'

  const body = await readBody<unknown>(event)
  if (!isObject(body)) {
    logger.warn('[gsi] invalid body object', { sourceIp })
    setResponseStatus(event, 400, 'Invalid GSI payload')
    return { status: 'error', code: 'invalid_body' }
  }

  if (expectedSecret) {
    const headerSecret = getHeader(event, 'x-gsi-secret')?.trim()
    const bodySecret = getBodyAuthToken(body)?.trim()
    const providedSecret = headerSecret || bodySecret || ''

    if (providedSecret !== expectedSecret) {
      logger.warn('[gsi] unauthorized request', { sourceIp })
      setResponseStatus(event, 401, 'Unauthorized GSI request')
      return { status: 'error', code: 'unauthorized' }
    }
  }

  // Dota может прислать пустой объект при окончании матча/сессии.
  // В этом случае переводим оверлей в idle-state, а не считаем это ошибкой.
  if (Object.keys(body).length === 0) {
    logger.info('[gsi] idle event (empty payload)', { sourceIp, peers: wsService.count() })
    wsService.broadcast({ type: 'idle', data: null })
    return { status: 'ok', mode: 'idle' }
  }

  if (!isValidHero(body.hero) || !isValidPlayer(body.player) || !isObject(body.map)) {
    logger.info('[gsi] idle event (invalid payload shape)', { sourceIp, peers: wsService.count() })
    wsService.broadcast({ type: 'idle', data: null })
    return { status: 'ok', mode: 'idle' }
  }

  const hero = sanitizeHero(body.hero)
  const player = sanitizePlayer(body.player)
  const map = sanitizeMap(body.map)

  const payload = {
    type: 'update',
    data: {
      hero,
      player,
      map,
    },
  }

  if (hero.alive === false) {
    payload.type = 'death'
  }

  logger.debug('[gsi] event broadcast', {
    type: payload.type,
    sourceIp,
    peers: wsService.count(),
    heroLevel: hero.level,
    gpm: player.gpm,
    xpm: player.xpm,
    kills: player.kills,
  })
  wsService.broadcast(payload)

  return { status: 'ok' }
})
