# Rassvet v0.1

Веб-приложение для управления расписанием учебного центра. Включает систему аутентификации, модерацию отзывов, новостной раздел через CMS и полноценную admin-панель для составления расписания.

---

## Стек

| Сервис | Технология | Порт |
|---|---|---|
| Backend API | Go 1.24 + Gin | 8080 |
| Frontend SPA | React 19 + MUI v7 | 3000 |
| База данных | PostgreSQL 15 | 5433 (хост) / 5432 (внутри контейнера) |
| Кэш / сессии | Redis 7 | 6379 |
| CMS | Directus 10.8 | 8055 |

---

## Быстрый старт

```bash
# Первый запуск
docker-compose up --build

# Повторный запуск
docker-compose up

# Только backend (без фронтенда)
docker-compose up postgres redis backend

# Логи backend
docker-compose logs -f backend

# Подключение к БД
docker exec -it postgres psql -U postgres -d reviews_db
```

После запуска:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api
- Directus CMS: http://localhost:8055
- Статический сайт: http://localhost:8080/main

Переменные окружения хранятся в `./backend/.env`.

---

## Архитектура

### Backend (Go)

```
cmd/main.go                        — инициализация, маршруты, CORS
internal/config/config.go          — загрузка env
internal/database/                 — PostgreSQL (GORM) + Redis
internal/middleware/auth.go        — JWT + AdminMiddleware
internal/models/                   — GORM-модели
internal/handlers/                 — HTTP-хендлеры
internal/services/
    schedule_generator.go          — алгоритм генерации расписания
    schedule_validator.go          — проверка конфликтов
    email.go                       — SMTP-отправка
internal/utils/jwt.go              — генерация / валидация токенов
```

Хендлеры работают с `*gorm.DB` напрямую — без repository-слоя. Services-слой используется только для сложных алгоритмов. Маршруты регистрируются вручную в `main.go`.

### Frontend (React)

```
src/services/       — API-клиенты (axios)
src/pages/          — страницы (роуты)
src/components/     — переиспользуемые компоненты
src/App.js          — роутинг + стейт аутентификации
```

JWT хранится в `localStorage`. Axios interceptor автоматически добавляет `Authorization: Bearer <token>`. При 401 — редирект на `/login`. Защита роутов через `<PrivateRoute>` и `<AdminRoute>`.

---

## Функциональность

### Реализовано

- Регистрация с подтверждением email (код → Redis → создание пользователя)
- Вход / выход, JWT, role-based access (`user` / `admin`)
- Восстановление пароля через email
- Обновление профиля
- CRUD отзывов с модерацией (`pending` → `approved` / `rejected`)
- Новости через Directus (фронтенд обращается к Directus напрямую)
- Admin-панель: предметы, кабинеты, преподаватели, ученики, назначения
- Окна доступности преподавателей и учеников
- Связи M2M: `teacher_subjects`, `room_subjects`
- Генерация расписания с учётом окон, конфликтов и кабинетов
- Утверждение / сброс расписания
- Ручные слоты, pause/resume назначений
- Деактивация (soft) и удаление (hard) сущностей

### Известные ограничения

- Нет публичной страницы расписания для учеников
- Нет UI для переопределений назначений на неделю (`assignment_week_overrides`)
- Сброс пароля возвращает временный пароль в JSON-ответе (не отправляет на email)
- JWT не инвалидируется при logout (нет blacklist в Redis)
- Нет проверки конфликтов при добавлении ручных слотов
- Списки без пагинации

---

## API

Все эндпоинты с префиксом `/api`. Защищённые маршруты требуют `Authorization: Bearer <jwt>`. Admin-маршруты дополнительно проверяют `role == "admin"`.

### Публичные

| Метод | URL | Описание |
|---|---|---|
| POST | `/register` | Регистрация, отправка кода на email |
| POST | `/verify-email` | Подтверждение кода, создание пользователя |
| POST | `/resend-code` | Повторная отправка (cooldown 60с) |
| POST | `/login` | Вход, возврат JWT |
| POST | `/forgot-password` | Запрос сброса пароля |
| POST | `/reset-password` | Сброс пароля по коду |

### Для авторизованных пользователей

`GET/PUT /me`, `GET/PUT /profile`, `POST /logout`, CRUD отзывов.

### Admin `/api/admin/...`

Полный CRUD для: отзывов, предметов, кабинетов, преподавателей, учеников, назначений, расписания и слотов.

---

## База данных

PostgreSQL содержит таблицы приложения **и** конфигурацию Directus CMS. Категорически запрещено выполнять `DROP DATABASE`, `DROP SCHEMA public CASCADE` или удалять docker-volume `postgres_data` — конфигурация Directus не восстанавливается без ручной перенастройки.

GORM AutoMigrate запускается при старте приложения.

---

## Структура проекта

```
Rassvet2/
├── docker-compose.yml
├── backend/.env
├── init.sql
├── backend/
│   ├── cmd/main.go
│   ├── internal/
│   └── static/site/        # HTML-файлы Tilda
└── frontend/
    ├── src/
    └── Dockerfile
```
