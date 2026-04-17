export function broadcast(topic: string, message: any) {
  // @ts-expect-error Nitro types are not fully compatible with Nuxt 4
  const ws = import.meta.nitro.ws
  if (ws) {
    ws.publish(topic, JSON.stringify(message))
  }
}
