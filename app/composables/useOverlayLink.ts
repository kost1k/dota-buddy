import type { MatchSnapshot } from '#shared/snapshot'
// Импорты явные, а не на автоимпорт Nuxt: он объявляет `shared/` в типах,
// но в рантайме модуль не подтягивает — typecheck проходит, страница
// падает. Ошибка молчаливая, поэтому лучше писать явно.
import { accumulateDamage, baseArousal, baseValence } from '#shared/affect-signals'
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
    const { setBase } = useAffect()
    const { data } = useWebSocket(config.public.wsUrl, { autoReconnect: true })

    /**
     * Пересчёт объективной основы осей по новому снапшоту.
     *
     * Время между снапшотами берём по приходу, а не из `clock_time`: игра
     * ставится на паузу, а реальный темп потока это не меняет, и урон
     * надо копить по нему.
     *
     * Накопленный урон живёт ЗДЕСЬ, рядом с предыдущим снапшотом, а не на
     * сервере. ADR-0002 это не нарушает: там речь о памяти, которую терять
     * нельзя, — о свежести событий, копящейся весь матч. Запас урона
     * затухает за пять секунд, и клиент после перезагрузки browser source
     * всё равно начинает без предыдущего снапшота.
     */
    let previousSnapshot: typeof snapshot.value = null
    let previousAt = 0
    let accumulatedDamage = 0
    function refreshBase(next: NonNullable<typeof snapshot.value>) {
      const now = Date.now()
      const elapsed = previousAt > 0 ? (now - previousAt) / 1000 : 0
      accumulatedDamage = accumulateDamage(accumulatedDamage, previousSnapshot, next, elapsed)
      setBase({
        valence: baseValence(next),
        arousal: baseArousal(next, accumulatedDamage),
      })
      previousSnapshot = next
      previousAt = now
    }

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
          previousSnapshot = null
          previousAt = 0
          accumulatedDamage = 0
          setBase({ valence: 0, arousal: 0 })
          break
        case 'sync':
          // Синхронизация не будит: она лишь восстанавливает картину для
          // клиента, открывшегося посреди матча. Живость определяется
          // приходом настоящих обновлений.
          snapshot.value = message.snapshot
          if (message.snapshot)
            refreshBase(message.snapshot)
          break
        case 'state':
          lastMessageAt.value = Date.now()
          snapshot.value = message.snapshot
          refreshBase(message.snapshot)
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
