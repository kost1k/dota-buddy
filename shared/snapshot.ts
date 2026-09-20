/**
 * Каноническая форма снапшота матча.
 *
 * Граница между внешним миром и нашим: Dota присылает `snake_case` и
 * опускает ключи, для которых у неё нет значения, — здесь это
 * превращается в предсказуемую структуру с нашими именами. Дальше по коду
 * внешних имён быть не должно.
 *
 * Набор полей выбран не «на всякий случай», а под конкретные нужды:
 *
 * - здоровье и его динамика — основа возбуждения (тревожит не «осталось
 *   40%», а «сняли 40% за две секунды»);
 * - станы и дебаффы — туда же: краткие, наблюдаемые, означают «сейчас
 *   решается»;
 * - счёт команд — медленная основа валентности и единственный
 *   кросс-командный сигнал В СНАПШОТЕ: чужих состояний обычный матч не
 *   отдаёт (события всей игры отдаёт, но это другой источник, см.
 *   `derive.ts`);
 * - аганим и шард — вехи;
 * - `matchId` и `gameState` — граница матча, по ней сбрасывается состояние.
 *
 * Медленных агрегатов вроде GPM в осях нет намеренно: на них сломался
 * `sweatLevel` в прототипе — они меняются незаметно и не совпадают по
 * времени ни с чем на экране.
 */

export type Team = 'radiant' | 'dire' | 'unknown'

export interface HeroSnapshot {
  alive: boolean
  level: number
  health: number
  maxHealth: number
  /** 0..1. Считается сами, а не берётся из `health_percent`: тот приходит не всегда. */
  healthFraction: number
  respawnSeconds: number
  buybackCost: number
  buybackCooldown: number
  stunned: boolean
  silenced: boolean
  hexed: boolean
  hasDebuff: boolean
  aghanimsScepter: boolean
  aghanimsShard: boolean
}

export interface PlayerSnapshot {
  team: Team
  kills: number
  deaths: number
  assists: number
  killStreak: number
  /** Только для справочной строки. В осях аффекта не участвует. */
  gpm: number
  xpm: number
}

export interface MapSnapshot {
  matchId: string
  gameState: string
  clockTime: number
  radiantScore: number
  direScore: number
}

export interface MatchSnapshot {
  hero: HeroSnapshot
  player: PlayerSnapshot
  map: MapSnapshot
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function team(value: unknown): Team {
  const name = str(value).toLowerCase()
  return name === 'radiant' || name === 'dire' ? name : 'unknown'
}

function readHero(raw: unknown): HeroSnapshot | null {
  if (!isObject(raw))
    return null
  // Минимум, без которого снапшот бессмыслен. Остальное опционально:
  // клиент Dota опускает ключи, для которых у него нет значения.
  if (typeof raw.alive !== 'boolean' || !Number.isFinite(raw.level as number))
    return null

  const health = num(raw.health)
  const maxHealth = num(raw.max_health)

  return {
    alive: raw.alive,
    level: num(raw.level),
    health,
    maxHealth,
    healthFraction: maxHealth > 0 ? Math.min(Math.max(health / maxHealth, 0), 1) : 0,
    respawnSeconds: num(raw.respawn_seconds),
    buybackCost: num(raw.buyback_cost),
    buybackCooldown: num(raw.buyback_cooldown),
    stunned: bool(raw.stunned),
    silenced: bool(raw.silenced),
    hexed: bool(raw.hexed),
    hasDebuff: bool(raw.has_debuff),
    aghanimsScepter: bool(raw.aghanims_scepter),
    aghanimsShard: bool(raw.aghanims_shard),
  }
}

function readPlayer(raw: unknown): PlayerSnapshot | null {
  if (!isObject(raw))
    return null
  if (!Number.isFinite(raw.kills as number))
    return null

  return {
    team: team(raw.team_name),
    kills: num(raw.kills),
    deaths: num(raw.deaths),
    assists: num(raw.assists),
    killStreak: num(raw.kill_streak),
    gpm: num(raw.gpm),
    xpm: num(raw.xpm),
  }
}

function readMap(raw: unknown): MapSnapshot {
  if (!isObject(raw))
    return { matchId: '', gameState: '', clockTime: 0, radiantScore: 0, direScore: 0 }

  return {
    // `matchid` приходит СТРОКОЙ, не числом — приводим к строке на всякий
    // случай, чтобы сравнение границы матча не сломалось о тип.
    matchId: typeof raw.matchid === 'number' ? String(raw.matchid) : str(raw.matchid),
    gameState: str(raw.game_state),
    clockTime: num(raw.clock_time),
    radiantScore: num(raw.radiant_score),
    direScore: num(raw.dire_score),
  }
}

/**
 * Разбор сырого тела `POST /api/gsi`.
 *
 * Возвращает `null`, если снапшот непригоден по любой причине — включая
 * пустое тело, которое Dota шлёт при окончании матча.
 */
export function readSnapshot(raw: unknown): MatchSnapshot | null {
  if (!isObject(raw))
    return null

  const hero = readHero(raw.hero)
  const player = readPlayer(raw.player)
  if (!hero || !player)
    return null

  return { hero, player, map: readMap(raw.map) }
}

/** Счёт своей команды минус счёт чужой. Ноль, если команда неизвестна. */
export function scoreLead({ player, map }: MatchSnapshot): number {
  if (player.team === 'radiant')
    return map.radiantScore - map.direScore
  if (player.team === 'dire')
    return map.direScore - map.radiantScore
  return 0
}
