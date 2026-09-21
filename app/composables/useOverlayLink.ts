import type { MatchSnapshot } from '#shared/snapshot'
// Импорты явные, а не на автоимпорт Nuxt: он объявляет `shared/` в типах,
// но в рантайме модуль не подтягивает — typecheck проходит, страница
// падает. Ошибка молчаливая, поэтому лучше писать явно.
import { isAwake } from '#shared/overlay-link'

/**
 * Ячейки связи. Пишет в них ТОЛЬКО плагин
 * (`app/plugins/overlay-link.client.ts`), читателям нужен `useOverlayLink`.
 *
 * Ключи собраны здесь, а не продублированы у писателя и у читателей: врозь
 * они расходятся молча — опечатка даёт не ошибку, а вторую ячейку.
 */
export function useLinkState() {
  return {
    snapshot: useState<MatchSnapshot | null>('link:snapshot', () => null),
    lastMessageAt: useState<number | null>('link:lastMessageAt', () => null),
    /** Часы живости. Тикают раз в секунду, тоже из плагина. */
    now: useState<number>('link:now', () => Date.now()),
  }
}

/**
 * Связь оверлея с сервером — сторона чтения.
 *
 * Сокет, разбор и применение живут в плагине, и это не деталь размещения:
 * каждый вызов этого композабла раньше поднимал СВОЙ сокет и свою подписку,
 * а `addOffset` с `addImpulse` складывают по построению — событие
 * применялось столько раз, сколько мест его читало. Замерено: два
 * подключения на оверлее, три на пульте (тикет 14).
 *
 * Поэтому здесь не осталось ни транспорта, ни гарда `import.meta.client`:
 * зови сколько угодно раз и откуда угодно, включая рендер на сервере.
 */
export function useOverlayLink() {
  const config = useRuntimeConfig()
  const idleTimeoutMs = Number(config.public.idleTimeoutMs) || 15_000

  const { snapshot, lastMessageAt, now } = useLinkState()
  const awake = computed(() => isAwake(lastMessageAt.value, now.value, idleTimeoutMs))

  return { snapshot, awake }
}
