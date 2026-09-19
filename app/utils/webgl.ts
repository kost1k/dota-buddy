/**
 * Доступен ли WebGL.
 *
 * Проверка обязательна, а не защитная: OBS 31/32 несут Chromium 127, где
 * неудачный GPU-путь тихо падал на программный рендер, но OBS 33 несёт
 * Chromium 150, где программный фолбэк убран — там `getContext` вернёт
 * `null`, и оверлей без этой проверки просто не запустится.
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
