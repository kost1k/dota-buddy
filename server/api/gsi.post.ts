export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const payload = {
    type: 'update',
    data: {
      hero: body.hero,
      player: body.player,
      map: body.map,
    },
  }

  // Если герой умер, добавим флаг
  if (body.hero && body.hero.alive === false) {
    payload.type = 'death'
  }

  // Публикуем сообщение всем, кто подписан на 'dota-events'
  broadcast('dota-events', payload)

  return { status: 'ok' }
})
