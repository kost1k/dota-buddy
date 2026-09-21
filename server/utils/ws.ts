import type { Peer } from 'crossws'
import type { OverlayMessage } from '#shared/overlay-message'

const peers = new Set<Peer>()

/**
 * Одна отправка одному пиру.
 *
 * Обёрнута И в try/catch, И в обработку отклонённого промиса. Одного мало:
 * при оборванном сокете `peer.send` не бросает, а возвращает промис,
 * который отклоняется, — и это валит процесс необработанным отказом.
 *
 * В эфире это не мелочь: OBS перезагружает browser source при каждой смене
 * сцены, то есть сокеты рвутся штатно и постоянно.
 *
 * Отвалившийся пир выбрасывается из набора здесь же: другого признака
 * смерти сокета у нас нет, а `close` при обрыве приходит не всегда.
 */
function push(peer: Peer, data: string) {
  try {
    const result = peer.send(data) as unknown
    if (result instanceof Promise)
      result.catch(() => peers.delete(peer))
  }
  catch {
    peers.delete(peer)
  }
}

/**
 * Рассылка состояния и событий подключённым оверлеям.
 *
 * Сообщение типизировано `OverlayMessage` — тем же типом, которым клиент
 * его разбирает. Иначе шов держится с одной стороны: переименованное поле
 * скомпилируется, уйдёт в сокет и будет молча отброшено разбором, а оверлей
 * просто перестанет получать этот вид сообщений.
 */
export const wsService = {
  add: (peer: Peer) => peers.add(peer),
  remove: (peer: Peer) => peers.delete(peer),
  count: () => peers.size,

  /** Одному пиру. Нужна для `sync`: он адресный, а не широковещательный. */
  send: (peer: Peer, message: OverlayMessage) => {
    push(peer, JSON.stringify(message))
  },

  broadcast: (message: OverlayMessage) => {
    const data = JSON.stringify(message)
    peers.forEach(peer => push(peer, data))
  },
}
