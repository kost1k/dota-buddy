import { describe, expect, it } from 'vitest'
import { sanitizeRecordedBody, stripAuth } from '../server/utils/sanitize'

/**
 * Форма, повторяющая настоящую запись: идентифицирующие поля лежат в ТРЁХ
 * копиях структуры, а `added` помечает появившиеся ключи булевым `true`
 * вместо значения.
 */
function raw() {
  return {
    provider: { name: 'Dota 2', appid: 570 },
    player: {
      steamid: '76561198101406353',
      accountid: '141140625',
      name: '420',
      team_name: 'radiant',
      kills: 4,
      player_slot: 2,
    },
    hero: { id: 14, name: 'npc_dota_hero_pudge', level: 12, health: 900 },
    items: { slot0: { name: 'item_blink', purchaser: 2 } },
    abilities: { ability0: { name: 'pudge_meat_hook' } },
    map: { matchid: '9008646768', game_state: 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS', radiant_score: 10 },
    events: [
      { event_type: 'chat_message', player_id: 1, message: 'насосал лайн' },
      { event_type: 'tip', sender_player_id: 5, tip_amount: 50 },
    ],
    previously: {
      player: { steamid: '76561198101406353', name: '420', kills: 3 },
      events: { event: { message: 'есл чо)' } },
    },
    added: {
      player: { steamid: true, accountid: true, name: true, kills: true },
      events: { event: { message: true } },
    },
  }
}

describe('sanitizeRecordedBody: идентификаторы игрока', () => {
  it('подменяет steamid, accountid и имя', () => {
    const body = sanitizeRecordedBody(raw())

    expect(body.player.steamid).toBe('0')
    expect(body.player.accountid).toBe('0')
    expect(body.player.name).toBe('player')
  })

  it('подменяет идентификатор матча', () => {
    expect(sanitizeRecordedBody(raw()).map.matchid).toBe('0')
  })

  // Чистить только верхний блок бесполезно: те же значения лежат в копиях
  // структуры, которыми Dota передаёт дифф.
  it('чистит те же поля в previously', () => {
    const body = sanitizeRecordedBody(raw())

    expect(body.previously.player.steamid).toBe('0')
    expect(body.previously.player.name).toBe('player')
  })
})

describe('sanitizeRecordedBody: маркеры диффа', () => {
  // В `added` значение — признак «ключ появился», а не данные. Подмена
  // сломала бы форму диффа, ради изучения которой запись и делается.
  it('не трогает булевы маркеры в added', () => {
    const { added } = sanitizeRecordedBody(raw())

    expect(added.player.steamid).toBe(true)
    expect(added.player.accountid).toBe(true)
    expect(added.player.name).toBe(true)
    expect(added.events.event.message).toBe(true)
  })
})

describe('sanitizeRecordedBody: чат', () => {
  it('стирает текст сообщений в массиве событий', () => {
    expect(sanitizeRecordedBody(raw()).events[0].message).toBe('')
  })

  // Мимо этого случая легко пройти: в верхнем блоке события лежат
  // массивом, а в previously/added — объектом, и обход обязан покрывать обе
  // формы.
  it('стирает текст сообщений в объектной форме previously', () => {
    expect(sanitizeRecordedBody(raw()).previously.events.event.message).toBe('')
  })
})

describe('sanitizeRecordedBody: сохранность игровых данных', () => {
  // Ключ `name` есть не только у игрока: у героя, предметов и способностей
  // он несёт игровые данные. Правило «любой name» уничтожило бы запись.
  it('не трогает имена героя, предметов и способностей', () => {
    const body = sanitizeRecordedBody(raw())

    expect(body.hero.name).toBe('npc_dota_hero_pudge')
    expect(body.items.slot0.name).toBe('item_blink')
    expect(body.abilities.ability0.name).toBe('pudge_meat_hook')
  })

  it('не трогает показатели матча', () => {
    const body = sanitizeRecordedBody(raw())

    expect(body.player.kills).toBe(4)
    expect(body.player.team_name).toBe('radiant')
    expect(body.hero.health).toBe(900)
    expect(body.map.radiant_score).toBe(10)
    expect(body.previously.player.kills).toBe(3)
  })

  // Индексы слотов осмысленны только внутри матча и нужны для разбора
  // событий: кто кого убил.
  it('не трогает индексы слотов', () => {
    const body = sanitizeRecordedBody(raw())

    expect(body.player.player_slot).toBe(2)
    expect(body.events[0].player_id).toBe(1)
    expect(body.events[1].sender_player_id).toBe(5)
  })
})

describe('stripAuth', () => {
  // Токен — секрет, а не свидетельство о формате: познавательной ценности
  // ноль, а утечка срабатывает сразу. Поэтому он снимается на записи, в
  // отличие от всего остального.
  it('снимает токен с тела', () => {
    const body = stripAuth({ auth: { token: 'hunter2' }, map: { matchid: '777' } })

    expect(body).not.toHaveProperty('auth')
    expect(body).toEqual({ map: { matchid: '777' } })
  })

  it('оставляет тело без токена нетронутым', () => {
    const body = { map: { matchid: '777' } }

    expect(stripAuth(body)).toEqual(body)
  })

  it('переживает не-объект', () => {
    expect(stripAuth(null)).toBeNull()
    expect(stripAuth('')).toBe('')
  })
})
