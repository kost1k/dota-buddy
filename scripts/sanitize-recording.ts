/**
 * Обезличивание записанной сессии GSI.
 *
 *   bun run scripts/sanitize-recording.ts <вход.jsonl> [выход.jsonl]
 *
 * Скрипт намеренно тонкий: вся логика в `server/utils/sanitize.ts` и
 * покрыта тестами, здесь только чтение, запись и счёт строк.
 *
 * Самопроверки внутри НЕТ, и это не упущение. Проверять свою работу своими
 * же допущениями бесполезно: первая версия этой чистки отчиталась об
 * успехе, оставив в файле сотню живых сообщений. Поймала это независимая
 * сверка снаружи — она и описана в чеклисте выезда.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { sanitizeRecordedBody } from '../server/utils/sanitize'

const [input, output] = process.argv.slice(2)

if (!input) {
  console.error('нужен путь к записи: sanitize-recording.ts <вход.jsonl> [выход.jsonl]')
  process.exit(1)
}

const target = output ?? `${input.replace(/\.jsonl$/, '')}.sanitized.jsonl`

if (target === input) {
  // Перезапись на месте лишила бы сверки: сырой файл — единственное, с чем
  // можно сравнить результат, а переснять матч нельзя.
  console.error('нельзя писать поверх входного файла: сверять результат будет не с чем')
  process.exit(1)
}

const lines = readFileSync(input, 'utf8').split('\n').filter(Boolean)
const out: string[] = []
let broken = 0

for (const line of lines) {
  try {
    // Чистится ТЕЛО, а не запись целиком: пути в правилах отсчитываются от
    // тела пакета, а `{ at, body }` — конверт рекордера, о котором знает
    // только этот скрипт.
    const record = JSON.parse(line)
    record.body = sanitizeRecordedBody(record.body)
    out.push(JSON.stringify(record))
  }
  catch {
    // Недописанная последняя строка — ожидаемый исход обрыва записи.
    // Выбрасываем её, но говорим об этом вслух.
    broken++
  }
}

writeFileSync(target, `${out.join('\n')}\n`, 'utf8')

console.log(`прочитано строк: ${lines.length}`)
console.log(`записано строк:  ${out.length}`)
if (broken > 0)
  console.log(`пропущено битых: ${broken}`)
console.log(`результат:       ${target}`)
console.log('\nтеперь сверь результат независимо — см. чеклист выезда')
