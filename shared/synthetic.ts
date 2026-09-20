/**
 * Сборка синтетических GSI-пакетов.
 *
 * Обратная сторона `readSnapshot`: тот переводит формат Dota в наш, этот —
 * наш в формат Dota. Пакеты уходят в `POST /api/gsi` тем же путём, что и
 * настоящая игра, поэтому проверяется вся цепочка целиком: санитизация,
 * вывод событий, WebSocket, отрисовка.
 *
 * Это единственный способ проверить серверный вывод событий на машине
 * разработки: ни Доты, ни OBS здесь нет.
 *
 * Формат намеренно совпадает с форматом записи сессии — пульт и
 * воспроизведение должны быть одним механизмом с двумя источниками, а не
 * двумя подсистемами.
 */

import type { MatchSnapshot } from './snapshot'

/** Сырой пакет в том виде, в каком его шлёт Dota: `snake_case`, плоско. */
export type RawSnapshot = Record<string, unknown>

export function buildRawSnapshot(snapshot: MatchSnapshot): RawSnapshot {
  const { hero, player, map } = snapshot

  return {
    provider: { name: 'Dota 2', appid: 570, version: 47, timestamp: Math.floor(Date.now() / 1000) },
    hero: {
      alive: hero.alive,
      level: hero.level,
      health: hero.health,
      max_health: hero.maxHealth,
      health_percent: hero.maxHealth > 0 ? Math.round(hero.healthFraction * 100) : 0,
      respawn_seconds: hero.respawnSeconds,
      buyback_cost: hero.buybackCost,
      buyback_cooldown: hero.buybackCooldown,
      stunned: hero.stunned,
      silenced: hero.silenced,
      hexed: hero.hexed,
      has_debuff: hero.hasDebuff,
      aghanims_scepter: hero.aghanimsScepter,
      aghanims_shard: hero.aghanimsShard,
    },
    player: {
      team_name: player.team,
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      kill_streak: player.killStreak,
      gpm: player.gpm,
      xpm: player.xpm,
    },
    map: {
      matchid: map.matchId,
      game_state: map.gameState,
      clock_time: map.clockTime,
      radiant_score: map.radiantScore,
      dire_score: map.direScore,
    },
  }
}

/** Снапшот «ничего не происходит»: отправная точка для сценариев. */
export function baselineSnapshot(): MatchSnapshot {
  return {
    hero: {
      alive: true,
      level: 1,
      health: 600,
      maxHealth: 600,
      healthFraction: 1,
      respawnSeconds: 0,
      buybackCost: 0,
      buybackCooldown: 0,
      stunned: false,
      silenced: false,
      hexed: false,
      hasDebuff: false,
      aghanimsScepter: false,
      aghanimsShard: false,
    },
    player: {
      team: 'radiant',
      kills: 0,
      deaths: 0,
      assists: 0,
      killStreak: 0,
      gpm: 0,
      xpm: 0,
    },
    map: {
      matchId: 'synthetic',
      gameState: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
      clockTime: 0,
      radiantScore: 0,
      direScore: 0,
    },
  }
}

export interface SnapshotStep {
  /** Пауза перед отправкой, мс. */
  delay: number
  /** Что изменить относительно предыдущего снапшота. */
  patch: (previous: MatchSnapshot) => MatchSnapshot
}

/**
 * Сценарий — последовательность снапшотов с паузами, а не один пакет.
 * Настоящая игра шлёт поток, и вывод событий диффом проверяется только на
 * потоке: одиночный пакет не с чем сравнивать.
 */
export interface Scenario {
  id: string
  label: string
  steps: SnapshotStep[]
}

function patchHero(patch: Partial<MatchSnapshot['hero']>) {
  return (previous: MatchSnapshot): MatchSnapshot => {
    const hero = { ...previous.hero, ...patch }
    if (patch.health !== undefined || patch.maxHealth !== undefined) {
      hero.healthFraction = hero.maxHealth > 0
        ? Math.min(Math.max(hero.health / hero.maxHealth, 0), 1)
        : 0
    }
    return { ...previous, hero }
  }
}

function patchPlayer(patch: Partial<MatchSnapshot['player']>) {
  return (previous: MatchSnapshot): MatchSnapshot => ({
    ...previous,
    player: { ...previous.player, ...patch },
  })
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'damage',
    label: 'Получает урон',
    steps: [
      { delay: 0, patch: patchHero({ health: 1400, maxHealth: 1800 }) },
      { delay: 900, patch: patchHero({ health: 900 }) },
      { delay: 900, patch: patchHero({ health: 380 }) },
      { delay: 900, patch: patchHero({ health: 240 }) },
      { delay: 2500, patch: patchHero({ health: 700 }) },
    ],
  },
  {
    id: 'death',
    label: 'Смерть и респавн',
    steps: [
      { delay: 0, patch: patchHero({ health: 500, maxHealth: 1800 }) },
      { delay: 900, patch: patchHero({ health: 120 }) },
      {
        delay: 900,
        patch: previous => patchPlayer({ deaths: previous.player.deaths + 1, killStreak: 0 })(
          patchHero({ alive: false, health: 0, respawnSeconds: 12 })(previous),
        ),
      },
      { delay: 1000, patch: patchHero({ respawnSeconds: 8 }) },
      { delay: 1000, patch: patchHero({ respawnSeconds: 4 }) },
      { delay: 1000, patch: patchHero({ alive: true, health: 1800, respawnSeconds: 0 }) },
    ],
  },
  {
    id: 'streak',
    label: 'Килстрик',
    steps: [
      { delay: 0, patch: previous => patchPlayer({ kills: previous.player.kills + 1, killStreak: 1 })(previous) },
      { delay: 1200, patch: previous => patchPlayer({ kills: previous.player.kills + 1, killStreak: 2 })(previous) },
      { delay: 1200, patch: previous => patchPlayer({ kills: previous.player.kills + 1, killStreak: 3 })(previous) },
    ],
  },
  {
    id: 'stun',
    label: 'Стан',
    steps: [
      { delay: 0, patch: patchHero({ stunned: true, hasDebuff: true }) },
      { delay: 1800, patch: patchHero({ stunned: false, hasDebuff: false }) },
    ],
  },
  {
    id: 'aghanims',
    label: 'Собрал аганим',
    steps: [{ delay: 0, patch: patchHero({ aghanimsScepter: true }) }],
  },
  {
    id: 'shard',
    label: 'Собрал шард',
    steps: [{ delay: 0, patch: patchHero({ aghanimsShard: true }) }],
  },
  {
    id: 'levelUp',
    label: 'Новый уровень',
    steps: [{ delay: 0, patch: previous => patchHero({ level: previous.hero.level + 1 })(previous) }],
  },
]
