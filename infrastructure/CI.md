# Continuous Integration

CI проверяет изменения в ветках `develop` и `main`, но ничего не развёртывает и
не подключается к production-серверу.

## Проверки

- Backend: проверка модулей, `go test ./...`, `go vet ./...`.
- Handler integration tests используют временную PostgreSQL внутри GitHub
  runner. `REQUIRE_TEST_DB=1` запрещает незаметно пропустить их при ошибке БД.
- Frontend: установка строго по lock-файлу, Vitest и production-сборка Vite.
- Docker: независимая сборка backend и frontend без публикации образов.

Workflow имеет только право чтения содержимого репозитория. Production secrets,
SSH-ключи, `.env` и доступ к серверу ему не нужны. Все сторонние Actions
закреплены полными commit SHA; Dependabot проверяет их обновления ежемесячно.

Для тестовой PostgreSQL при каждом запуске создаётся новый случайный 48-байтовый
пароль. Он маскируется средствами GitHub Actions, существует только внутри
задания и уничтожается вместе с временным контейнером. В репозитории нет
пароля-заглушки или постоянного CI-пароля, а production credentials никогда не
передаются в workflow.

## Ветки и обязательные проверки

После первого успешного запуска в настройках GitHub рекомендуется защитить
`main` и потребовать прохождение следующих checks перед merge:

- `Backend`;
- `Frontend`;
- `Docker / backend`;
- `Docker / frontend`.

Для `develop` можно потребовать как минимум `Backend` и `Frontend`. При работе в
одиночку pull request review не обязателен: важнее запретить merge при красном
CI. Прямой push следует запрещать только после проверки, что выбранный GitHub
plan позволяет удобный аварийный порядок работы.

## Локальный эквивалент

```bash
cd backend
go mod verify
go test ./...
go vet ./...

cd ../frontend
npm ci
npm test
npm run build

cd ..
docker build -t rassvet-backend-ci ./backend
docker build -t rassvet-frontend-ci ./frontend
```

Локальные handler-тесты без PostgreSQL могут быть пропущены. В CI это невозможно:
там тестовая БД обязательна и полностью отделена от production.

## Граница этапа

Этот workflow не содержит CD. Подключение GitHub Secrets, SSH, пользователя
`deploy`, registry и production deploy относится к отдельному этапу 14 и не
должно добавляться в `ci.yml`.
