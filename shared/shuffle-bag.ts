/**
 * Мешок без возврата.
 *
 * Нужен потому, что чистая случайность даёт повторы подряд, а повтор — ровно
 * то, от чего полиморфизм спасает: замер показал, что повторяющийся визуал
 * мёртв после ВТОРОГО показа. Мешок гарантирует, что каждый профиль будет
 * показан по разу, прежде чем какой-либо повторится.
 *
 * Дополнительно исключается стык: последний профиль предыдущей раздачи не
 * может оказаться первым в следующей, иначе повтор подряд всё равно
 * случится — как раз на границе, где его никто не ждёт.
 */

export function createShuffleBag<T>(items: readonly T[], random: () => number = Math.random) {
  if (items.length === 0)
    throw new Error('shuffle bag: пустой набор')

  let bag: T[] = []
  let previous: T | undefined

  function refill() {
    bag = [...items]
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j]!, bag[i]!]
    }
    // Стык раздач: если первым выпал тот же, что закрыл прошлую, меняем
    // его местами со следующим. При наборе из одного элемента делать
    // нечего — повтор там неизбежен по определению.
    if (bag.length > 1 && bag[bag.length - 1] === previous)
      [bag[bag.length - 1], bag[bag.length - 2]] = [bag[bag.length - 2]!, bag[bag.length - 1]!]
  }

  return function draw(): T {
    if (bag.length === 0)
      refill()
    previous = bag.pop()!
    return previous
  }
}
