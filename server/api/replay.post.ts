import type { ReplayCommand } from '#shared/replay'
import { createLogger } from '../utils/logger'
import { readRecording, replayPlayer, resolveRecording } from '../utils/replay'

/**
 * Управление воспроизведением с пульта.
 *
 * Темп отсчитывает сервер, а не браузер: таймеры в неактивной вкладке
 * Chromium душатся до одного срабатывания в минуту, а пульт почти всегда не
 * в фокусе — воспроизведение разваливалось бы ровно там, где проверяются
 * тайминги.
 *
 * Секретом ручка НЕ закрыта, и это осознанно: пульт и сейчас не шлёт секрет
 * в `POST /api/gsi`. Заводить здесь второй механизм авторизации значило бы
 * чинить эту дыру молча и наполовину. Закрывать — вместе, при переходе на
 * сетевую топологию.
 */

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const logger = createLogger(runtimeConfig.logLevel)
  const command = await readBody<ReplayCommand>(event)

  switch (command?.action) {
    case 'load': {
      const path = command.file ? resolveRecording(runtimeConfig.recordingsDir, command.file) : null
      if (!path) {
        setResponseStatus(event, 400, 'Unknown recording')
        return { status: 'error', code: 'unknown_recording' }
      }

      const packets = await readRecording(path)
      replayPlayer.load(command.file!, packets)
      logger.info('[replay] загружена запись', { file: command.file, packets: packets.length })
      break
    }

    case 'play':
      replayPlayer.play()
      break

    case 'pause':
      replayPlayer.pause()
      break

    case 'seek':
      replayPlayer.seek(Number(command.index) || 0)
      break

    case 'speed':
      replayPlayer.setSpeed(Number(command.speed) || 1)
      break

    case 'stop':
      replayPlayer.stop()
      break

    default:
      setResponseStatus(event, 400, 'Unknown replay action')
      return { status: 'error', code: 'unknown_action' }
  }

  return { status: 'ok', ...replayPlayer.status() }
})
