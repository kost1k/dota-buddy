/**
 * Цвет тела бадди. Чистый модуль: ни Vue, ни Nuxt, ни three.
 *
 * Распределение каналов основано на замере, а не на интуиции.
 * Wilms & Oberfeld (2018) выровняли три тона по светлоте И по яркости:
 * тон объяснил ηp² = .588 ВОЗБУЖДЕНИЯ и лишь .094 валентности (p = .051,
 * знак переворачивается на разных насыщенностях). Светлота же — сильнейший
 * носитель валентности во всех исследованиях цвета.
 *
 * Поэтому:
 *   валентность -> светлота
 *   возбуждение -> теплота тона
 *
 * Первая редакция делала наоборот (валентность тоном при фиксированной
 * светлоте) и тем самым впрыскивала перевёрнутый дубль сигнала возбуждения
 * в канал, обязанный быть ортогональным, — ровно тот провал, который
 * ADR-0001 называет своим главным риском.
 *
 * Красный для негативной валентности и ось красный↔зелёный не используются:
 * прямая рекомендация разведки.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Яркость по Rec.709, на гамма-кодированных значениях 0..255. */
export function luma({ r, g, b }: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Коридор светлоты тела, выведенный из яркости самой игры.
 *
 * Замер кадра Dota под якорем оверлея: медиана яркости фона 37, p95 по
 * всему кадру 98. При отношении контраста 3:1 (порог для нетекстовой
 * графики) против медианного фона нужно >= 117, против ярких 5% >= 182.
 *
 * Коридор 120..190 даёт >= 3:1 почти везде и оставляет 70 уровней под
 * валентность — с запасом, порог различения крупных пятен 1-2 уровня.
 *
 * Нижняя граница — не эстетика, а видимость: предыдущая редакция уводила
 * тело в яркость 85, и на тёмной карте бадди пропадал.
 */
export const BODY_LUMA = { min: 120, max: 190 } as const

/** Направления тона. Насыщенные — светлота подгоняется отдельно. */
const COOL: Rgb = { r: 74, g: 150, b: 224 }
const WARM: Rgb = { r: 224, g: 142, b: 66 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

/**
 * Подгоняет цвет под заданную яркость, подмешивая белый или чёрный.
 *
 * Именно подмешивание, а не умножение: умножение уводит насыщенные тона за
 * 255 по одному каналу и незаметно смещает тон. Подмешивание меняет
 * насыщенность, но сохраняет направление тона, а насыщенность у нас ничего
 * не несёт.
 */
function toLuma(color: Rgb, target: number): Rgb {
  const current = luma(color)
  if (Math.abs(current - target) < 0.01)
    return color

  if (current < target) {
    const white: Rgb = { r: 255, g: 255, b: 255 }
    // luma(mix(c, white, t)) = current + t * (255 - current)
    return mix(color, white, clamp((target - current) / (255 - current), 0, 1))
  }

  const black: Rgb = { r: 0, g: 0, b: 0 }
  return mix(color, black, clamp(1 - target / current, 0, 1))
}

/**
 * @param valence −1..1 — ведёт светлоту
 * @param arousal 0..1 — ведёт теплоту тона
 */
export function bodyColor(valence: number, arousal: number): Rgb {
  const v = Number.isFinite(valence) ? clamp(valence, -1, 1) : 0
  const a = Number.isFinite(arousal) ? clamp(arousal, 0, 1) : 0

  const target = BODY_LUMA.min + ((v + 1) / 2) * (BODY_LUMA.max - BODY_LUMA.min)
  const hue = mix(COOL, WARM, a)
  const fitted = toLuma(hue, target)

  return {
    r: clamp(Math.round(fitted.r), 0, 255),
    g: clamp(Math.round(fitted.g), 0, 255),
    b: clamp(Math.round(fitted.b), 0, 255),
  }
}

/**
 * Угол тона в градусах, 0..360. Неопределён для ахроматичных цветов —
 * там возвращает 0.
 *
 * Именно угол, а не разность каналов, является мерой постоянства тона:
 * подмешивание белого или чёрного неизбежно сжимает абсолютную разность
 * `r − b`, но направление тона не трогает.
 */
export function hueAngle({ r, g, b }: Rgb): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const chroma = max - min
  if (chroma < 1e-6)
    return 0

  let h: number
  if (max === r)
    h = ((g - b) / chroma) % 6
  else if (max === g)
    h = (b - r) / chroma + 2
  else
    h = (r - g) / chroma + 4

  return ((h * 60) % 360 + 360) % 360
}

/** Удобство для three.js и CSS. */
export function toHex({ r, g, b }: Rgb): string {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}
