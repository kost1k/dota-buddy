/**
 * Контракт управления воспроизведением: сервер ↔ пульт.
 *
 * Лежит рядом с протоколом оверлея и по той же причине: обе стороны обязаны
 * понимать одни и те же поля, а разъехаться им проще всего именно на ручке,
 * которую правят редко.
 *
 * Темп отсчитывает сервер. В браузере он держался бы на `setTimeout`, а в
 * неактивной вкладке Chromium душит его до одного срабатывания в минуту —
 * пульт же почти всегда не в фокусе. Развалилось бы ровно то, ради чего
 * запись и делается: тайминги.
 */

export type ReplayMode = 'idle' | 'playing' | 'paused'

export interface ReplayStatus {
  /** Имя загруженной записи; `null`, если не загружено ничего. */
  file: string | null
  mode: ReplayMode
  /** Номер следующего пакета: сколько уже сыграно. */
  index: number
  total: number
  speed: number
}

/** Состояние плюс то, из чего можно выбрать. */
export interface ReplayState extends ReplayStatus {
  files: string[]
}

export interface ReplayCommand {
  action: 'load' | 'play' | 'pause' | 'seek' | 'speed' | 'stop'
  /** Только имя файла из листинга: путь клиент не задаёт никогда. */
  file?: string
  index?: number
  speed?: number
}

/** Скорости на пульте. Час матча на десятикратной — шесть минут. */
export const REPLAY_SPEEDS = [1, 2, 5, 10] as const
