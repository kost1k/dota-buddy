/**
 * Обезличивание записанной сессии GSI. Чистый модуль.
 *
 * Делается ОТДЕЛЬНЫМ шагом после выезда, а не на записи, и это не лень.
 * Запись сырая намеренно (см. `recorder.ts`): она должна отражать то, что
 * присылает Dota, а не наши представления об этом. Фильтр на записи
 * определял бы «лишнее» по текущей модели формата — а модель бывает
 * неверна. Проверено: в первой же записи блок `events` отдал события по
 * всем десяти игрокам, хотя по нашим документам чужих данных в обычном
 * матче нет вовсе.
 *
 * Вторая причина — обратимость. Выездов мало, переснять матч нельзя.
 * Ошибка в чистке на записи уничтожает единственную копию и обнаруживается
 * дома; ошибка в чистке постфактум ловится сверкой с сырым файлом.
 *
 * Исключение одно и живёт в `stripAuth`.
 */

/**
 * Подстановки вместо идентифицирующих значений.
 *
 * Ключ — путь внутри тела, с уже снятым префиксом диффа: `player.steamid`
 * покрывает и `previously.player.steamid`, и `added.player.steamid`.
 * Путь, а не имя ключа: `name` есть ещё у героя, предметов и способностей,
 * и там это игровые данные.
 */
const REPLACEMENTS: Record<string, string> = {
  'player.steamid': '0',
  'player.accountid': '0',
  'player.name': 'player',
  'map.matchid': '0',
}

/** Префиксы блоков диффа. Внутри них лежит копия той же структуры. */
const DIFF_PREFIX = /^(?:previously|added)\./

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Идентифицирующее значение — только строка или число.
 *
 * В блоке `added` значением служит булево `true`: это признак «ключ
 * появился», а не данные. Подменять его нельзя — сломается форма диффа,
 * ради изучения которой запись и делается.
 */
function isReplaceable(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

function walk(node: unknown, path: string): void {
  if (!isObject(node))
    return

  // Массивы обходятся наравне с объектами и не удлиняют путь индексом:
  // верхний блок `events` — массив, а в `previously`/`added` те же события
  // приходят объектом. Обе формы обязаны чиститься одинаково.
  if (Array.isArray(node)) {
    for (const item of node) walk(item, path)
    return
  }

  for (const [key, value] of Object.entries(node)) {
    // Текст чата. Правило по имени ключа, а не по пути: `message` во всём
    // формате встречается только в событиях, зато путь до него разный в
    // массивной и объектной форме.
    if (key === 'message' && typeof value === 'string') {
      node[key] = ''
      continue
    }

    const next = path ? `${path}.${key}` : key
    const replacement = REPLACEMENTS[next.replace(DIFF_PREFIX, '')]

    if (replacement !== undefined && isReplaceable(value)) {
      node[key] = replacement
      continue
    }

    walk(value, next)
  }
}

/**
 * Обезличивает тело записанного пакета. МУТИРУЕТ переданный объект и
 * возвращает его же: вызывающий разбирает файл построчно, и копировать
 * шесть килобайт на каждый пакет незачем.
 */
export function sanitizeRecordedBody<T>(body: T): T {
  walk(body, '')
  return body
}

/**
 * Снимает токен GSI с тела. Единственное, что чистится НА ЗАПИСИ.
 *
 * Токен отличается от остального по роду: это секрет, а не свидетельство о
 * формате. Познавательной ценности в нём ноль, поэтому потерять с ним
 * нечего, а утечка срабатывает сразу, а не через цепочку сопоставлений.
 *
 * Не мутирует: то же тело после записи уходит в разбор снапшота.
 */
export function stripAuth<T>(body: T): T {
  if (!isObject(body) || Array.isArray(body) || !('auth' in body))
    return body

  const { auth: _auth, ...rest } = body
  return rest as T
}
