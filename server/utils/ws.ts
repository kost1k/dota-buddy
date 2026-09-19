import type { Peer } from 'crossws'

const peers = new Set<Peer>()

export const wsService = {
  add: (peer: Peer) => peers.add(peer),
  remove: (peer: Peer) => peers.delete(peer),
  count: () => peers.size,
  broadcast: (message: unknown) => {
    const data = JSON.stringify(message)
    peers.forEach((peer) => {
      try {
        peer.send(data)
      }
      catch {
        peers.delete(peer)
      }
    })
  },
}
