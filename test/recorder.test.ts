import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { recordRawSnapshot, startRecording } from '../server/utils/recorder'

/**
 * Рекордер намеренно не ждёт завершения записи: `throttle` в GSI
 * отсчитывается от момента ответа сервера. Поэтому тест дожидается
 * появления строки в файле, а не флашит очередь — экспортировать её ради
 * теста значило бы завести тест-онли код в рабочем модуле.
 */
async function readWhenWritten(path: string, timeoutMs = 2000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const content = readFileSync(path, 'utf8')
      if (content.includes('\n'))
        return content
    }
    catch {
      // файла ещё нет
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`запись не появилась за ${timeoutMs} мс`)
}

function targetPath(): string {
  return join(mkdtempSync(join(tmpdir(), 'buddy-recorder-')), 'session.jsonl')
}

describe('recordRawSnapshot: токен', () => {
  // Токен — секрет, а не свидетельство о формате. Всё остальное пишется
  // сырым и чистится постфактум, но для него ждать нечего: потерять с ним
  // нечего, а утечка срабатывает сразу.
  it('не пишет токен на диск', async () => {
    const path = targetPath()
    startRecording(path)

    recordRawSnapshot({ auth: { token: 'hunter2' }, map: { matchid: '777' } })

    expect(await readWhenWritten(path)).not.toContain('hunter2')
  })

  it('пишет остальное тело без изменений', async () => {
    const path = targetPath()
    startRecording(path)

    recordRawSnapshot({ auth: { token: 'hunter2' }, map: { matchid: '777' }, hero: { level: 12 } })

    const record = JSON.parse(await readWhenWritten(path))
    expect(record.body).toEqual({ map: { matchid: '777' }, hero: { level: 12 } })
    expect(typeof record.at).toBe('number')
  })

  it('пишет тело без токена как есть', async () => {
    const path = targetPath()
    startRecording(path)

    recordRawSnapshot({ map: { matchid: '777' } })

    const record = JSON.parse(await readWhenWritten(path))
    expect(record.body).toEqual({ map: { matchid: '777' } })
  })
})
