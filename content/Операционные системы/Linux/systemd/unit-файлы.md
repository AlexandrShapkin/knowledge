---
title: unit-файлы
draft: false
tags:
  - systemd
  - linux
  - administration
  - production
  - сервисы
  - unit-files
---
**systemd** — это менеджер системы и служб (init-система) для Linux, который управляет запуском и контролем процессов через декларативные unit-файлы. Unit-файл описывает, как запускать, перезапускать, ограничивать и связывать сервис/таймер/сокет/target и т.д.

## Основные концепции
- unit — декларативный объект конфигурации (service, socket, target, timer, mount, swap, device, slice и т.д.).
- cgroup — systemd запускает юниты в cgroup и управляет ресурсами через контроллеры (CPU, memory, io).
- dependency — зависимости между юнитами (Requires, Wants, After, Before).
- target — логический «сборочный» юнит для группировки служб (аналог runlevel).
- drop-in / override — фрагменты конфигурации для безопасного изменения OEM-юнитов без правки оригинала.
- template unit — шаблонный юнит (имя вида `name@.service`) для инстанцирования `name@instance.service`.

## Структура / состав
- `[Unit]` — метаданные и зависимости: Description, Documentation, Requires, Wants, Before, After, Conflicts, ConditionXYZ, AssertXYZ.
- `[Service]` — поведение сервиса: Type, ExecStart, ExecStartPre, ExecStartPost, ExecReload, ExecStop, Restart, RestartSec, PIDFile, KillMode, TimeoutStartSec, TimeoutStopSec, User, Group, Environment, EnvironmentFile, WorkingDirectory, RuntimeDirectory, ProtectSystem и др.
- `[Install]` — инсталляционные привязки: WantedBy, RequiredBy, Alias.
- дополнительные секции для socket, timer, mount и т.д. (например `[Socket]` для socket-юнита).

## Минимальные рабочие примеры
```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=MyApp service
After=network.target

[Service]
Type=simple
User=myapp
Group=myapp
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/bin/myapp
Restart=on-failure
RestartSec=5
LimitNOFILE=65536
Environment=NODE_ENV=production
EnvironmentFile=/etc/myapp/env
RuntimeDirectory=myapp
PIDFile=/run/myapp/myapp.pid
KillMode=control-group

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/myapp@.service
[Unit]
Description=MyApp instance %i
After=network.target

[Service]
Type=simple
User=myapp
WorkingDirectory=/opt/myapp/%i
ExecStart=/opt/myapp/%i/bin/myapp --instance=%i
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```ini
# socket activation example: /etc/systemd/system/myapp.socket
[Unit]
Description=MyApp socket

[Socket]
ListenStream=9000
Accept=no

[Install]
WantedBy=sockets.target
```

```ini
# timer example: /etc/systemd/system/backup.timer
[Unit]
Description=Daily backup timer

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

## Типичные операции / кейсы
- загрузка/применение изменений:
    - `systemctl daemon-reload`
    - `systemctl start/stop/restart myapp.service`
    - `systemctl enable/disable myapp.service`
    - `systemctl status myapp.service`
- просмотр свойств юнита:
    - `systemctl show myapp.service` / `systemctl show -p ExecMainPID -p ActiveState myapp.service`
- просмотр зависимостей:
    - `systemctl list-dependencies --reverse myapp.service`
    - `systemctl list-dependencies mytarget.target`
- переопределение конфигурации (drop-in):
    - `systemctl edit myapp.service` — создаёт `/etc/systemd/system/myapp.service.d/override.conf`
- создание инстанций шаблона:
    - `systemctl start myapp@instance1.service`
- socket-activation:
    - `systemctl start myapp.socket` — systemd будет слушать сокет и стартовать сервис при подключении
- временные юниты (run one-off):
    - `systemd-run --unit=oneoff --scope /path/to/cmd`
- диагностические команды:
    - `systemd-analyze blame`
    - `systemd-analyze critical-chain`

## Диагностика / ошибки
- Сервис не запускается (failed) — проверить `systemctl status myapp.service` и `journalctl -u myapp.service -b`; проверить ExitCode, ExecStart путь, права на бинарь, SELinux/AppArmor.
- Сервис в состоянии activating (start-процедура зависла) — проверить `Type=`; если `Type=forking`, убедиться в корректном PIDFile; проверить `TimeoutStartSec`.
- Сервис постоянно перезапускается (start-limit-hit) — проверить `StartLimitBurst`, `StartLimitIntervalSec`, `Restart=` и журнал ошибок; посмотреть `journalctl -u myapp.service` для причины падений.
- PID file отсутствует/неверный — при `Type=forking` systemd ожидает PIDFile; проверить путь и права; альтернативно использовать `Type=simple` или `Type=notify`.
- Невозможно остановить процесс (stopping hangs) — проверить `KillMode` (default control-group), `KillSignal`, `TimeoutStopSec`; при использовании forked-процессов убедиться, что дочерние в той же cgroup.
- Проблемы с доступом к файлам/порту — проверить `User/Group`, `CapabilityBoundingSet`, `AmbientCapabilities`, `PrivateTmp`, `ReadOnlyDirectories`, `BindPaths`, SELinux контекст.
- Сервис стартует, но не принимает трафик — если socket-активация: проверить `myapp.socket` и `Accept`/ListenStream`; проверить firewall и SELinux.
- Неправильные зависимости — сервис стартует в неверном порядке; проверить `After` vs `Requires` vs `Wants` (After только порядок, Requires — жёсткая зависимость).
- Юнит отключён (masked) — `systemctl is-enabled` и `systemctl status`; `systemctl unmask` если нужен запуск.
- Изменение юнита не применяется — забыли `systemctl daemon-reload` или изменения находятся в неверном каталоге; проверить приоритет каталогов (`/etc/systemd/system` > `/run/systemd/system` > `/lib/systemd/system`).
- Неправильный формат юнита — `systemd-analyze verify /etc/systemd/system/myapp.service` покажет синтаксис/ошибки.
- Ограничения ресурсов приводят к OOM/THROTTLE — проверить `MemoryAccounting`, `CPUAccounting`, `systemd-cgtop`, `dmesg` на OOM-killer; использовать `MemoryLimit`, `IOWeight` или cgroup v2 параметры.
- Сбой при загрузке сервера — посмотреть `systemd-analyze critical-chain` и `journalctl -b`.

## Практические рекомендации для production
- всегда задавать `Restart=on-failure`/`on-abnormal` и `RestartSec=...` для критичных сервисов; аккуратно выбирать `Restart=always` только если ожидается постоянная перезапускная политика.
- ограничивать частые рестарты: `StartLimitBurst`, `StartLimitIntervalSec`/`StartLimitInterval`. Использовать `OnFailure=` для отложенной реакции (уведомления, fallback units).
- для демонов, которые daemonize, избегать `Type=forking` если возможно; предпочтительнее `Type=notify` (если поддерживает sd_notify) или `Type=simple`.
- контролируйте ресурсы через systemd (cgroup): `MemoryMax`, `CPUQuota`, `TasksMax`, `IOWeight`.
- безопасность: `User=`, `Group=`, `CapabilityBoundingSet=`, `NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectSystem=strict`, `ProtectHome=true`, `ReadOnlyDirectories=`, `InaccessiblePaths=`, `SystemCallFilter=`. По необходимости добавлять минимальные capabilities через `AmbientCapabilities`.
- логирование: полагаться на journalctl; перенаправлять аналитические сообщения в stdout/stderr чтобы journal агрегировал. Не держать большие логи в памяти; настроить `ForwardTo=journal` или лог-роутинг на централизованный агрегатор.
- управление конфигурацией: править drop-in через `systemctl edit` вместо изменения поставляемых юнитов; хранить override-ы в конфиг-репозитории.
- тестирование: использовать `systemd-run --property=...` и контейнерные окружения для проверки ограничений; запускать в staging с теми же cgroup-параметрами.
- graceful shutdown: задавать `TimeoutStopSec`, `ExecStop` и `KillSignal` так, чтобы сервис корректно завершал работу; для DB/Stateful сервисов настроить `StopWhenUnneeded=no` и соответствующие зависимости.
- мониторинг: экспонировать readiness через sd_notify (Type=notify) или через socket-activation; проверять ливнесс/рединесс через systemd watchdog (`WatchdogSec` + приложение вызывает sd_notify("WATCHDOG=1")).
- обновления и миграции: при rolling deploy использовать `systemctl isolate`/targets и `Restart=on-failure` + `StartLimitBurst`/`StartLimitIntervalSec` под контролем CI/CD.

## Полезные команды (чеклист для отладки)
- `systemctl status myapp.service`
- `journalctl -u myapp.service --since "1 hour ago" --no-pager`
- `journalctl -b -p err` — ошибки с текущей загрузки
- `systemctl show -p MainPID -p ExecMainStatus myapp.service`
- `systemd-analyze verify /etc/systemd/system/myapp.service`
- `systemd-analyze blame`
- `systemd-analyze critical-chain`
- `systemctl list-dependencies --reverse myapp.service`
- `systemctl edit myapp.service`
- `systemctl daemon-reload && systemctl restart myapp.service`
- `systemctl mask myapp.service` / `systemctl unmask myapp.service`
- `systemd-cgtop` / `systemctl status` для cgroup info
- `systemd-run --unit=test --property=CPUQuota=20% /bin/sleep 60`

## Дополнительные материалы
- [https://www.freedesktop.org/wiki/Software/systemd/](https://www.freedesktop.org/wiki/Software/systemd/)
- man-страницы: `man systemd.unit`, `man systemd.service`, `man systemctl`, `man journalctl`, `man systemd.exec`