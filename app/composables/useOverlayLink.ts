import type { MatchSnapshot } from '#shared/gsi-message'
import { parseOverlayMessage } from '#shared/gsi-message'
import { isAwake } from '#shared/liveness'

/**
 * Связь оверлея с сервером: WebSocket, последний снапшот и признак сна.
 *
 * Пока сервер шлёт сырые снапшоты. На рубеже 2 он начнёт слать выводимые
 * события (ADR-0002), и меняться будет этот композабл, а не сцена.
 *
 * Снапшот сейчас ни на что не влияет: аффект на рубеже 1 ведёт пульт.
 * Связь нужна, чтобы работал сон и чтобы протокол не сгнил.
 */
export function useOverlayLink() {
  const config = useRuntimeConfig()
  const idleTimeoutMs = Number(config.public.idleTimeoutMs) || 15_000

  const snapshot = useState<MatchSnapshot | null>('link:snapshot', () => null)
  const lastMessageAt = useState<number | null>('link:lastMessageAt', () => null)

  // Секундный таймер, а не rAF: сон наступает по тишине, и точность до
  // кадра здесь не нужна, а лишний кадровый таймер — нужен ещё меньше.
  const now = useTimestamp({ interval: 1000 })

  const awake = computed(() => isAwake(lastMessageAt.value, now.value, idleTimeoutMs))

  if (import.meta.client) {
    const { data } = useWebSocket(config.public.wsUrl, { autoReconnect: true })

    watch(data, (raw) => {
      if (typeof raw !== 'string')
        return

      const message = parseOverlayMessage(raw)
      if (!message)
        return

      lastMessageAt.value = Date.now()
      snapshot.value = message.data
    })
  }

  return { snapshot, awake }
}
