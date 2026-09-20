/**
 * Доступен ли WebGL.
 *
 * Проверка обязательна, а не защитная: OBS 31/32 несут Chromium 127, где
 * неудачный GPU-путь тихо падает на программный рендер. В Chromium 150
 * программный фолбэк убран — там `getContext` вернёт `null`, и оверлей без
 * этой проверки просто не запустится. Версия с Chromium 150 пока лежит
 * только в master OBS и не выпущена, но проверка стоит один вызов, а
 * отсутствие проверки стоит неработающего оверлея в день выхода.
 */
export function isWebglAvailable(): boolean {
  if (typeof document === 'undefined')
    return false

  try {
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl')

    if (gl === null)
      return false

    // Пробный контекст больше не нужен: освобождаем сразу, чтобы не занимать
    // один из немногих доступных браузеру слотов.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  }
  catch {
    return false
  }
}
