import { createLogger } from '../utils/logger'

export default defineWebSocketHandler({
  open(peer) {
    const runtimeConfig = useRuntimeConfig()
    const logger = createLogger(runtimeConfig.logLevel)
    wsService.add(peer)
    logger.info('[ws] client connected', { peerId: peer.id, totalPeers: wsService.count() })
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
