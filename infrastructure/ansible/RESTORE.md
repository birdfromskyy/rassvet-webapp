# Восстановление restic backup

Repository на текущем сервере:

```text
/var/backups/rassvet-restic
```

Recovery-копия пароля на доверенном Mac:

```text
prod_backups/2026-09-19_sre-baseline/credentials/restic-password
```

Пароль также необходимо вручную сохранить в менеджере паролей. Без него расшифровать repository невозможно.

## Проверка repository

На сервере:

```bash
export RESTIC_REPOSITORY=/var/backups/rassvet-restic
export RESTIC_PASSWORD_FILE=/etc/rassvet-backup/restic-password
export RESTIC_CACHE_DIR=/var/cache/restic

restic snapshots
restic check --read-data
```

## Восстановление в отдельный каталог

Никогда не восстанавливать сразу поверх работающего production.

```bash
install -d -m 0700 /var/lib/rassvet-manual-restore

restic restore latest \
  --host rassvet-production \
  --tag files \
  --target /var/lib/rassvet-manual-restore/files

restic restore latest \
  --host rassvet-production \
  --tag database \
  --target /var/lib/rassvet-manual-restore/database
```

PostgreSQL custom dump окажется здесь:

```text
/var/lib/rassvet-manual-restore/database/database/reviews_db.dump
```

Проверка dump без импорта:

```bash
docker exec -i postgres pg_restore --list \
  < /var/lib/rassvet-manual-restore/database/database/reviews_db.dump
```

## Восстановление PostgreSQL

Импортировать только в новую или явно подготовленную пустую БД. Нельзя молча заливать dump поверх production.

Пример для отдельной test database:

```bash
docker exec postgres sh -lc \
  'createdb -U "$POSTGRES_USER" reviews_db_restore_test'

docker exec -i postgres sh -lc \
  'pg_restore -U "$POSTGRES_USER" -d reviews_db_restore_test --clean --if-exists' \
  < /var/lib/rassvet-manual-restore/database/database/reviews_db.dump
```

Перед использованием команды нужно проверить имя контейнера, пользователя, свободное место и отсутствие совпадения с production database.

## Новый сервер

1. Установить ту же проверенную версию restic.
2. Доставить encrypted repository или подключить его диск.
3. Создать root-only password file из recovery-копии.
4. Выполнить `restic check --read-data`.
5. Восстановить files и database в отдельный каталог.
6. Проверить Compose, `.env`, Nginx и volumes.
7. Развернуть пустую PostgreSQL и импортировать custom dump.
8. Запустить приложение и проверить `/api/health` до переключения DNS/traffic.

Текущий repository расположен на том же диске, что и production, поэтому не переживёт потерю всей VM. Добавление off-site backend остаётся отдельным будущим этапом.
