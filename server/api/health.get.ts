export default defineEventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event)

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    wsPeers: wsService.count(),
    logLevel: runtimeConfig.logLevel || 'info',
  }
})
