import type { MatchSnapshot } from '#shared/snapshot'
import type { Scenario } from '#shared/synthetic'
import { baselineSnapshot, buildRawSnapshot } from '#shared/synthetic'

/**
 * Нижний уровень пульта: отправка синтетических снапшотов в `POST /api/gsi`.
 *
 * Пакеты идут тем же путём, что и настоящая игра, поэтому проверяется вся
 * цепочка: санитизация, вывод событий на сервере, WebSocket, отрисовка. Это
 * единственный способ проверить серверную часть на машине разработки — ни
 * Доты, ни OBS здесь нет.
 *
 * Верхний уровень пульта (оси напрямую) остаётся: он быстрее для итераций
 * по визуалу, где проходить через сервер незачем.
 */
export function useSnapshotSender() {
  const snapshot = useState<MatchSnapshot>('sender:snapshot', () => baselineSnapshot())
  const running = useState<string | null>('sender:running', () => null)
  const sent = useState<number>('sender:sent', () => 0)
  const error = useState<string | null>('sender:error', () => null)

  async function push(next: MatchSnapshot) {
    snapshot.value = next
    try {
      await $fetch('/api/gsi', { method: 'POST', body: buildRawSnapshot(next) })
      sent.value += 1
      error.value = null
    }
    catch (cause) {
      // Чаще всего это несовпадение секрета: при заданном NUXT_GSI_SECRET
      // сервер отвечает 401, и снаружи это выглядит как «пульт не работает».
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }

  /** Прогоняет сценарий, выдерживая его паузы. Реальная каденция ~1 Гц. */
  async function run(scenario: Scenario) {
    if (running.value)
      return

    running.value = scenario.id
    try {
      let current = snapshot.value
      for (const step of scenario.steps) {
        if (step.delay > 0)
          await new Promise(resolve => setTimeout(resolve, step.delay))
        current = step.patch(current)
        await push(current)
      }
    }
    finally {
      running.value = null
    }
  }

  function reset() {
    snapshot.value = baselineSnapshot()
    sent.value = 0
    error.value = null
  }

  return { snapshot, running, sent, error, push, run, reset }
}
