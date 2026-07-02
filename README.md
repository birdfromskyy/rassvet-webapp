# Rassvet

Веб-приложение для управления учебным центром. Охватывает расписание занятий, учёт посещаемости, документооборот, управление пользователями и публичный сайт с собственной CMS.

---

## Стек

| Компонент | Технология | Dev-порт |
|---|---|---|
| Backend API | Go 1.24 + Gin | 8080 |
| Frontend SPA | React 19 + MUI v7 | 3000 |
| База данных | PostgreSQL 15 | 5433 (хост) / 5432 (контейнер) |
| Кэш / сессии | Redis 7 | 6379 |

---

## Быстрый старт

```bash
# Создать backend/.env
cat > backend/.env << 'EOF'
DB_HOST=postgres
DB_USER=postgres
DB_PASSWORD=secret123
DB_NAME=reviews_db
DB_PORT=5432
JWT_SECRET=your-super-secret-key-minimum-32-characters!
PORT=8080
FRONTEND_URL=http://localhost:3000
EMAIL_FROM=your@gmail.com
EMAIL_PASSWORD=app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
REDIS_HOST=redis
REDIS_PORT=6379
EOF

# Создать frontend/.env
echo "REACT_APP_API_URL=http://localhost:8080/api" > frontend/.env

# Первый запуск
docker-compose up --build

# Повторный запуск
docker-compose up
```

После запуска:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api
- PostgreSQL: localhost:5433

Дебаггинг:
```bash
docker-compose logs -f backend
docker exec -it postgres psql -U postgres -d reviews_db
docker exec -it redis redis-cli KEYS '*'
```

---

## Архитектура

### Backend (Go)

```
cmd/main.go                        — инициализация, маршруты, CORS, фоновый job
internal/config/config.go          — загрузка .env
internal/database/                 — GORM (PostgreSQL) + Redis, AutoMigrate 36 моделей
internal/middleware/
    auth.go                        — AuthMiddleware, AdminMiddleware
    ratelimit.go                   — rate limit через Redis Lua-скрипт
    security.go                    — заголовки безопасности
internal/models/                   — 36 GORM-моделей
internal/handlers/                 — HTTP-хендлеры (29 файлов)
internal/services/
    schedule_generator.go          — жадный алгоритм генерации расписания (~1900 строк)
    schedule_validator.go          — проверка конфликтов слотов
    email.go                       — SMTP + HTML-шаблоны
internal/utils/jwt.go              — генерация / валидация токенов (HS256)
```

Хендлеры работают с `*gorm.DB` напрямую — без repository-слоя. Service-слой только для сложных алгоритмов (расписание, email). Все маршруты регистрируются вручную в `main.go`.

### Frontend (React)

```
src/App.js          — роутинг + AuthContext
src/contexts/       — AuthContext (isAuthenticated, user, login/logout)
src/services/       — API-клиенты (Axios instance, 14 файлов)
src/pages/          — ~61 страница
src/components/     — переиспользуемые компоненты
```

JWT хранится в httpOnly cookie (не в localStorage). Axios отправляет cookie автоматически через `withCredentials: true`. Interceptor при 401 автоматически пробует обновить токен через `POST /api/refresh`, при неудаче — редирект на `/login`. Защита роутов через `<PrivateRoute>` и `<AdminRoute>`.

---

## Аутентификация

Двухтокенная схема: access-токен (30 мин, JWT HS256) + refresh-токен (7 дней, UUID в Redis). Оба — в httpOnly cookie. При logout токен попадает в Redis-blacklist и немедленно инвалидируется.

Регистрация двухэтапная: сначала 6-значный код отправляется на email и хранится в Redis 15 мин, после ввода кода создаётся пользователь в БД.

Роли: `user`, `teacher`, `admin`, `superadmin`.

---

## Функциональность

### Пользователи и безопасность
- Регистрация с подтверждением email
- Вход / выход, JWT в httpOnly cookie, Redis blacklist
- Восстановление пароля (временный пароль отправляется на почту)
- Удаление своего аккаунта
- Rate limit на публичных эндпоинтах (Redis Lua-скрипт, атомарный)

### Расписание
- Предметы, кабинеты, преподаватели, ученики — CRUD с деактивацией
- Привязки: предмет → кабинет, предмет → преподаватель, кабинет → преподаватель (с флагом `is_strict`)
- Окна доступности преподавателей и учеников (пн–вс, 1–7)
- Назначения (ученик + преподаватель + предмет): тип финансирования, число занятий в неделю, длительность
- Групповые занятия с записью учеников
- Автоматическая генерация расписания и асинхронная генерация (статус через polling)
- Ручные слоты с проверкой конфликтов
- Утверждение / сброс авто-части расписания (ручные слоты сохраняются)
- Резервная копия авто-слотов перед перегенерацией
- Отметка посещаемости групповых занятий
- Просмотр расписания преподавателями и родителями учеников

### Алгоритм генерации
Жадный алгоритм с многовариантным перебором: 7 вариантов порядка обработки задач × несколько комбинаций допустимых интервалов между занятиями. Каждый вариант запускается полностью и независимо; выбирается результат с наибольшим числом размещённых занятий.

Приоритет при размещении: платники → ученики со строгими кабинетами → ученики с наименьшим суммарным окном доступности. Скоринг кандидатов: бонус за соблюдение интервала между занятиями одного ученика, бонус за раннее время.

### Документооборот
- Анкетирование (загрузка бланка, администратор одобряет/отклоняет)
- Профиль родителя и документы детей (ИППСУ и др.)
- Отслеживание срока действия ИППСУ фоновым job (раз в 24 ч), уведомления при истечении
- Приватное хранилище: файлы доступны только через аутентифицированный endpoint

### Публичный сайт и CMS
- Страницы: главная, о нас, педагоги, услуги, новости, контакты
- CMS: статьи (slug, блоки контента), преподаватели, достижения, награды, вакансии, видео-шортсы, исторические события, услуги, финансовые зоны, настройки сайта
- Консультации (гостевые и от авторизованных пользователей)
- Отзывы с модерацией (pending → approved / rejected), анонимный режим

### Отчёты
Ежемесячные отчёты по проведённым занятиям: фильтрация по преподавателю, ученику, периоду. Часы рассчитываются с учётом посещаемости.

### Уведомления
Уведомления для пользователей (внутри системы): отметка прочтения, удаление.

---

## База данных

PostgreSQL 15, база `reviews_db`. GORM AutoMigrate при каждом запуске — только additive (не удаляет колонки). 36 моделей.

Основные таблицы: `users`, `teachers`, `students`, `assignments`, `schedules`, `schedule_slots`, `group_lessons`, `group_lesson_enrollments`, `group_lesson_attendance`, `rooms`, `subjects`, `notifications`, `consultation_requests`, `child_doc_submissions`, `articles`, `article_blocks`, `site_settings` и др.

---

## Production

Разворачивается на Ubuntu 24.04 через Docker Compose (prod override):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Nginx на хосте проксирует `/api/*` и `/uploads/*` на backend-контейнер, остальное — на frontend-контейнер. SSL через Let's Encrypt. Бэкапы БД ежедневно в 03:00, хранятся 7 дней.
