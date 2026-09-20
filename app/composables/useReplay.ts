import type { ReplayCommand, ReplayState } from '#shared/replay'

/**
 * Управление воспроизведением записи с пульта.
 *
 * Пульт здесь именно пульт: он не держит ни пакетов, ни темпа — только
 * показывает положение и шлёт команды. Сам темп отсчитывает сервер
 * (`shared/replay.ts`), поэтому composable сводится к опросу состояния и
 * шести кнопкам.
 *
 * Опрос раз в секунду, а не подписка: по WebSocket и так приезжают сами
 * пакеты, а здесь нужно лишь положение ползунка — заводить ради него второй
 * канал незачем.
 */
export function useReplay() {
  const state = useState<ReplayState | null>('replay:state', () => null)
  const error = useState<string | null>('replay:error', () => null)

  async function refresh() {
    try {
      state.value = await $fetch<ReplayState>('/api/replay')
      error.value = null
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
  }

  async function send(command: ReplayCommand) {
    try {
      await $fetch('/api/replay', { method: 'POST', body: command })
      error.value = null
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
    await refresh()
  }

  if (import.meta.client)
    useIntervalFn(refresh, 1000, { immediate: true, immediateCallback: true })

  return {
    state,
    error,
    refresh,
    load: (file: string) => send({ action: 'load', file }),
    play: () => send({ action: 'play' }),
    pause: () => send({ action: 'pause' }),
    stop: () => send({ action: 'stop' }),
    seek: (index: number) => send({ action: 'seek', index }),
    setSpeed: (speed: number) => send({ action: 'speed', speed }),
  }
}
