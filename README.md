# Rassvet

Веб-приложение Центра развития детей «РАСсвет».

Проект объединяет публичный сайт центра и защищённую внутреннюю систему для родителей, преподавателей и администрации. Система используется для управления расписанием, документами, уведомлениями, контентом сайта и отчётностью.

Production: [rassvethm.ru](https://rassvethm.ru)

## Возможности

### Расписание

- ведение расписания занятий;
- учёт доступности участников;
- проверка конфликтов кабинетов и участников;
- ручное редактирование;
- асинхронная генерация расписания.

### Пользователи и доступ

Поддерживаются роли:

- родитель;
- преподаватель;
- администратор;
- суперадминистратор.

Авторизация построена на JWT и httpOnly cookies. Refresh-сессии и blacklist access-токенов хранятся в Redis.

### CMS

- управление блочным содержимым публичного сайта;
- документы;
- отзывы;
- заявки на консультацию;
- адаптивный публичный интерфейс.

### Уведомления

- уведомления внутри приложения;
- SMTP-рассылка;
- административные уведомления через сообщения сообщества VK;
- автоматические напоминания о сроках услуг.

### Отчётность

Система генерирует ежемесячные акты социальных услуг в формате XLSX по утверждённому шаблону.

---

## Стек

| Слой | Технологии |
| --- | --- |
| Frontend | React 19, React Router, MUI, Sass |
| Backend | Go 1.24, Gin, GORM |
| Database | PostgreSQL 15 |
| Cache / sessions | Redis 7, AOF |
| Infrastructure | Docker Compose, Nginx |
| XLSX | ExcelJS |

---

## Архитектура

```text
Browser
   │
   ▼
┌─────────────────────┐
│ Frontend            │
│ React + Nginx       │
└──────────┬──────────┘
           │ /api
           ▼
┌─────────────────────┐
│ Backend             │
│ Go + Gin            │
└──────┬──────┬───────┘
       │      │
       │      └───────────────┐
       ▼                      ▼
┌─────────────┐        ┌─────────────┐
│ PostgreSQL  │        │ Redis       │
│             │        │             │
└─────────────┘        └─────────────┘
       │
       ▼
┌─────────────────────┐
│ File storage        │
│ public / private    │
└─────────────────────┘
```

## Структура проекта

```text
backend/
  cmd/
    main.go

  internal/
    config/          конфигурация приложения
    database/        PostgreSQL, Redis и миграции
    handlers/        HTTP-обработчики
    middleware/      аутентификация, RBAC, rate limit,
                     security headers
    models/          GORM-модели
    services/        бизнес-логика и интеграции

frontend/
  src/               React-приложение
  public/            статические файлы и шаблоны XLSX

docker-compose.yml
docker-compose.dev.yml
docker-compose.prod.yml
```

## Локальный запуск

Требование: Docker Compose v2.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# В backend/.env задайте уникальный JWT_SECRET длиной не менее 32 символов.
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

| Сервис | Адрес |
| --- | --- |
| Frontend | http://localhost:3000 |
| API | http://localhost:8080/api |
| Health check | http://localhost:8080/api/health |
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |

Остановка локального стека без удаления volumes:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

## Конфигурация

Примеры переменных окружения: [backend/.env.example](backend/.env.example) и [frontend/.env.example](frontend/.env.example).

| Группа | Переменные |
| --- | --- |
| PostgreSQL | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| Аутентификация | `JWT_SECRET`, `FRONTEND_URL`, `IS_PRODUCTION` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB` |
| Email | `EMAIL_FROM`, `EMAIL_PASSWORD`, `SMTP_HOST`, `SMTP_PORT` |
| VK | `VK_COMMUNITY_TOKEN`, `VK_API_VERSION` |
| API для frontend | `REACT_APP_API_URL` |

Переменные с префиксом `REACT_APP_` встраиваются в браузерную сборку; секреты должны находиться только в `backend/.env`.

## Эксплуатация и надёжность

- `GET /api/health` проверяет PostgreSQL и Redis; при недоступности зависимости возвращает `503`.
- Production Compose не публикует наружу порты backend, PostgreSQL и Redis; контейнеры работают во внутренней Docker-сети с `restart: unless-stopped`.
- Redis использует AOF; PostgreSQL, Redis, публичные и приватные загрузки разделены по Docker volumes.
- Backend пишет логи в stdout и дублирует их в ротационные файлы `./logs` (20 MiB × 5).
- Фоновая задача ежедневно проверяет сроки услуг и создаёт идемпотентные напоминания за 21, 7 и 1 день, а также в день окончания.
- Аутентификация использует httpOnly cookie; refresh-сессии и blacklist access-токенов хранятся в Redis. Чувствительные публичные endpoints защищены rate limit.

## Проверка

```bash
# Go-тесты
cd backend && go test ./...

# Handler-тесты используют изолированную БД reviews_test и in-process Redis
cd backend && go test ./internal/handlers/ -v

# Production-сборка frontend
cd frontend && npm run build

# Тесты frontend
cd frontend && npm test
```

Описание изоляции handler-тестов: [backend/TESTING.md](backend/TESTING.md).
