# Dota Buddy

Локальный overlay-виджет для стрима Dota 2 с реакцией в реальном времени на события матча.

## Что уже реализовано

- Прием данных из Dota 2 Game State Integration через `POST /api/gsi`
- Трансляция состояния в браузер через WebSocket `ws://localhost:3000/ws`
- Реактивный overlay на Nuxt/Vue:
  - 3D-объект (`TresJS`) с анимациями
  - состояние смерти (`death`) и level-up flash
  - динамический `sweatLevel` на базе GPM/XPM/Kills
  - kill streak-цвета и компактная карточка метрик

## Текущий стек

- Nuxt 4 + Nitro + CrossWS
- Vue 3 + Composition API
- `@vueuse/core` (`useWebSocket`)
- `@tresjs/core` / `@tresjs/nuxt`
- GSAP

## Структура проекта (ключевое)

- `app/app.vue` - главный overlay UI и реакция на входящие WS-сообщения
- `app/components/BuddyScene.vue` - контейнер 3D-сцены
- `app/components/BuddyObject.vue` - анимации и логика 3D-объекта
- `server/api/gsi.post.ts` - входящий GSI webhook
- `server/routes/ws.ts` - обработчик WebSocket-подключений
- `server/utils/ws.ts` - broadcast-сервис для WS

## Локальный запуск

```bash
bun install
cp .env.example .env
bun run dev
```

Приложение стартует на `http://localhost:3000`, WebSocket endpoint - `/ws`.

### Служебный endpoint

- `GET /api/health` - быстрый статус сервера (`status`, `timestamp`, `uptimeSec`, `wsPeers`, `logLevel`)

### Runtime-переменные

- `NUXT_PUBLIC_WS_URL` - URL для подключения overlay к WebSocket
- `NUXT_PUBLIC_IDLE_TIMEOUT_MS` - таймаут без входящих сообщений до перехода в empty state
- `NUXT_GSI_SECRET` - shared secret для защиты `POST /api/gsi` (пустое значение отключает проверку)
- `NUXT_LOG_LEVEL` - уровень серверных логов: `debug`, `info`, `silent`

## Как подключить Dota 2 GSI

1. Скопировать шаблон `docs/examples/gamestate_integration_dota_buddy.cfg`
2. Поместить файл в директорию Dota 2:
   - `...\Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\`
3. Проверить endpoint в файле:
   - локально: `http://127.0.0.1:3000/api/gsi`
   - удаленно: свой публичный URL/туннель
4. Если включена защита `NUXT_GSI_SECRET`, указать такой же токен в секции `auth.token` GSI-файла
5. Запустить матч и убедиться, что overlay получает обновления

### Примечание по auth

- Для локальных тестов можно оставить `NUXT_GSI_SECRET` пустым
- Для стабильного использования лучше задать `NUXT_GSI_SECRET` и такой же `auth.token` в GSI-конфиге
- Шаблон уже включает расширенные `data` поля (`buildings`, `draft`, `wearables`) для будущих фич, даже если сейчас они не используются в UI

## Ограничения текущей версии

- Сцена `BuddyScene` рендерится дважды (избыточная нагрузка)
- Twitch/Unstorage/Supabase пока не интегрированы

## План ближайших улучшений

См. `docs/roadmap.md`.

## Полезные документы

- `docs/pre-stream-checklist.md` - чеклист перед эфиром
- `docs/examples/gamestate_integration_dota_buddy.cfg` - шаблон GSI-конфига для Dota 2
- `docs/session-handoff-2026-04-25.md` - итоги текущей сессии и next steps
