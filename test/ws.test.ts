import type { Peer } from 'crossws'
import type { OverlayMessage } from '../shared/overlay-message'
import { afterEach, describe, expect, it } from 'vitest'
import { wsService } from '../server/utils/ws'

/**
 * Безопасная отправка подключённым оверлеям.
 *
 * Модуль существует ради одного: при оборванном сокете `peer.send` не
 * бросает, а возвращает отклоняющийся промис, и необработанный отказ валит
 * процесс. В эфире сокеты рвутся штатно — OBS перезагружает browser source
 * при каждой смене сцены.
 *
 * Проверяем наблюдаемое: отвалившийся пир выброшен из набора, живой получил.
 * Удаление и есть след того, что отказ перехвачен. Отсутствие
 * необработанного отказа достаётся даром: убери защиту — и vitest сообщит.
 */

const MESSAGE: OverlayMessage = { type: 'idle' }

/** Набор пиров живёт в модуле, поэтому каждый тест убирает за собой. */
const registered: Peer[] = []

afterEach(() => {
  registered.forEach(peer => wsService.remove(peer))
  registered.length = 0
})

function register<T extends Peer>(peer: T): T {
  registered.push(peer)
  wsService.add(peer)
  return peer
}

function livePeer(id: string) {
  const received: string[] = []
  const send = (data: string) => {
    received.push(data)
  }
  const peer = { id, send } as unknown as Peer
  return { peer: register(peer), received }
}

/** Сокет оборван так, что `send` бросает синхронно. */
function throwingPeer() {
  const send = () => {
    throw new Error('socket closed')
  }
  return register({ id: 'throws', send } as unknown as Peer)
}

/** Сокет оборван так, что `send` возвращает отклоняющийся промис. */
function rejectingPeer() {
  return register({ id: 'rejects', send: () => Promise.reject(new Error('socket closed')) } as unknown as Peer)
}

/** Отказ промиса перехватывается в микрозадаче — даём ей пройти. */
function settle() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('рассылка оверлеям', () => {
  it('живой пир получает сообщение', () => {
    const live = livePeer('live')

    wsService.broadcast(MESSAGE)

    expect(live.received).toEqual([JSON.stringify(MESSAGE)])
  })

  it('бросающий пир выбрасывается, живой получает', () => {
    const dead = throwingPeer()
    const live = livePeer('live')
    expect(wsService.count()).toBe(2)

    wsService.broadcast(MESSAGE)

    expect(wsService.count()).toBe(1)
    expect(live.received).toHaveLength(1)
    expect(dead.id).toBe('throws')
  })

  it('пир с отклонённым промисом выбрасывается, отказ не всплывает', async () => {
    rejectingPeer()
    const live = livePeer('live')
    expect(wsService.count()).toBe(2)

    wsService.broadcast(MESSAGE)
    await settle()

    expect(wsService.count()).toBe(1)
    expect(live.received).toHaveLength(1)
  })

  it('адресная отправка доходит до одного пира, минуя остальных', () => {
    const target = livePeer('target')
    const other = livePeer('other')

    wsService.send(target.peer, MESSAGE)

    expect(target.received).toHaveLength(1)
    expect(other.received).toHaveLength(0)
  })

  it('адресная отправка защищена так же, как рассылка', async () => {
    const dead = rejectingPeer()

    wsService.send(dead, MESSAGE)
    await settle()

    expect(wsService.count()).toBe(0)
  })
})
