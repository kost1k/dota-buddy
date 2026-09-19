/**
 * Единственный источник времени для аффекта.
 *
 * Раньше тик жил внутри существа, и это связывало модель состояния с
 * конкретной формой: у плоского визуала нет цикла рендера three, а значит
 * не было бы и тика. Теперь визуалы — чистые отрисовщики контракта, а
 * время идёт здесь.
 *
 * Большой `delta` после паузы (OBS увёл сцену, вкладка была скрыта)
 * зажимается в `stepAffect` — иначе бадди скачком оказался бы в цели.
 */
export function useAffectTicker() {
  const { tick } = useAffect()

  if (import.meta.client) {
    let previous = performance.now()
    useRafFn(() => {
      const now = performance.now()
      tick((now - previous) / 1000)
      previous = now
    })
  }
}
