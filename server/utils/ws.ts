import type { Peer } from 'crossws'

const peers = new Set<Peer>()

/**
 * Рассылка состояния и событий подключённым оверлеям.
 *
 * Отправка обёрнута И в try/catch, И в обработку отклонённого промиса.
 * Одного мало: при оборванном сокете `peer.send` не бросает, а возвращает
 * промис, который отклоняется — и это валит процесс необработанным отказом.
 *
 * В эфире это не мелочь: OBS перезагружает browser source при каждой смене
 * сцены, то есть сокеты рвутся штатно и постоянно.
 */
export const wsService = {
  add: (peer: Peer) => peers.add(peer),
  remove: (peer: Peer) => peers.delete(peer),
  count: () => peers.size,
  broadcast: (message: unknown) => {
    const data = JSON.stringify(message)
    peers.forEach((peer) => {
      try {
        const result = peer.send(data) as unknown
        if (result instanceof Promise)
          result.catch(() => peers.delete(peer))
      }
      catch {
        peers.delete(peer)
      }
    })
  },
}
