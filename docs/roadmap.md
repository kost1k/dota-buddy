# Технический статус и Roadmap

## Актуальный статус (на сейчас)

### Реализовано
- [x] Nuxt 4 + Nitro + WebSocket endpoint `/ws`
- [x] HTTP endpoint `POST /api/gsi`
- [x] Broadcast сервис для WS клиентов
- [x] Overlay UI с реакцией на `update`/`death`
- [x] 3D сцена (TresJS) и GSAP-анимации
- [x] Empty state (`idle`) при окончании матча/пустом payload
- [x] Безопасный парсинг WS payload на клиенте (`try/catch` + валидация формы)
- [x] Валидация и санитизация входящего GSI payload на сервере
- [x] Конфигурируемые `WS_URL` и `idle timeout` через runtime/env
- [x] Базовая защита `/api/gsi` через `NUXT_GSI_SECRET` + `auth.token`
- [x] Базовая наблюдаемость: `GET /api/health`, `logLevel`, структурированные серверные логи

### Технический долг
- [ ] Убрать дублированный рендер `BuddyScene`
- [ ] Добавить status-индикатор WS-соединения в UI
- [ ] Продумать стратегию уровней логирования для production (`silent`/внешний sink)

---

## Этап 1 - Stabilize Core (High Priority)

- [x] Добавить схему валидации `hero/player/map` на сервере
- [x] Добавить `try/catch` вокруг `JSON.parse` на клиенте
- [ ] Ввести heartbeat/ping и статус соединения в UI
- [x] Настроить переменные окружения для endpoint-ов
- [ ] Профилировать FPS/CPU в OBS Browser Source

**Milestone:** стабильная работа 3+ часа стрима без деградации и без ложных ошибок в dev-логах.

---

## Этап 2 - Event Engine

- [ ] Расширить типы сокет-событий: `event`, `heartbeat`, `error`
- [ ] Добавить триггеры: first blood, multi-kill, roshan, aegis, buyback
- [ ] Буфер последних N событий для таймлайна в overlay

**Milestone:** минимум 5 уникальных реакций на события матча.

---

## Этап 3 - Stream Interactivity

- [ ] Интеграция Twitch chat (команды и модерация)
- [ ] Режимы отображения через query params (`mode`, `scale`, `pos`)
- [ ] Wall of Grief + безопасная фильтрация сообщений

**Milestone:** интерактив с чатом без ручного вмешательства стримера.

---

## Этап 4 - Persistence & Analytics

- [ ] Unstorage для сессионного состояния
- [ ] История матча: пик `sweatLevel`, лучший streak, средний GPM/XPM
- [ ] Локальный Top fans/очки интерактива

**Milestone:** повторно используемые статистические профили стрим-сессий.

---

## Ближайший фокус (следующая сессия)

1. Добавить статус WS-соединения в UI (connected/reconnecting/offline).
2. Вынести debug/fullscreen сцену в отдельную страницу (чтобы убрать постоянный dual-render из основного overlay).
3. Пройти короткий прогон `docs/pre-stream-checklist.md` + базовый smoke-test в OBS.
