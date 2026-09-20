# Dota 2 Game State Integration — data surface

Researched 2026-09-19. Scope: what a local Nitro `POST /api/gsi` endpoint can actually receive.

## Source trust tiers

| Tier | Sources used |
| --- | --- |
| **A⁺ — own capture** | `recordings/session.jsonl`, one full normal matchmaking game captured 2026-09-20: 2137 packets, 37.7 minutes, ranked-style lobby, own hero. Strongest evidence available for player mode, because it is *this* project's endpoint receiving *this* game. Claims resting on it are marked `[measured]`. |
| **A — Valve** | Valve Developer Community GSI page (CS:GO/CS2 page is the only Valve-authored prose describing `uri`/`timeout`/`buffer`/`throttle`/`heartbeat`; Dota 2 reuses the same engine mechanism). No Valve page documents the Dota 2 `data` block list. |
| **B — captured payloads** | `MrBean355/dota2-gsi` test fixtures are real captured client payloads, split into `*_playing.json` (normal match) and `*_spectating.json`. These are the strongest evidence for player-vs-spectator differences. |
| **C — library schemas** | `antonpup/Dota2GSI` (C#) parser source — field names it reads. Reflects the union of observed payloads, not a guarantee every field appears. |
| **D — community claims** | READMEs, blog posts, GitHub issues. Flagged inline as `[community]`. |

Valve publishes **no** official Dota 2 GSI schema. Everything below that is not tier A is reverse-engineered. Treat field presence as optional at runtime — the client omits keys it has no value for, and the `*_incomplete.json` fixtures exist precisely because of that.

---

## 1. Complete top-level block list, and player vs spectator availability

### The `data` block (all 16 keys)

From `antonpup/Dota2GSI` README (tier C) — the most complete published cfg:

```
"Dota Buddy Integration"
{
    "uri"          "http://localhost:3000/api/gsi"
    "timeout"      "5.0"
    "buffer"       "0.1"
    "throttle"     "0.1"
    "heartbeat"    "10.0"
    "data"
    {
        "auth"            "1"
        "provider"        "1"
        "map"             "1"
        "player"          "1"
        "hero"            "1"
        "abilities"       "1"
        "items"           "1"
        "events"          "1"
        "buildings"       "1"
        "league"          "1"
        "draft"           "1"
        "wearables"       "1"
        "minimap"         "1"
        "roshan"          "1"
        "couriers"        "1"
        "neutralitems"    "1"
    }
    "auth" { "token" "..." }
}
```

`Dota2GSI/GameState.cs` reads exactly these 16 top-level JSON keys plus **`previously`** and (per `xzion/dota2-gsi`) **`added`** — delta sub-objects mirroring the full tree, marking what changed / first appeared in this POST. Older cfgs (e.g. `xzion/dota2-gsi`, 2017) only list 9 blocks; `events`, `league`, `minimap`, `roshan`, `couriers`, `neutralitems` were added later.

### Availability matrix

| Block | Playing your own match | Spectator / observer | Evidence |
| --- | --- | --- | --- |
| `auth` | yes (echo of your cfg token) | yes | cfg |
| `provider` | yes | yes | `provider.json` |
| `map` | yes, **reduced field set** | yes, full | `map_playing.json` vs `map_spectating.json` |
| `player` | yes, **local player only**, reduced fields | yes, `team2`/`team3` → `player0..player4`, full fields | `player_playing.json` vs `player_spectating.json` |
| `hero` | yes, **your hero only** | yes, `team2`/`team3` → `player0..4` | `hero_playing.json` vs `hero_spectating.json` |
| `abilities` | yes, **your abilities only** (`ability0..N`) | yes, nested by team/player | `abilities_*.json` |
| `items` | yes, **your items only** | yes, nested by team/player | `items_*.json` |
| `buildings` | yes but **only your own team's** key (fixture has `radiant` only) | yes, both `radiant` and `dire` | `buildings_playing.json` vs `buildings_spectating.json` |
| `draft` | **not observed** in a normal match | yes (`activeteam`, `team2`/`team3` picks+bans) | only `draft_spectator.json` exists |
| `wearables` | yes, your own cosmetics | yes, all players | `wearables_*.json` |
| `events` | **yes** `[measured]` — present in all 2137 packets, and it carries cross-team events | yes | own capture 2026-09-20 |
| `league` | no (only meaningful in league/ticketed games) | yes | `League.cs` |
| `minimap` | `[community]` almost certainly spectator-only — it enumerates every visible unit | yes | `Minimap.cs` |
| `roshan` | **no** — `map_playing.json` lacks even `roshan_state` | yes | fixtures |
| `couriers` | `[community]` unverified; likely own-team only | yes | `Couriers.cs` |
| `neutralitems` | `[community]` unverified | yes | `NeutralItems.cs` |

**Verified rule of thumb:** as a player you get your own hero/items/abilities/player-stats, your own team's buildings, and a trimmed `map`. Cross-team **state** is spectator-only. Valve states the restriction explicitly for CS:GO and the Dota fixtures confirm the same shape; the phrase used across community docs is that information "is limited to the player's or observer's role to prevent cheating."

**The exception, and it is a large one** `[measured]`**:** cross-team *events* are **not** restricted. The `events` block delivers hero kills for all ten players, tower and barracks kills, Roshan and aegis, buybacks, smoke, glyph and scan — see §4. The restriction is about continuous state, not about the discrete things a player can already see in the kill feed and hear from the announcer. This is consistent rather than contradictory: nothing in `events` tells you anything you would not learn by looking at the top bar.

**Not a block, but worth knowing:** the cfg needs the `-gamestateintegration` launch option, and the file must be `gamestate_integration_*.cfg` in `.../dota 2 beta/game/dota/cfg/gamestate_integration/`.

---

## 2. Key fields per block

All field names below are taken verbatim from captured payloads (tier B) unless marked C.

### `provider`
`name` (`"Dota 2"`), `appid` (`570`), `version` (int, bumped by patches), `timestamp` (unix seconds).

### `map` — playing
`name`, `matchid` (string!), `game_time`, `clock_time`, `daytime` (bool), `nightstalker_night` (bool), `radiant_score`, `dire_score`, `game_state` (e.g. `DOTA_GAMERULES_STATE_GAME_IN_PROGRESS`), `paused`, `win_team` (`"none"`/`"radiant"`/`"dire"`), `customgamename`, `ward_purchase_cooldown`.

`game_time` counts from process start; `clock_time` is the in-game clock (negative pre-horn). `matchid` arrives as a **string**, not a number — parse accordingly.

### `map` — spectator-only additions
`radiant_ward_purchase_cooldown`, `dire_ward_purchase_cooldown`, `roshan_state`, `roshan_state_end_seconds`, `tormentor_state`, `tormentor_state_end_seconds`, `tormentor_state_location`, `radiant_glyph_cooldown`, `dire_glyph_cooldown`, `radiant_scan_cooldown`, `radiant_scan_charges`, `dire_scan_cooldown`, `dire_scan_charges`, `radiant_wisdom_shrine`, `dire_wisdom_shrine`, `radiant_lotus_pool_count`, `dire_lotus_pool_count`, `watchers` → `watcher0..N` `{location_x, location_y, capture_state}`.

**Important for the overlay: `roshan_state` / `roshan_state_end_seconds` are NOT in the playing payload.** A Roshan timer for a normal player cannot come from GSI directly.

### `hero` — identical field set playing and spectating
`facet`, `xpos`, `ypos`, `id`, `name` (`npc_dota_hero_oracle`), `level`, `xp`, `alive`, `respawn_seconds`, `buyback_cost`, `buyback_cooldown`, `health`, `max_health`, `health_percent`, `mana`, `max_mana`, `mana_percent`, `silenced`, `stunned`, `disarmed`, `magicimmune`, `hexed`, `muted`, `break`, `aghanims_scepter`, `aghanims_shard`, `smoked`, `has_debuff`, `talent_1`…`talent_8` (bool = taken), `attributes_level`, `permanent_buffs` → `{ "modifier_item_aghanims_shard": { "stack_count": 0 }, ... }`, plus `selected_unit` (C).

`has_debuff` is a single boolean, not a list. There is **no per-modifier debuff array** — you cannot tell *which* debuff. `permanent_buffs` is the only named-modifier map and it only covers permanent stacks (aghs shard, Bounty Hunter track gold, moon shards, etc.).

### `items`
Slot keys, each an object: `slot0`…`slot8` (6 backpack+inventory + 3 backpack — 9 total), `stash0`…`stash5`, `teleport0`, `neutral0`, `neutral1` (neutral item + neutral enhancement), `preserved_neutral6`…`preserved_neutral10`.

Per-item fields: `name` (`item_blink`, or the literal string `"empty"`), `purchaser` (player index; `-1` for neutrals), `can_cast`, `cooldown`, `max_cooldown`, `passive`, `charges`, `item_charges`, `ability_charges`, `max_charges`, `charge_cooldown`, `item_level`, `contains_rune` (bottle, e.g. `"regen"`).

Passive items emit a minimal object (`name`, `purchaser`, `passive: true`) — no cooldown fields. `max_cooldown` is inconsistently present (fixture has it on `item_magic_wand` but not `item_urn_of_shadows`), so compute cooldown fractions defensively.

### `abilities`
`ability0`…`abilityN` (includes non-spell slots like `plus_high_five`, talents and innate/facet abilities can appear). Fields: `name`, `level`, `can_cast`, `passive`, `ability_active`, `cooldown`, `ultimate` (bool), `charges`, `max_charges`, `charge_cooldown`.

"Ultimate ready" = the entry with `ultimate: true` and `cooldown == 0 && can_cast == true`. There is no `max_cooldown` on abilities, so a cooldown *ring* needs the max from static data (`dotaconstants` `abilities.json` → `cd`).

### `player` — playing (confirmed subset)
`steamid`, `accountid`, `name`, `activity` (`"playing"`), `kills`, `deaths`, `assists`, `last_hits`, `denies`, `kill_streak`, `commands_issued`, `kill_list` (`{"victimid_1": 7}` = victim hero/player id → count), `team_name`, `player_slot`, `team_slot`, `gold`, `gold_reliable`, `gold_unreliable`, `gold_from_hero_kills`, `gold_from_creep_kills`, `gold_from_income`, `gold_from_shared`, `gpm`, `xpm`.

### `player` — spectator-only additions
`net_worth`, `hero_damage`, `hero_healing`, `tower_damage`, `wards_purchased`, `wards_placed`, `wards_destroyed`, `runes_activated`, `water_runes_activated`, `bounty_runes_activated`, `camps_stacked`, `support_gold_spent`, `consumable_gold_spent`, `item_gold_spent`, `gold_lost_to_death`, `gold_spent_on_buybacks`, and 12 damage-accounting fields `damage_{received,outgoing}_{pre,post}_reduction_{physical,magical,pure}`. C also lists `onstage_seat`.

**This is the biggest surprise in the whole research.** `net_worth`, `wards_placed`, `camps_stacked`, `support_gold_spent`, `runes_activated` — the "support scorecard" stats — are **absent from the playing payload**. They are in the `player_spectating` fixture only. Design the overlay so those panels degrade to spectator mode. (`net_worth` can be approximated for your own hero: `gold` + sum of item costs from `dotaconstants`.)

### `buildings`
`buildings.radiant` / `buildings.dire` → flat map of building name → `{health, max_health}`.
Names verbatim: `dota_goodguys_tower1_top` … `tower4_bot`, `good_rax_melee_top`, `good_rax_range_mid`, `dota_goodguys_fort`; Dire mirrors with `dota_badguys_*` / `bad_rax_*`. Only two fields per building — no "destroyed" flag; a destroyed building disappears from the map (or reads 0) rather than being marked.

### `draft` (spectator)
`activeteam`, `pick` (bool: pick phase vs ban), `activeteam_time_remaining`, `radiant_bonus_time`, `dire_bonus_time`, then `team2`/`team3` → `home_team`, `pick0_id`/`pick0_class`, `ban0_id`/`ban0_class`, … `_class` is the short hero name (`skywrath_mage`) — directly usable in CDN image URLs.

### `roshan` (spectator)
`xpos`, `ypos`, `health`, `max_health`, `alive`, `spawn_phase`, `phase_time_remaining` (float), `yaw`, `items_drop`.

### `couriers` (spectator)
`courier0..N` → `health`, `max_health`, `alive`, `respawn_time_remaining`, `xpos`, `ypos`, `yaw`, `owner`, `flying_upgrade`, `shield`, `boost`, `items` → `item0..N`.

### `minimap` (spectator)
`element0..N` → `xpos`, `ypos`, `image`, `name`, `unitname`, `team`, `yaw`, `visionrange`, `remainingtime` (float), `eventduration` (float). This is the only source of enemy hero positions and ward icons.

### `neutralitems` (spectator)
`tier1`…`tier5` → tier drop/availability info; `team2`/`team3` → per-team neutral item holdings.

### `league` (league/ticketed matches only)
`series_type`, `selection_priority`, `league_id`, `match_id`, `name`, `tier`, `region`, `url`, `description`, `notes`, `start_timestamp`, `end_timestamp`, `pro_circuit_points`, `image_bits`, `status`, `most_recent_activity`, `registration_period`, `base_prize_pool`, `total_prize_pool`, `league_node_id`, `radiant`/`dire` (team objects), `series_id`, `start_time`, `team_id_1`, `team_id_2`, `streams`.

### `wearables`
Per player: cosmetic item defindexes (`wearable0..N`) and style indices. Useless for a stats overlay; only relevant if rendering the real cosmetic loadout.

---

## 3. Cadence, throttle and realistic latency

Valve's own definitions (tier A, from the CS:GO GSI page — same mechanism):

- **`uri`** — endpoint the client POSTs JSON to (`Content-Type: application/json`).
- **`timeout`** — seconds the client waits for the HTTP response before treating the request as failed.
- **`buffer`** — "The amount of time for which the client should wait once it has a delta to send, collecting together all deltas in the meantime in order to reduce traffic." Valve explicitly recommends a non-zero buffer because game events cluster.
- **`throttle`** — "the game client will avoid sending requests for a specified duration after receiving an HTTP 2XX status code from the server." **Default is 1.0s if unspecified.**
- **`heartbeat`** — "Even if there is no game data update, the service will be pinged after this duration." Use it for disconnect detection.

Critically, **throttle restarts from the moment your server returns 2XX**, so your handler's own latency is additive. Respond immediately (202/200 with an empty body) and do the fan-out to WebSocket asynchronously; do not await the broadcast before replying.

### Practical values for an animated overlay

```
"timeout"    "5.0"
"buffer"     "0.05"
"throttle"   "0.1"
"heartbeat"  "10.0"
```

- `throttle 0.1` + `buffer 0.05` is the community-standard fast setting and gives a **theoretical ceiling of ~10 POSTs/sec**. `[community]` — every overlay project surveyed (`xzion/dota2-gsi`, `jeoooo/dota-gsi-obs-overlay`, `antonpup/Dota2GSI`) uses `0.1/0.1`.
- **Observed reality is worse than the ceiling.** ValveSoftware/Dota2-Gameplay issue #35475 ("GSI delay 1 second") reports data arriving **once per second** in practice, with no Valve response; the issue is open. Treat ~1s as the pessimistic real-world floor and ~100ms as the best case.
- I found **no measurement of in-game-event → HTTP-POST latency** from any primary source. Do not quote a number. Plan to measure it in this repo (log `provider.timestamp` and `map.clock_time` against server receive time).

### Overlay consequence

GSI is not a smooth animation clock. **Interpolate client-side.** Treat each POST as a keyframe: drive health/mana bars and cooldown rings with a local `requestAnimationFrame` tween toward the last received value, and tick cooldowns/`respawn_seconds`/`buyback_cooldown` down locally from the last snapshot rather than waiting for the next POST. Use `heartbeat` misses (> ~2× heartbeat) to show a "disconnected" state.

Setting `throttle 0` is possible but `[community]` reports of it being useful are absent, and Valve notes GSI is opt-in via launch option specifically because of the per-frame cost. Don't.

---

## 4. Discrete events vs. derived-by-diffing

**There is a real `events` array**, but it is tiny. It arrives as a JSON array of `{game_time, event_type, ...payload}`:

```json
"events": [
  { "game_time": 2334, "event_type": "aegis_picked_up", "player_id": 1, "snatched": false },
  { "game_time": 2333, "event_type": "roshan_killed", "killed_by_team": "dire", "killer_player_id": 1 },
  { "game_time": 2542, "event_type": "tip", "sender_player_id": 3, "receiver_player_id": 0, "tip_amount": 50 }
]
```

### Directly reported event types

⚠️ **The "6 types" list below is incomplete.** It is what `antonpup/Dota2GSI` parses, not what the client sends. The 2026-09-20 capture contains **two further `event_type` values that no surveyed library models**, and one of them carries most of the interesting traffic:

| `event_type` | Occurrences `[measured]` | Payload |
| --- | --- | --- |
| `generic_event` | 6680 (85%) | `data` — a **JSON string**, not an object; parse it separately. Inside: `{ type: "CHAT_MESSAGE_*", value, playerid1..6, value2, value3, time }` |
| `chat_message` | 866 | `player_id`, `channel_type`, `message` — free text typed by players |

The `CHAT_MESSAGE_*` types seen in one match, by unique-event count:

| `data.type` | Unique | What it marks |
| --- | --- | --- |
| `CHAT_MESSAGE_HERO_KILL` | 72 | every hero kill in the match, both teams; `playerid1` killer, `playerid2` victim |
| `CHAT_MESSAGE_ITEM_PURCHASE` | 51 | any player's purchase |
| `CHAT_MESSAGE_STREAK_KILL` | 28 | killing spree announcements |
| `CHAT_MESSAGE_HERO_BANNED` | 18 | draft bans |
| `CHAT_MESSAGE_TOWER_KILL` | 13 | **either team's** towers |
| `CHAT_MESSAGE_SENTRY_WARD_KILLED` / `OBSERVER_WARD_KILLED` | 7 / 4 | ward kills |
| `CHAT_MESSAGE_BARRACKS_KILL` | 6 | barracks |
| `CHAT_MESSAGE_RUNE_BOTTLE` | 5 | rune bottled |
| `CHAT_MESSAGE_BUYBACK` | 4 | any player's buyback |
| `CHAT_MESSAGE_COURIER_LOST` / `COURIER_RESPAWNED` | 4 / 4 | couriers |
| `CHAT_MESSAGE_GLYPH_USED` | 4 | glyph |
| `CHAT_MESSAGE_PAUSED` / `UNPAUSED` / `UNPAUSE_COUNTDOWN` | 2 / 2 / 6 | pause handling |
| `CHAT_MESSAGE_SMOKE_ACTIVATED` | 2 | smoke |
| `CHAT_MESSAGE_SCAN_USED` | 2 | scan |
| `CHAT_MESSAGE_FIRSTBLOOD` | 1 | first blood — a dedicated marker, no diffing needed |
| `CHAT_MESSAGE_MINIBOSS_KILL` | 1 | tormentor |
| `CHAT_MESSAGE_SUPER_CREEPS` | 1 | mega creeps |
| `CHAT_MESSAGE_DISCONNECT_*` / `RECONNECT` | — | player connectivity |
| `CHAT_MESSAGE_INTHEBAG`, `INFORMATIONAL`, `REPORT_REMINDER`, `HERO_CHOICE_INVALID` | — | chatter, no game meaning |

This list is one match's worth and is certainly not exhaustive — no Aegis denial, no Divine Rapier, no Roshan-related chat types appeared. Parse `data.type` as an open string.

#### Two properties that will bite an implementation `[measured]`

**Events repeat.** `events` is a rolling window, not a delta. The capture holds 7846 event occurrences but only **290 unique events**; each one persists for a median of **27 consecutive packets** (~30 s of wall clock, max 121 during a pause). A consumer that reacts per packet fires roughly 27 times per kill. Deduplicate on the whole event object — `game_time` plus payload is stable across repeats.

**Delivery is prompt.** Comparing each unique event's `game_time` against `map.game_time` in the first packet carrying it: median **1 s**, max **2 s**, never negative. Events arrive in the next snapshot after they happen. The measurement is quantised by `map.game_time`'s 1-second resolution, so 1 s is the floor this method can report, not a measured delay — the honest reading is "within one poll interval".

#### The six types libraries do model

From `antonpup/Dota2GSI` `EventsProvider/Event.cs` (tier C). Four of the six were observed in the capture; `courier_killed` and `aegis_denied` were not, which says nothing about availability:

| `event_type` | Payload fields |
| --- | --- |
| `courier_killed` | `courier_team`, `killer_player_id` |
| `roshan_killed` | `killed_by_team`, `killer_player_id` |
| `aegis_picked_up` | `player_id`, `snatched` |
| `aegis_denied` | `player_id` |
| `tip` | `sender_player_id`, `receiver_player_id`, `tip_amount` |
| `bounty_rune_pickup` | `player_id`, `team`, `bounty_value`, `team_gold` |

`MrBean355/dota2-gsi` deliberately keeps `event_type` as a raw string with an untyped payload map, which is the right defensive posture — Valve can add types without notice.

### Must be derived by diffing snapshots

| Event | How to derive |
| --- | --- |
| **First blood** | ~~No dedicated event.~~ `[measured]` `CHAT_MESSAGE_FIRSTBLOOD` arrives as a `generic_event`. Diffing the score 0 → 1 remains a fallback. |
| **Kill / death / assist** | Diff `player.kills` / `deaths` / `assists`. `kill_list` (`victimid_N`) tells you *whom* you killed. |
| **Kill streak / multi-kill** | `player.kill_streak` is a **directly provided counter** (resets on death) — no diffing needed. True multi-kill (N kills within a time window) must be derived by timestamping `kills` increments. |
| **Buyback** | Diff `hero.buyback_cooldown` 0 → >0, or `player.gold_spent_on_buybacks` increasing (spectator only). |
| **Tower / barracks kill** | ~~Enemy tower kills are spectator-only.~~ `[measured]` `CHAT_MESSAGE_TOWER_KILL` and `CHAT_MESSAGE_BARRACKS_KILL` arrive in player mode for **both** teams. Diffing `buildings.*` still gives own-team health; the event gives the fact. |
| **Item purchase** | Diff `items.slot*` / `stash*` names. `purchaser` tells you who bought it. |
| **Rune pickup** | Only *bounty* runes have an event. Power/water/wisdom runes must be inferred (`player.runes_activated` — spectator only; or `items.slot8.contains_rune` for a bottled rune). |
| **Smoke used** | `hero.smoked` false → true. |
| **Aghs / shard acquired** | `hero.aghanims_scepter` / `aghanims_shard` false → true. |
| **Talent taken** | `hero.talent_N` false → true. |
| **Level up / stat point** | Diff `hero.level`, `hero.attributes_level`. |
| **Respawn / death** | Diff `hero.alive`; `respawn_seconds` gives the countdown. |
| **Roshan timer** | Spectator: `map.roshan_state` + `roshan_state_end_seconds`, or `roshan.spawn_phase` + `phase_time_remaining`. Playing: `[measured]` `roshan_killed` **is** delivered, with `killed_by_team` and `killer_player_id`, as is `aegis_picked_up`. A player-mode Roshan timer is therefore possible: start it from the event's `game_time`. |
| **Game phase transitions** | Diff `map.game_state`. |

**Architectural note for this repo:** because the derived list dwarfs the native list, the Nitro ingest layer should keep the previous snapshot and emit a normalized internal event stream over the WebSocket. Do not push raw GSI to the TresJS overlay. Valve also sends `previously` and `added` sub-trees containing only what changed — use them as a hint for cheap change detection, but keep your own authoritative previous snapshot, because `[community]` `xzion/dota2-gsi` warns "the client does not announce all keys in an 'added' event."

---

## 5. Hero / item icon art and names

### Valve CDN (all URLs below verified live, HTTP 200, on 2026-09-19)

Base host: `https://cdn.cloudflare.steamstatic.com`

| Asset | Pattern | Verified example |
| --- | --- | --- |
| Hero landscape portrait (256×144) | `/apps/dota2/images/dota_react/heroes/<short>.png` | `.../heroes/antimage.png` (63 KB) |
| Hero minimap/HUD icon (~32×32) | `/apps/dota2/images/dota_react/heroes/icons/<short>.png` | `.../heroes/icons/antimage.png` (4.8 KB) |
| Hero square crop | `/apps/dota2/images/dota_react/heroes/crops/<short>.png` | `.../heroes/crops/antimage.png` (95 KB) |
| Item icon (88×64) | `/apps/dota2/images/dota_react/items/<item>.png` | `.../items/blink.png` (12 KB) |
| Neutral tier token | `/apps/dota2/images/dota_react/items/tier1_token.png` | verified |
| Ability icon | `/apps/dota2/images/dota_react/abilities/<ability>.png` | `.../abilities/antimage_blink.png` (22 KB) |
| Hero render video (alpha) | `/apps/dota2/videos/dota_react/heroes/renders/<short>.webm` | `.../renders/antimage.webm` (2.8 MB) |
| Legacy full portrait | `/apps/dota2/images/heroes/<short>_full.png` | verified 200 |
| Legacy vertical portrait | `/apps/dota2/images/heroes/<short>_vert.jpg` | verified 200 |

Dead / wrong patterns (404, don't use): `/dota_react/spellicons/...`, `/dota_react/items/<item>_lg.png`, `/dota_react/heroes/talents/...`, and the old `cdn.dota2.com` host (DNS failure).

**Name mapping:** GSI gives `hero.name = "npc_dota_hero_antimage"` → strip `npc_dota_hero_` → `antimage`. Items give `item_blink` → strip `item_` → `blink`. Abilities come through already short (`antimage_blink`, `earth_spirit_boulder_smash`) and map 1:1 to the abilities path. Draft gives `pick0_class = "skywrath_mage"`, already short.
Gotcha: internal names diverge from display names — Wraith King is `skeleton_king`, Zeus is `zuus`, Outworld Destroyer is `obsidian_destroyer`, Underlord is `abyssal_underlord`, Magnus is `magnataur`, Necrophos is `necrolyte`, Windranger is `windrunner`, Clockwerk is `rattletrap`, Doom is `doom_bringer`, Timbersaw is `shredder`, Lifestealer is `life_stealer`, Treant Protector is `treant`, Shadow Fiend is `nevermore`, Queen of Pain is `queenofpain`, Io is `wisp`, Vengeful Spirit is `vengefulspirit`. **Do not hand-maintain this map — read it from `dotaconstants`.**

### `dotaconstants` (npm `dotaconstants`, repo `odota/dotaconstants`) — recommended

MIT licensed. Ships prebuilt JSON in `build/`: `heroes.json`, `items.json`, `abilities.json`, `hero_abilities.json`, `ability_ids.json`, `item_ids.json`, `aghs_desc.json`, `permanent_buffs.json`, `player_colors.json`, `neutral_abilities.json`, `patch.json`, `xp_level.json`, `item_colors.json`, `game_mode.json`, `lobby_type.json`, `region.json`, `cluster.json`, `skillshots.json`, `hero_lore.json`, `chat_wheel.json`, `countries.json`, `order_types.json`, `ancients.json`, `patchnotes.json`.

`heroes.json` is keyed by hero id and gives exactly what the overlay needs:

```json
"1": { "id": 1, "name": "npc_dota_hero_antimage", "localized_name": "Anti-Mage",
       "primary_attr": "agi", "attack_type": "Melee", "roles": ["Carry","Escape","Nuker"],
       "img":  "/apps/dota2/images/dota_react/heroes/antimage.png?",
       "icon": "/apps/dota2/images/dota_react/heroes/icons/antimage.png?",
       "base_health": 120, "str_gain": 1.6, "move_speed": 310, ... }
```

`items.json` is keyed by short item name: `{ "id": 1, "img": "/apps/dota2/images/dota_react/items/blink.png?t=...", "dname": "Blink Dagger", "qual": "component", "cost": 2250, "cd": 15, "mc": false, "components": null }`. The `cd` field is the missing `max_cooldown` for cooldown rings, and `cost` lets you compute your own net worth in player mode. `abilities.json` (keyed `antimage_blink`) gives `dname`, `behavior`, `desc`, `attrib[]`, and cooldown/mana arrays per level.

`img`/`icon` are **host-relative with a trailing `?` or `?t=<epoch>` cache-buster** — prefix with `https://cdn.cloudflare.steamstatic.com`.

### OpenDota API

`https://api.opendota.com/api/constants/<resource>` serves the same files over HTTP (verified: `/api/constants/heroes` returns 200 / 92 KB). Code is MIT; the service is explicitly "provided on a best-effort basis" with no availability guarantee. **For a local overlay, vendor `dotaconstants` as an npm dependency rather than calling the API at runtime** — zero network dependency, no rate limit, works offline during a stream.

### Official Steam Web API

`IEconDOTA2_570/GetHeroes/v1/` exists but returns **403 without an API key** (verified), and `GetGameItems` now returns `Method 'GetGameItems' not found in interface 'IEconDOTA2_570'` (verified) — it has been removed. It returns names only, no image URLs. Not worth using here.

### License notes — read this honestly

- **`dotaconstants` / OpenDota code: MIT.** Unambiguous, safe.
- **The art on the Valve CDN is Valve's copyright.** There is **no explicit public license** granting redistribution. Valve's fan-content position (non-commercial fan works permitted) and the general practice of every Dota third-party site are the only cover. For a local, non-commercial stream overlay this is the normal, universally-tolerated practice, but it is *tolerance, not a license*.
- Practical mitigations: hotlink from the Valve CDN rather than re-hosting the images, and include a "Dota 2 is a registered trademark of Valve Corporation" attribution line. If Dota Buddy ever becomes a paid product, this needs a real legal answer.
- `[community]` — the "third-party apps are fine if free and non-commercial" reading comes from Valve forum/community threads, not a Valve legal page. Do not treat it as authoritative.

---

## 6. What you can learn about the enemy team in a normal match

**Short answer: nothing about enemy *state*, but a full feed of what enemies *did*.**

The original answer here was "essentially nothing". The 2026-09-20 capture corrected it: continuous state is restricted exactly as described below, but the `events` feed is not. Keep the two apart when planning features — "who is alive right now" is unavailable, "who just died" is not.

### Available to a normal player

| Data | Source |
| --- | --- |
| Enemy team **kill count** | `map.dire_score` / `map.radiant_score` |
| Which team won | `map.win_team` |
| Match id, clock, day/night, pause state | `map` |
| **Your own team's** building health | `buildings.<your team>` |
| Who **you** killed | `player.kill_list` → `victimid_N` |
| Your own everything | `hero`, `items`, `abilities`, `player`, `wearables` |
| Roshan kills, aegis pickups, bounty runes, tips | `events` — `[measured]`, confirmed in player mode |
| **Every hero kill in the match**, killer and victim by slot | `events` → `generic_event` → `CHAT_MESSAGE_HERO_KILL` `[measured]` |
| **Either team's** tower and barracks kills | `CHAT_MESSAGE_TOWER_KILL`, `CHAT_MESSAGE_BARRACKS_KILL` `[measured]` |
| Any player's buyback, smoke, glyph, scan, ward kills, courier deaths | corresponding `CHAT_MESSAGE_*` `[measured]` |
| First blood, tormentor, mega creeps | `CHAT_MESSAGE_FIRSTBLOOD` / `MINIBOSS_KILL` / `SUPER_CREEPS` `[measured]` |
| All-chat and team-chat text | `events` → `chat_message` `[measured]` — note this is personal data; strip it before a recording leaves the machine |

### NOT available to a normal player

- Enemy hero identities, levels, HP/mana, positions, respawn timers, buyback status, items, abilities, cooldowns. Confirmed by the fixture split: `hero`/`items`/`abilities`/`player` are flat objects in playing mode and only gain `team2`/`team3` nesting in spectating mode.
- **Your own allies'** hero/item/ability state. The playing payload is *local player only* — not "your team". This is a common misconception; there is no ally data in the `*_playing.json` fixtures.
- Enemy building **health** (`buildings_playing.json` contains only `radiant`) — though the *fact* of a tower falling does arrive as an event.
- Enemy or ally positions / wards (`minimap` block).
- Roshan **state** (`map.roshan_state`, `roshan` block are both absent in playing mode) — but `roshan_killed` and `aegis_picked_up` events do arrive, so the timer can be reconstructed.
- Glyph/scan cooldowns, lotus/wisdom-shrine state, tormentor state, watcher control (spectator `map` only).
- Draft picks and bans (`draft` has no playing fixture).
- Per-player advanced stats for anyone, including **yourself**: `net_worth`, `hero_damage`, `tower_damage`, `wards_placed`, `camps_stacked`, `support_gold_spent`, `runes_activated` and the damage-accounting block are spectator-payload-only.

### Design implication for Dota Buddy

The overlay has **two genuinely different data regimes**, not one with more or less detail:

1. **Player mode** — a rich *self* HUD **plus a full match event feed**: your HP/mana/gold/K-D-A/CS, your item and ability cooldowns, talents, buyback affordability + cooldown, respawn timer, smoke/debuff state, your team's tower health — and, `[measured]`, every kill, tower, barracks, Roshan, aegis, buyback, smoke and glyph in the match, for both teams. The state is about *you*; the events are about the *match*. An overlay that reacts to teamfights is therefore possible in player mode, which the first survey concluded it was not.
2. **Spectator/observer mode** — the full ten-player scoreboard, draft, minimap, Roshan/tormentor/glyph/scan timers, both teams' buildings, neutral items, couriers.

Build the WebSocket contract with a discriminated `mode: "playing" | "spectating"` from the start rather than retrofitting it. Detect it structurally: if `player` (or `hero`) has `team2`/`team3` keys, you are spectating.

---

## Open questions / not verified

1. ~~**Is `events` delivered to a normal player, or spectator-only?**~~ **ANSWERED 2026-09-20, own capture.** Yes, in every packet, and it carries far more than the Roshan/aegis feed this question anticipated — see §4. The answer changed what player mode is capable of; §1, §4 and §6 were rewritten accordingly.
2. **`couriers` / `neutralitems` / `minimap` in player mode** — no playing fixtures exist. Assume spectator-only until measured.
3. **Real event→POST latency.** `[measured]` **Partially answered 2026-09-20.** In game-time terms an event reaches the endpoint within one poll interval: median 1 s, max 2 s across 290 unique events, never negative. Observed packet cadence at the server was median 1143 ms, p95 1198 ms, over 2136 intervals. Still open: the *wall-clock* component, which this method cannot separate from the poll interval — `map.game_time` is quantised to whole seconds. Measuring it needs a clock shared between the game and the endpoint.
4. **Whether `throttle "0"` is accepted** by the Dota client and what it costs. Untested.
5. ~~**`map.matchid` is a string in the fixture but typed `long` by `antonpup`.**~~ **ANSWERED 2026-09-20:** `[measured]` string on the wire, in all 2132 packets that carry `map`. Keep coercing defensively anyway — `antonpup` typing it `long` means someone saw a number somewhere.
6. **Field churn.** `provider.version` bumps with patches and fields appear/vanish (e.g. `facet` is recent, `tormentor_*` newer still). Schema validation should be lenient — parse defensively, never assume a key is present.

---

## Sources

- Valve Developer Community, Game State Integration (cfg key semantics, tier A): https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Game_State_Integration
- Captured GSI payload fixtures, playing vs spectating (tier B): https://github.com/MrBean355/dota2-gsi/tree/main/lib/src/test/resources
- `antonpup/Dota2GSI` parser source — full block list, event types, field names (tier C): https://github.com/antonpup/Dota2GSI/tree/master/Dota2GSI/Nodes
- `antonpup/Dota2GSI` README — 16-key cfg: https://github.com/antonpup/Dota2GSI/blob/master/README.md
- `xzion/dota2-gsi` README — older cfg, `added`/`previously` caveat, "full player data … only to spectators and observers": https://github.com/xzion/dota2-gsi
- `MrBean355/dota2-gsi` docs — `PlayingGameState` vs `SpectatingGameState`: https://mrbean355.github.io/dota2-gsi/
- GSI intro write-up (cfg placement, launch option, role restriction): https://auo.nu/posts/game-state-integration-intro/
- ValveSoftware/Dota2-Gameplay issue #35475, "GSI delay 1 second" (open, no Valve response): https://github.com/ValveSoftware/Dota2-Gameplay/issues/35475
- `odota/dotaconstants` (MIT), prebuilt JSON: https://github.com/odota/dotaconstants — raw files under https://raw.githubusercontent.com/odota/dotaconstants/master/build/
- OpenDota API docs / FAQ (MIT code, best-effort service): https://docs.opendota.com/ and https://blog.opendota.com/2014/08/01/faq/
- Valve legal index (fan content / Steam Subscriber Agreement): https://store.steampowered.com/legal/
