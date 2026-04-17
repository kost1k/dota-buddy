export default defineWebSocketHandler({
  open(peer) {
    console.log('New client connected:', peer.id)
    peer.subscribe('dota-events')
  },

  message(peer, message) {
    const text = message.text()
    console.log(`Message from ${peer.id}: ${text}`)

    peer.publish('dota-events', {
      sender: peer.id,
      msg: text,
      timestamp: Date.now(),
    })
  },

  close(peer) {
    console.log('Client disconnected:', peer.id)
  },

  error(peer, error) {
    console.error('WebSocket error:', error)
  },
})
