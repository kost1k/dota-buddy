import { appendFile } from 'node:fs/promises'
import process from 'node:process'

/**
 * Запись сырых GSI-пакетов в файл.
 *
 * Единственный канал доставки реальных данных с игрового ПК на машину
 * разработки: синтетика проверяет логику, но не проверяет тайминги и
 * реальную каденцию, а они и определяют, как поведение читается.
 *
 * Пишется СЫРОЕ тело, до санитизации. Иначе запись отражала бы наши
 * представления о формате, а не то, что действительно присылает Dota, — и
 * ровно тот случай, когда мы ошиблись в поле, остался бы невидимым.
 *
 * Формат — JSON Lines: одна строка на пакет, дописывается в конец.
 * Устойчиво к обрыву: недописанная последняя строка не портит предыдущие.
 */

let target: string | null = null
let failed = false

/**
 * Очередь записи.
 *
 * Без неё параллельные дописывания завершаются в произвольном порядке, и
 * пакеты в файле перемешиваются — проверено пробой, две строки легли
 * задом наперёд. Запись с нарушенным порядком бесполезна: воспроизводить
 * её нельзя, а именно ради воспроизведения она и делается.
 */
let queue: Promise<void> = Promise.resolve()

export function startRecording(path: string) {
  target = path
  failed = false
  queue = Promise.resolve()
}

export function recordingTarget(): string | null {
  return target
}

/**
 * Дописывает пакет. Не ждёт завершения записи намеренно: `throttle` в GSI
 * отсчитывается от МОМЕНТА ОТВЕТА сервера, поэтому всё, что делается до
 * ответа, складывается с интервалом опроса.
 */
export function recordRawSnapshot(body: unknown): void {
  if (!target || failed)
    return

  const path = target
  const line = `${JSON.stringify({ at: Date.now(), body })}\n`

  queue = queue
    .then(() => appendFile(path, line, 'utf8'))
    .catch((cause) => {
      // Один раз сообщаем и замолкаем: писать в лог на каждый пакет при
      // недоступном файле значит залить консоль на весь стрим.
      failed = true
      console.error('[recorder] запись отключена:', cause instanceof Error ? cause.message : cause)
    })
}

/**
 * Инициализация из окружения. Пустое значение — запись выключена.
 *
 * Состояние сообщается в консоль намеренно и громко: без этого недоступный
 * путь выключал бы запись молча, и выяснилось бы это только по возвращении
 * с игрового ПК без файла — то есть когда переснять уже нельзя.
 */
export function initRecordingFromEnv(): void {
  const path = process.env.NUXT_GSI_RECORD?.trim()
  if (!path) {
    console.log('[recorder] запись выключена: NUXT_GSI_RECORD не задан')
    return
  }

  startRecording(path)
  console.log(`[recorder] пишу сырые пакеты в ${path}`)

  // Пробная запись сразу, а не на первом пакете: путь должен провериться
  // при старте, пока человек смотрит в консоль, а не через сорок минут.
  appendFile(path, '', 'utf8').catch((cause) => {
    failed = true
    console.error(`[recorder] ЗАПИСЬ НЕ РАБОТАЕТ (${path}):`, cause instanceof Error ? cause.message : cause)
    console.error('[recorder] проверь, что директория существует')
  })
}
