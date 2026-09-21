/**
 * Интегратор аффекта: чистое ядро, без Vue и без Nuxt.
 *
 * Состояние бадди — точка на плоскости валентность × возбуждение (ADR-0001).
 * Этот модуль отвечает на один вопрос: как состояние движется к цели во
 * времени. Откуда берётся цель — не его дело.
 */

export interface AffectState {
  /** Хорошо ↔ плохо, −1..1. Медленная ось. */
  valence: number
  /** Спокойно ↔ интенсивно, 0..1. Быстрая ось. */
  arousal: number
}

export interface AffectTuning {
  /** Время выхода валентности на ~63% шага, секунды. */
  valenceTau: number
  /** Время выхода возбуждения на ~63% шага, секунды. */
  arousalTau: number
}

export const AFFECT_RANGE = {
  valence: [-1, 1],
  arousal: [0, 1],
} as const

/**
 * Зажим точки аффекта в допустимые диапазоны.
 *
 * Нужен там, где состояние складывается с импульсом: сумма легко выходит
 * за границы — замер дал валентность −1.19 после трёх смертей подряд. Для
 * цвета это безобидно, палитра зажимает сама, но геометрия считает от
 * нормированной величины, и выход за диапазон ломает её пороги. У кольца,
 * например, рябь перестаёт умещаться и затягивает отверстие.
 */
export function clampAffect(state: AffectState): AffectState {
  return {
    valence: Math.min(Math.max(state.valence, AFFECT_RANGE.valence[0]), AFFECT_RANGE.valence[1]),
    arousal: Math.min(Math.max(state.arousal, AFFECT_RANGE.arousal[0]), AFFECT_RANGE.arousal[1]),
  }
}

export const NEUTRAL_AFFECT: AffectState = { valence: 0, arousal: 0 }

/**
 * Сложение двух точек аффекта с зажимом.
 *
 * Операция одна, мест два, и оба — про «медленное плюс быстрое»: цель
 * складывается из объективной основы и следа события, отображаемое —
 * из состояния и импульса. Зажим обязателен: сумма выходит за диапазон
 * по построению, каждое слагаемое уже может стоять на краю.
 */
export function addAffect(a: AffectState, b: AffectState): AffectState {
  return clampAffect({ valence: a.valence + b.valence, arousal: a.arousal + b.arousal })
}

/**
 * Координаты точки на плоскости аффекта в долях `0..1` от диапазона осей.
 *
 * Отдаёт числа, а не проценты: проценты — вёрстка, и собирать их должен
 * шаблон. Нужна пульту для графика, пригодится периферии.
 */
export function normalizeAffect(point: AffectState): AffectState {
  const [vMin, vMax] = AFFECT_RANGE.valence
  const [aMin, aMax] = AFFECT_RANGE.arousal
  return {
    valence: (point.valence - vMin) / (vMax - vMin),
    arousal: (point.arousal - aMin) / (aMax - aMin),
  }
}

/**
 * Стартовые значения. Подлежат калибровке на пульте — числа здесь
 * ориентировочные, важно лишь соотношение: возбуждение сильно быстрее.
 */
export const DEFAULT_AFFECT_TUNING: AffectTuning = {
  valenceTau: 12,
  arousalTau: 1.2,
}

/**
 * Именованные настроения — это ОБЛАСТИ на плоскости, а не состояния в коде
 * (ADR-0001). Здесь они существуют только как опорные точки: для пульта, для
 * разговора и для проверки читаемости в тикете 05.
 *
 * Ничто в рантайме не должно ветвиться по имени пресета. Как только
 * появится `if (mood === 'panic')`, модель свалится обратно в дискретные
 * состояния, от которых мы ушли.
 */
export const AFFECT_PRESETS = {
  /** Линия идёт ровно, ничего не происходит. */
  calmFarm: { valence: 0.35, arousal: 0.12 },
  /** Килстрик, всё получается. */
  onFire: { valence: 0.9, arousal: 0.85 },
  /** Догоняют на низком здоровье. */
  panic: { valence: -0.85, arousal: 0.95 },
  /** Отстаём, отыгрываться нечем. */
  defeated: { valence: -0.7, arousal: 0.1 },
} as const satisfies Record<string, AffectState>

/** Подписи пресетов. Рядом с данными, как у каталога событий и ярусов. */
export const AFFECT_PRESET_LABELS: Record<keyof typeof AFFECT_PRESETS, string> = {
  calmFarm: 'Спокойный фарм',
  onFire: 'Кураж',
  panic: 'Паника',
  defeated: 'Подавленность',
}

/**
 * Потолок одного шага. Если вкладку приморозили (OBS переключил сцену,
 * машина ушла в своп), delta придёт огромной — без потолка бадди скачком
 * окажется в цели. Потолок превращает скачок в обычное доведение.
 */
export const MAX_STEP_SECONDS = 0.25

function clamp(value: number, [min, max]: readonly [number, number]): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Экспоненциальное сглаживание, устойчивое к частоте кадров.
 *
 * Важно, что множитель считается как `exp(-dt / tau)`, а не берётся
 * постоянным на кадр: только так два шага по dt/2 дают ровно то же, что один
 * шаг по dt. В browser source такт задаёт OBS, и он плавает.
 */
function approach(current: number, target: number, tau: number, deltaSeconds: number): number {
  return target + (current - target) * Math.exp(-deltaSeconds / tau)
}

/**
 * Один шаг интегрирования. Возвращает новое состояние, не мутируя входное.
 *
 * Цель клампится до допустимого диапазона до интегрирования, поэтому
 * состояние не может выйти за диапазон, даже если цель пришла испорченной.
 */
export function stepAffect(
  state: AffectState,
  target: AffectState,
  deltaSeconds: number,
  tuning: AffectTuning = DEFAULT_AFFECT_TUNING,
): AffectState {
  const current: AffectState = {
    valence: clamp(state.valence, AFFECT_RANGE.valence),
    arousal: clamp(state.arousal, AFFECT_RANGE.arousal),
  }

  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0)
    return current

  const dt = Math.min(deltaSeconds, MAX_STEP_SECONDS)

  return {
    valence: approach(
      current.valence,
      clamp(target.valence, AFFECT_RANGE.valence),
      tuning.valenceTau,
      dt,
    ),
    arousal: approach(
      current.arousal,
      clamp(target.arousal, AFFECT_RANGE.arousal),
      tuning.arousalTau,
      dt,
    ),
  }
}
