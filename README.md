# Rassvet

Веб-приложение Центра развития детей «РАСсвет».

Проект объединяет публичный сайт центра и закрытую систему для родителей, преподавателей и администрации: расписание, документы, уведомления, контент сайта и отчётность.

Production: [rassvethm.ru](https://rassvethm.ru)

## Возможности

- **Расписание.** Недельные расписания с учётом доступности преподавателей и детей. Проверка конфликтов кабинетов и участников, асинхронная генерация, ручное редактирование, закрепление слотов. Групповые занятия и посещаемость.
- **Пользователи и доступ.** Роли: родитель (`user`), преподаватель, администратор, суперадминистратор. Регистрация с подтверждением email, восстановление пароля.
- **Документы.** Анкеты, документы родителей и детей в приватном хранилище, сроки действия услуг (ИППСУ и др.) с автоматическими напоминаниями.
- **CMS публичного сайта.** Статьи с блочным содержимым, достижения, награды, вакансии, видео, история, услуги и тарифы, файлы, настройки сайта. Отзывы с модерацией, заявки на консультацию.
- **Уведомления.** Внутри приложения, по email (SMTP) и сообщениями сообщества VK: административные уведомления, рассылка расписания преподавателям, напоминания о медосмотрах и днях рождения сотрудников.
- **Техническая поддержка.** Обращения пользователей с вложениями и перепиской.
- **Отчётность.** Ежемесячные отчёты по занятиям и тарифам. Акты социальных услуг в формате XLSX по шаблону формируются в браузере (ExcelJS).

---

## Стек

| Слой | Технологии |
| --- | --- |
| Backend | Go 1.27 (toolchain 1.27.1), Gin 1.12, GORM 1.31 + pgx 5 |
| Аутентификация | JWT (HS256, golang-jwt v5) в httpOnly cookies, bcrypt |
| База данных | PostgreSQL 15.19 |
| Сессии, rate limit | Redis 7.4 (AOF), go-redis v9 |
| Frontend | React 19, Vite 8, React Router 7, MUI 7, Sass, Axios, ExcelJS |
| Тесты | Go `testing` + testify + miniredis; Vitest + Testing Library |
| Контейнеры | Docker Compose; образы `golang:1.27.1-alpine` → `alpine:3.23`, `node:24.21.0-alpine` → `nginx:1.30.5-alpine` |
| Delivery и сервер | GitHub Actions, Ansible, host Nginx + Certbot, restic, systemd |

Точные версии зависимостей зафиксированы в `backend/go.mod`, `frontend/package-lock.json`, Dockerfile и Compose-файлах.

---

## Архитектура

```text
Browser
   │  HTTPS
   ▼
Host Nginx (только production: TLS, HSTS, rate limit auth-endpoints)
   │
   ├── /            → frontend  (Nginx: статическая сборка SPA)
   └── /api, /uploads → backend (Go + Gin)
                          │
          ┌───────────────┼──────────────────┐
          ▼               ▼                  ▼
     PostgreSQL         Redis          Docker volumes
                                 (публичные и приватные файлы)
```

- Монолитный backend (REST/JSON API) и отдельная SPA. Frontend обращается к API по адресу, который встраивается в сборку (`VITE_API_URL`).
- В production PostgreSQL и Redis подключены только к внутренней сети `data-network` и не публикуют порты.
- Backend при старте подключается к PostgreSQL и Redis, применяет миграции, регистрирует маршруты и запускает фоновые задачи: напоминания о сроках, рассылки VK. По SIGINT/SIGTERM сервер завершает запросы (таймаут 30 с) и останавливает фоновые задачи.
- Handlers работают с GORM напрямую, отдельного repository-слоя нет. Сложная логика — генерация и проверка расписания, уведомления, отчётность — вынесена в `internal/services`.

## Структура репозитория

```text
backend/
  cmd/main.go            точка входа: конфигурация, зависимости, маршруты,
                         фоновые задачи, graceful shutdown
  internal/
    config/              загрузка переменных окружения
    database/            подключение, миграции, встроенные SQL-миграции
    handlers/            HTTP-обработчики и handler-тесты
    services/            расписание, уведомления (email, VK), отчётность
    middleware/          аутентификация, RBAC, rate limit, security headers
    models/              GORM-модели
    logging/             access log, журнал административных изменений
    utils/               JWT и вспомогательные функции
frontend/
  src/                   React-приложение
  public/                статические файлы и XLSX-шаблоны
  nginx.conf             раздача SPA внутри контейнера
infrastructure/
  ansible/               конфигурация production-сервера
  CI.md, CD.md           описание CI и процесса релиза
  DEPENDENCY_MAINTENANCE.md
.github/
  workflows/ci.yml       проверки
  workflows/release.yml  ручной production-релиз
  dependabot.yml
docker-compose.yml       базовая конфигурация сервисов
docker-compose.dev.yml   локальная разработка: порты, debug-режим
docker-compose.prod.yml  production: без внешних портов, лимиты, фиксированные IP
Makefile
```

---

## Требования

- Docker с Compose v2 — для запуска стека.
- Для проверок вне Docker: Go 1.27.1, Node.js 24.21.0 (`frontend/.nvmrc`) и npm.
- Для работы с сервером: Ansible и коллекции из `infrastructure/ansible/requirements.yml`.

## Быстрый старт

1. Создайте конфигурацию backend и задайте в ней `JWT_SECRET` (не короче 32 символов, например `openssl rand -hex 32`) и пароль базы данных:

   ```bash
   cp backend/.env.example backend/.env
   ```

2. Создайте в корне репозитория файл `.env` для подстановки переменных в Compose. Значения должны совпадать с `backend/.env`:

   ```dotenv
   DB_NAME=reviews_db
   DB_USER=postgres
   DB_PASSWORD=<тот же пароль, что в backend/.env>
   REDIS_PASSWORD=
   ```

   Корневой `.env.example` устарел: он содержит переменные, которые не используются (`REACT_APP_*`, `DIRECTUS_*`). Ориентируйтесь на список выше.

3. Запустите стек:

   ```bash
   make up      # или make up-d — в фоне
   ```

| Сервис | Адрес |
| --- | --- |
| Frontend | http://localhost:3000 |
| API | http://localhost:8080/api |
| Health check | http://localhost:8080/api/health |
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |

Остановка без удаления данных — `make down`. Все команды — `make help`. `docker compose down -v` удаляет volumes вместе с базой и файлами.

## Конфигурация

| Где | Переменные | Назначение |
| --- | --- | --- |
| `backend/.env` | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL |
| `backend/.env` | `JWT_SECRET`, `FRONTEND_URL`, `IS_PRODUCTION`, `PORT` | Аутентификация, CORS, Secure-cookies |
| `backend/.env` | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` | Redis |
| `backend/.env` | `EMAIL_FROM`, `EMAIL_PASSWORD`, `SMTP_HOST`, `SMTP_PORT` | Отправка email |
| `backend/.env` | `VK_COMMUNITY_TOKEN`, `VK_API_VERSION` | Уведомления VK; без токена отключены |
| `.env` (корень) | `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `REDIS_PASSWORD` | Подстановка в Compose |
| build arg / `frontend/.env` | `VITE_API_URL` | Адрес API, встраивается в сборку frontend |

- Без `JWT_SECRET` длиной от 32 символов backend не запускается. Остальные переменные имеют значения по умолчанию: `backend/internal/config/config.go`.
- `FRONTEND_URL` — единственный origin, разрешённый CORS.
- Переменные `VITE_*` попадают в браузерную сборку, поэтому секретов в них быть не должно. `frontend/.env` нужен только при запуске Vite вне Docker.
- Шаблон production-конфигурации: `backend/.env.production.example`.

## База данных и миграции

Отдельной команды миграции нет: миграции применяются автоматически при каждом старте backend (`database.Migrate`).

- Схема основных таблиц создаётся через GORM AutoMigrate. Перед ним и после него выполняются идемпотентные SQL-исправления и создаются уникальные индексы.
- Версионные SQL-миграции отчётности лежат в `backend/internal/database/migrations/reporting/`. Они встроены в бинарник, применяются один раз в транзакции под advisory lock, а их контрольные суммы записываются в `reporting_schema_migrations`.
- Down-миграций нет, изменения только вперёд. Поэтому откат приложения безопасен, только пока предыдущая версия совместима с текущей схемой (см. `infrastructure/CD.md`).

## Разработка

- **Backend вне Docker:** поднимите зависимости (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis`). В `backend/.env` укажите `DB_HOST=localhost`, `DB_PORT=5433`, `REDIS_HOST=localhost` и выполните `cd backend && go run ./cmd`.
- **Frontend вне Docker:** `cd frontend && nvm use && npm ci && npm start`. Vite по умолчанию слушает порт 5173, поэтому для работы с API задайте `FRONTEND_URL=http://localhost:5173` в `backend/.env`.
- Go-код форматируется `gofmt`. Коммиты оформляются в стиле Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:` …).

## Тестирование и проверки

```bash
make test                      # go test ./... + production-сборка frontend
cd backend && go test ./...    # все Go-тесты
cd backend && go vet ./...
cd frontend && npm test        # Vitest
cd frontend && npm run build
```

- Handler-тесты работают с реальным PostgreSQL. Каждый тест выполняется в транзакции, которая откатывается. Тесты допускают только loopback-хост и имя базы с окончанием `_test`; без доступной базы пакет пропускается. Redis заменён in-process miniredis. Подробности — [backend/TESTING.md](backend/TESTING.md).
- `make test` не запускает `npm test` — frontend-тесты запускаются отдельно.
- Отдельный линтер (golangci-lint, ESLint) не настроен. `govulncheck` и `npm audit` выполняются вручную при обновлении зависимостей ([DEPENDENCY_MAINTENANCE.md](infrastructure/DEPENDENCY_MAINTENANCE.md)).

## Docker

- **Сети:** `app-network` (frontend, backend) и `data-network` (backend, PostgreSQL, Redis). В production `data-network` внутренняя.
- **Volumes:** `postgres_data`, `redis_data`, `uploads_data` (публичные файлы), `private_uploads_data` (приватные документы).
- **Health checks** есть у всех сервисов. Backend стартует только после готовности PostgreSQL и Redis, frontend — после готовности backend.
- **Production overrides** (`docker-compose.prod.yml`): порты не публикуются, host Nginx обращается к контейнерам по фиксированным IP. Также `restart: unless-stopped`, лимиты памяти и процессов, `no-new-privileges`, пароль Redis и `maxmemory` с политикой `noeviction`, часовой пояс `Asia/Yekaterinburg`.
- **Логи:** backend пишет их в stdout и дублирует в ротационный файл `./logs` внутри контейнера (20 MiB × 5). Volume для этого каталога не подключён, поэтому основной источник — stdout. На сервере Ansible настраивает для Docker драйвер `json-file` с ротацией.

---

## CI/CD

Рабочий процесс: разработка в `develop`, релиз — из `main`.

### Continuous Integration

`.github/workflows/ci.yml` запускается на push и pull request в `develop` и `main`, а также вручную:

- **Backend:** `go mod verify`, `go test ./...`, `go vet ./...`. Для handler-тестов поднимается временный PostgreSQL 15.19 со случайным паролем. `REQUIRE_TEST_DB=1` не даёт тестам незаметно пропуститься.
- **Frontend:** `npm ci`, `npm test`, `npm run build`.
- **Docker:** сборка образов backend и frontend без публикации — после успешных тестов.

Workflow работает с правами только на чтение и не получает production-секретов; сторонние Actions закреплены по commit SHA. В CI сейчас не входят линтеры, `govulncheck`, race detector и отчёт о покрытии. Подробнее — [infrastructure/CI.md](infrastructure/CI.md).

Dependabot раз в месяц открывает pull request в `develop` для Go, npm, Docker-образов и GitHub Actions. Minor- и patch-обновления группируются.

### Deployment

Production-релиз выполняется вручную: `.github/workflows/release.yml`, ввод подтверждения `DEPLOY`. Push в `main` сервер не меняет.

1. Workflow проверяет, что запущен на текущем коммите `main` и для него есть успешный прогон CI.
2. Собирает образы backend и frontend с тегом и OCI-меткой ревизии, упаковывает их в архив и считает SHA-256.
3. Передаёт архив на сервер отдельной SSH-учётной записи `deploy`. Её forced command разрешает только `status`, `health`, `release` и `rollback`.
4. На сервере `rassvet-release`:
   - проверяет размер, контрольную сумму и ревизию образов;
   - делает зашифрованную резервную копию;
   - пересоздаёт контейнеры backend и frontend (PostgreSQL и Redis не затрагиваются);
   - ждёт health checks контейнеров и публичного `/api/health`.
   При неудаче автоматически возвращает предыдущие образы.

Контейнеры обновляются пересозданием, без blue-green, поэтому zero-downtime не гарантируется. Ручной откат к сохранённой ревизии — командой `rollback` (с учётом совместимости схемы БД). Подробнее — [infrastructure/CD.md](infrastructure/CD.md).

### Ansible

`infrastructure/ansible/` описывает единственный production-сервер. Роли: `common`, `docker`, `security`, `nginx`, `application`, `deployment`, `backup`, `monitoring`:

- пакеты и автоматические security-обновления;
- Docker и ротация его логов;
- SSH hardening, UFW, fail2ban, rate limit в Nginx;
- host Nginx и Certbot;
- systemd-unit приложения;
- ограниченная учётная запись `deploy` и release/rollback entrypoint;
- резервное копирование restic;
- мониторинг по таймеру.

Ansible **не выполняет релиз**, не запускает приложение и не управляет `.env`, TLS-ключами и пользовательскими файлами. Секреты хранятся в Ansible Vault (`group_vars/vault.yml`, в Git только `vault.example.yml`). Изменения применяются только после `--check --diff` и по отдельным tags. Подробнее — [infrastructure/ansible/README.md](infrastructure/ansible/README.md).

---

## Эксплуатация и мониторинг

- `GET /api/health` проверяет PostgreSQL и Redis и возвращает `503`, если одна из зависимостей недоступна. Endpoint используют health check контейнера, релизный скрипт и серверный мониторинг.
- Логи — текстовые строки с префиксами: `[HTTP]` — access log с пользователем, `[ADMIN-AUDIT]` — административные изменения «было/стало», `[EVENT]`, `[JOB]` — фоновые задачи, `[CLIENT-ERROR]` — ошибки браузера. Metrics и tracing не используются.
- Серверный мониторинг (таймер каждые 5 минут) проверяет диск, inodes, память, OOM, systemd, контейнеры, HTTPS health, срок сертификата и возраст резервной копии. Результат пишется в `/run/rassvet-monitor/status` и journald; внешний heartbeat — опционально.
- **Резервные копии:** restic с шифрованием, ежедневно в 02:00 и перед каждым релизом или откатом. В копию входят dump PostgreSQL, файлы пользователей, каталог приложения и конфигурация сервера (Nginx, SSH, fail2ban, UFW, Docker, сертификаты). Хранение: 7 дневных, 4 недельных и 6 месячных копий; еженедельно выполняется выборочная проверка целостности. Repository пока находится на том же диске, что и production, — off-site копия не настроена. Восстановление — [infrastructure/ansible/RESTORE.md](infrastructure/ansible/RESTORE.md).

## Безопасность

- Access token (30 минут) и refresh token (7 дней, ротация, хранение в Redis) передаются в httpOnly cookies с `SameSite=Lax`; `Secure` включён в production. Logout и смена пароля отзывают сессии через Redis.
- RBAC: `/api/admin/*` доступен только администраторам. Создание администраторов — только для суперадминистратора.
- Rate limit по IP и маршруту в Redis для публичных чувствительных endpoints. На host Nginx дополнительно ограничены auth-endpoints.
- CORS разрешает один origin с credentials. Security headers (CSP, `X-Frame-Options`, HSTS на host Nginx).
- Загрузки проверяются по расширению и содержимому (MIME sniffing). Приватные документы доступны только через аутентифицированные endpoints с проверкой владельца.
- Секреты не хранятся в Git: `.env` игнорируется, серверные секреты находятся в Ansible Vault и в GitHub Actions secrets (только ключ `deploy`).

## Документация

| Документ | Содержание |
| --- | --- |
| [backend/TESTING.md](backend/TESTING.md) | Изоляция и запуск handler-тестов |
| [backend/REPORTING.md](backend/REPORTING.md) | Модель данных и API месячной отчётности |
| [backend/STAFF_NOTIFICATIONS.md](backend/STAFF_NOTIFICATIONS.md) | Напоминания сотрудникам и рассылка расписания в VK |
| [frontend/README.md](frontend/README.md) | Сборка и проверки frontend |
| [infrastructure/CI.md](infrastructure/CI.md) | Continuous Integration |
| [infrastructure/CD.md](infrastructure/CD.md) | Релиз, модель безопасности, откат |
| [infrastructure/DEPENDENCY_MAINTENANCE.md](infrastructure/DEPENDENCY_MAINTENANCE.md) | Версии и обновление зависимостей |
| [infrastructure/ansible/README.md](infrastructure/ansible/README.md) | Конфигурация сервера |
| [infrastructure/ansible/RESTORE.md](infrastructure/ansible/RESTORE.md) | Восстановление из резервной копии |
