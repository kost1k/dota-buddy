import { readSnapshot } from '#shared/snapshot'
import { createLogger } from '../utils/logger'
import { initRecordingFromEnv, recordRawSnapshot } from '../utils/recorder'

initRecordingFromEnv()

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

  // Пишем СЫРОЕ тело, до санитизации: запись должна отражать то, что
  // действительно присылает Dota, а не наши представления о формате.
  // Иначе ошибка в поле осталась бы невидимой и в записи тоже.
  recordRawSnapshot(body)

  // Dota шлёт пустой объект при окончании матча или сессии. Это не ошибка,
  // а переход в сон — и заодно граница, после которой состояние матча
  // больше не имеет смысла.
  const snapshot = readSnapshot(body)
  if (!snapshot) {
    matchState.reset()
    logger.info('[gsi] idle', { sourceIp, peers: wsService.count() })
    wsService.broadcast({ type: 'idle' })
    return { status: 'ok', mode: 'idle' }
  }

  const events = matchState.ingest(snapshot)

  // Состояние идёт первым: событие описывает ИЗМЕНЕНИЕ, и клиент должен
  // увидеть новое положение прежде, чем ему скажут, что произошло.
  wsService.broadcast({ type: 'state', snapshot })
  for (const derived of events)
    wsService.broadcast({ type: 'event', event: derived })

  if (events.length > 0) {
    logger.debug('[gsi] events', {
      sourceIp,
      peers: wsService.count(),
      events: events.map(e => `${e.kindId}:${e.weight.toFixed(2)}`),
    })
  }

  return { status: 'ok' }
})
