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
  const adopted = useState<boolean>('sender:adopted', () => false)

  /**
   * После перезагрузки страницы пульт подхватывает состояние с сервера, а
   * не начинает с нуля.
   *
   * Иначе счётчики матча откатываются назад, сервер справедливо считает это
   * новым матчем и сбрасывает свежесть — то есть перезагрузка пульта
   * незаметно обнуляла бы ровно то, что мы и хотим на ней проверить.
   */
  if (import.meta.client) {
    const { snapshot: received } = useOverlayLink()
    watch(received, (value) => {
      if (!value || adopted.value || sent.value > 0)
        return
      snapshot.value = value
      adopted.value = true
    }, { immediate: true })
  }

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

  /** Полный сброс: новый матч. Сервер поймёт это по откату счётчиков. */
  function reset() {
    snapshot.value = baselineSnapshot()
    sent.value = 0
    error.value = null
    adopted.value = true
  }

  return { snapshot, running, sent, error, push, run, reset }
}
