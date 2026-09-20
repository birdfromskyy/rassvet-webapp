# Ansible: Rassvet production infrastructure

Этот playbook фиксирует текущее устройство единственного production-сервера. Он не выполняет deployment приложения и не должен запускаться без проверки diff/check mode.

Инструкция по расшифровке и восстановлению находится в [RESTORE.md](RESTORE.md).

## Что управляется

- базовые host packages и unattended security updates;
- Docker CE repository, daemon logging и service;
- UFW, fail2ban, Nginx rate limiting и текущий key-only SSH hardening;
- ограниченная техническая учётная запись `deploy` без Docker group и общего
  sudo-доступа;
- host Nginx и Certbot packages;
- systemd unit Docker Compose приложения и отдельный release/rollback entrypoint;
- encrypted restic backup и systemd timers.
- bounded journald storage и лёгкие host/application health checks по timer.

Application code, `.env`, TLS private keys и пользовательские файлы в Git не входят.

## Первый запуск

```bash
cd infrastructure/ansible
ansible-galaxy collection install -r requirements.yml
cp inventory/production.example.yml inventory/production.yml
cp group_vars/vault.example.yml group_vars/vault.yml
ansible-vault encrypt group_vars/vault.yml
```

В `vault_restic_password` необходимо записать существующий пароль из локального файла:

```text
prod_backups/2026-09-19_sre-baseline/credentials/restic-password
```

В `vault_admin_password_hash` записывается SHA-512 crypt hash отдельного пароля
`birdfromsky` для `sudo` и VNC-консоли. Открытый пароль хранится только в
менеджере паролей и в локальном recovery-файле, не в Ansible Vault и не в Git.
Контроллер также должен иметь публичный ключ `~/.ssh/rassvet_key.pub`.
Отдельная пара `~/.ssh/rassvet_deploy_key{,.pub}` используется только для
технической учётной записи. Её forced command допускает `status`, `health`,
передачу проверенного release и rollback к сохранённой revision. Единственное
право sudo ограничено root-owned entrypoint `/usr/local/sbin/rassvet-release`;
произвольные команды, Docker CLI и запись в `/opt/rassvet` недоступны.

Сначала всегда:

```bash
ansible-playbook site.yml --check --diff --ask-become-pass \
  --private-key ~/.ssh/rassvet_key
```

Применение разрешается только по отдельным tags и после просмотра diff:

```bash
ansible-playbook site.yml --tags backup --ask-become-pass \
  --private-key ~/.ssh/rassvet_key
```

Не запускать весь `site.yml` на production вслепую.

## Безопасные значения по умолчанию

- timezone сервера управляется Ansible и зафиксирована как
  `Asia/Yekaterinburg` (`manage_timezone: true`);
- `birdfromsky` создаётся до применения SSH hardening, а его пароль задаётся
  только при первом создании пользователя;
- root SSH отключён (`PermitRootLogin no`); не применять роль `security` без
  проверенного ключа `birdfromsky`, sudo-пароля и доступа к FirstVDS VNC;
- SSH forwarding отключён; вход разрешён только `birdfromsky` и `deploy`;
- первый fail2ban-бан длится один час после 8 ошибок за 10 минут, повторные
  нарушения увеличивают срок вплоть до суток;
- отдельный Nginx jail блокирует повторяющиеся обращения к типовым scanner
  paths, а auth endpoints ограничены по частоте на уровне host Nginx;
- application service не запускается Ansible автоматически;
- Ansible не выполняет release: он только устанавливает проверяемый deployment
  entrypoint; запуск остаётся отдельным ручным действием GitHub Actions;
- restic password обязателен из Ansible Vault и скрыт через `no_log`.
- monitoring каждые пять минут проверяет disk/inodes/RAM/OOM, systemd,
  контейнеры, HTTPS health, сертификат и возраст последнего backup; результат
  доступен root в `/run/rassvet-monitor/status` и в journald;
- внешний heartbeat опционален через `vault_monitor_heartbeat_url`; до его
  настройки UptimeRobot продолжает независимо контролировать HTTPS сайта.

Этапы создания администратора, запрета root SSH, настройки web hardening и
перехода host/containers на `Asia/Yekaterinburg` выполнены 19 сентября 2026
года и отражены в текущих переменных. Docker Compose дополнительно разделяет
внешнюю application network и внутреннюю data network; PostgreSQL и Redis не
подключены к application network и не публикуют порты на host.
