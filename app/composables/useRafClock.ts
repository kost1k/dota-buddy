/**
 * Секунды с монтирования, тикающие по кадрам.
 *
 * Нужны визуалам, которые не живут внутри цикла three и потому не получают
 * `elapsed` даром — сейчас это плоский SVG-вариант.
 */
export function useRafClock() {
  const seconds = ref(0)

  if (import.meta.client) {
    const started = performance.now()
    useRafFn(() => {
      seconds.value = (performance.now() - started) / 1000
    })
  }

  return seconds
}
