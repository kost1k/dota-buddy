# Dota Buddy

Локальный overlay-виджет для стрима Dota 2. В углу экрана живёт **бадди** —
существо с глазом, которое переживает матч вместе со стримером: радуется,
напрягается, паникует, съёживается при смерти и растёт по ходу игры.

Это эмоциональный компаньон, а не приборная панель: состояние читается даже
зрителем, который про Доту не знает ничего.

> **Статус: редизайн.** Пайплайн приёма данных работает и остаётся.
> Клиентская часть переписывается — прототип был проверкой идеи, а не
> желаемым результатом. Конструкция зафиксирована в
> [`.scratch/buddy-redesign/spec.md`](.scratch/buddy-redesign/spec.md),
> ход работ — в [`docs/roadmap.md`](docs/roadmap.md).

## Как это работает

```
Dota 2  ──POST /api/gsi──▶  Nitro  ──WebSocket /ws──▶  Overlay (Nuxt + TresJS)
         снапшот ~1 Гц       вывод событий              аффект по rAF
```

Dota 2 шлёт снапшоты состояния через Game State Integration примерно раз в
секунду. Сервер сравнивает соседние снапшоты, выводит из них события
(смерть, респавн, байбек, талант, аганим) и транслирует нормализованный
поток в браузер. Клиент интегрирует настроение бадди между пакетами — пакет
это ключевой кадр, а не тик анимации.

## Стек

- Nuxt 4 + Nitro + CrossWS
- Vue 3, Composition API
- `@vueuse/core` (`useWebSocket`)
- `@tresjs/core` / `@tresjs/nuxt` (Three.js)
- GSAP
- `dotaconstants` — обязательная зависимость: GSI присылает текущий кулдаун,
  но не максимальный

## Локальный запуск

```bash
bun install
cp .env.example .env
bun run dev
```

Приложение стартует на `http://localhost:3000`, WebSocket — `/ws`.

### Runtime-переменные

| Переменная | Назначение |
| --- | --- |
| `NUXT_PUBLIC_WS_URL` | URL WebSocket для оверлея |
| `NUXT_PUBLIC_IDLE_TIMEOUT_MS` | таймаут без входящих сообщений до перехода в сон |
| `NUXT_GSI_SECRET` | shared secret для `POST /api/gsi` (пусто — проверка выключена) |
| `NUXT_LOG_LEVEL` | `debug`, `info` или `silent` |

### Служебный endpoint

`GET /api/health` — `status`, `timestamp`, `uptimeSec`, `wsPeers`, `logLevel`.

## Разработка без Доты

Машина разработки и машина для тестов — разные: Dota 2 и Streamlabs стоят
только на игровом ПК. Поэтому оверлей проектируется так, чтобы его можно было
полностью проверять без игры.

- **Пульт** — синтетические GSI-пакеты в `POST /api/gsi` (проверяет систему
  целиком, включая серверный вывод событий) плюс прямой оверрайд осей
  настроения для быстрой итерации визуала.
- **Воспроизведение записи** — сохранённая GSI-сессия проигрывается в
  реальном темпе. Тот же формат, что у пульта.

Выезд на игровой ПК тратится только на то, чего синтетикой не проверить:
альфа в эфире, производительность, VRAM на длинном прогоне, реальная
каденция GSI.

## Подключение Dota 2 GSI

1. Скопировать [`docs/examples/gamestate_integration_dota_buddy.cfg`](docs/examples/gamestate_integration_dota_buddy.cfg)
   в `...\Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\`
2. Проверить `uri` в файле — локально `http://127.0.0.1:3000/api/gsi`
3. Если задан `NUXT_GSI_SECRET`, указать такой же токен в секции `auth.token`
4. Добавить в параметры запуска Dota 2: `-gamestateintegration`
5. Запустить матч и убедиться, что оверлей получает обновления

## Подключение к OBS / Streamlabs

Browser Source на URL оверлея. Важное:

- **«Enable Browser Source Hardware Acceleration» — оставить включённым.**
  С выключенным каждый кадр 1080p стоит ~7.9 МиБ трафика CPU↔GPU.
- **«Use custom frame rate» — оставить выключенным.** По умолчанию страница
  залочена на выходной клок OBS, что и даёт ощущение 60 fps без рассинхрона.
- **Приёмка визуала — в OBS, а не в браузере.** Полупрозрачные края в
  browser source рендерятся иначе из-за открытых багов альфы
  ([ADR-0003](docs/adr/0003-no-soft-glow-obs-constraints.md)).

## Что оверлей знать не может

В обычном матче GSI отдаёт **только героя самого игрока**: ни союзников, ни
противников, ни состояния Рошана, ни `net_worth`. Всё кросс-командное
доступно лишь наблюдателю. Это жёсткий потолок — подробности и источники в
[`docs/research/gsi-data-surface.md`](docs/research/gsi-data-surface.md).

## Документы

| Файл | Что внутри |
| --- | --- |
| [`CONTEXT.md`](CONTEXT.md) | словарь терминов проекта |
| [`docs/concept.md`](docs/concept.md) | продуктовая концепция |
| [`.scratch/buddy-redesign/spec.md`](.scratch/buddy-redesign/spec.md) | полная конструкция и обоснования |
| [`docs/adr/`](docs/adr/) | ключевые решения, которые дорого пересматривать |
| [`docs/roadmap.md`](docs/roadmap.md) | рубежи и техдолг |
| [`docs/research/`](docs/research/) | разведка по GSI и по OBS, с источниками |

## Структура

```
app/            overlay UI (переписывается)
server/
  api/gsi.post.ts   входящий GSI webhook
  routes/ws.ts      WebSocket-подключения
  utils/ws.ts       broadcast-сервис
  utils/logger.ts   уровни логирования
docs/           документация, ADR, разведка
.scratch/       спеки и тикеты работы, которая ведётся сейчас
```
