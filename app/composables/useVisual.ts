import type { VisualId } from '#shared/visual'
import { DEFAULT_VISUAL, isVisualId } from '#shared/visual'

/**
 * Выбранный визуал.
 *
 * Источник — query-параметр `?visual=`, чтобы OBS открывал нужный без UI,
 * и пульт, чтобы сравнивать их вживую. Переключение постоянное, а не
 * временное сравнение: два-три человека в комнате — слабый инструмент,
 * решать должна аудитория за несколько стримов.
 */
export function useVisual() {
  const route = useRoute()
  const visualId = useState<VisualId>('visual:id', () => {
    const fromQuery = route.query.visual
    return isVisualId(fromQuery) ? fromQuery : DEFAULT_VISUAL
  })

  function setVisual(id: VisualId) {
    visualId.value = id
  }

  return { visualId, setVisual }
}
