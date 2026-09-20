import { listRecordings, replayPlayer } from '../utils/replay'

/**
 * Состояние воспроизведения и список доступных записей.
 *
 * Пульт опрашивает эту ручку раз в секунду. Отдельный канал ему не нужен:
 * сами пакеты и так доезжают до оверлея по WebSocket, а здесь только
 * положение ползунка.
 */
export default defineEventHandler(async () => {
  const runtimeConfig = useRuntimeConfig()

  return {
    ...replayPlayer.status(),
    files: await listRecordings(runtimeConfig.recordingsDir),
  }
})
