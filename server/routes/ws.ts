import { createLogger } from '../utils/logger'

export default defineWebSocketHandler({
  open(peer) {
    const runtimeConfig = useRuntimeConfig()
    const logger = createLogger(runtimeConfig.logLevel)
    wsService.add(peer)
    logger.info('[ws] client connected', { peerId: peer.id, totalPeers: wsService.count() })

    // Клиент, открывшийся посреди матча, иначе не знал бы ни уровня, ни
    // вех, ни счёта — а browser source в OBS перезагружается регулярно.
    //
    // Через `wsService`, а не прямым `peer.send`: только что подключившийся
    // сокет — худший момент для отправки в обход защиты от обрыва.
    wsService.send(peer, { type: 'sync', snapshot: matchState.snapshot() })
  },

  close(peer) {
    const runtimeConfig = useRuntimeConfig()
    const logger = createLogger(runtimeConfig.logLevel)
    wsService.remove(peer)
    logger.info('[ws] client disconnected', { peerId: peer.id, totalPeers: wsService.count() })
  },

  error(peer, error) {
    const runtimeConfig = useRuntimeConfig()
    const logger = createLogger(runtimeConfig.logLevel)
    wsService.remove(peer)
    logger.error('[ws] connection error', { peerId: peer.id, totalPeers: wsService.count(), error })
  },
})
