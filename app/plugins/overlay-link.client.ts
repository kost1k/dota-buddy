import type { LinkState } from '#shared/overlay-link'
// Импорты явные: автоимпорт Nuxt объявляет `shared/` в типах, но в рантайме
// модуль не подтягивает.
import { EMPTY_LINK_STATE, reduceOverlayMessage } from '#shared/overlay-link'
import { parseOverlayMessage } from '#shared/overlay-message'

/**
 * Связь оверлея с сервером — владелец транспорта.
 *
 * Плагин, а не композабл, ровно ради времени жизни: сокет, подписка и часы
 * живости обязаны быть в единственном числе, а композабл зовут из четырёх
 * мест. Раньше каждое поднимало свой сокет, и одно событие применялось
 * дважды на оверлее и трижды на пульте (тикет 14).
 *
 * Клиентский намеренно: в эфир уходит браузер, а при рендере на сервере
 * подключаться некуда. Читающая сторона (`useOverlayLink`) от плагина не
 * зависит и при SSR отдаёт нейтраль.
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const { snapshot, lastMessageAt } = useLinkState()
  const { setBase } = useAffect()
  const { apply } = useReactions()

  const { data } = useWebSocket(config.public.wsUrl, { autoReconnect: true })

  let state: LinkState = { ...EMPTY_LINK_STATE }

  watch(data, (raw) => {
    if (typeof raw !== 'string')
      return

    const message = parseOverlayMessage(raw)
    if (!message)
      return

    const step = reduceOverlayMessage(state, message, Date.now())
    state = step.state
    snapshot.value = state.snapshot
    lastMessageAt.value = state.lastMessageAt

    for (const effect of step.effects) {
      if (effect.type === 'base')
        setBase(effect.affect)
      else
        apply(effect.event)
    }
  })
})
