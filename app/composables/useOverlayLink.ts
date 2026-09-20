import type { MatchSnapshot } from '#shared/snapshot'
import { isAwake } from '#shared/liveness'
import { parseOverlayMessage } from '#shared/overlay-message'

/**
 * Связь оверлея с сервером.
 *
 * Сервер отдаёт и состояние, и события: непрерывное состояние питает оси
 * аффекта, дискретные события — реакции. Клиент ничего не диффит — память о
 * предыдущем снапшоте живёт на сервере, потому что browser source в OBS
 * перезагружается регулярно (ADR-0002).
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
    const { apply } = useReactions()
    const { data } = useWebSocket(config.public.wsUrl, { autoReconnect: true })

    watch(data, (raw) => {
      if (typeof raw !== 'string')
        return

      const message = parseOverlayMessage(raw)
      if (!message)
        return

      switch (message.type) {
        case 'idle':
          lastMessageAt.value = null
          snapshot.value = null
          break
        case 'sync':
          // Синхронизация не будит: она лишь восстанавливает картину для
          // клиента, открывшегося посреди матча. Живость определяется
          // приходом настоящих обновлений.
          snapshot.value = message.snapshot
          break
        case 'state':
          lastMessageAt.value = Date.now()
          snapshot.value = message.snapshot
          break
        case 'event':
          lastMessageAt.value = Date.now()
          apply(message.event)
          break
      }
    })
  }

  return { snapshot, awake }
}
