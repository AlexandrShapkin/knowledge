---
title: Сбор метрик MikroTik через mktxp
draft: false
tags:
  - prometheus
  - mikrotik
  - mktxp
  - monitoring
---

MikroTik не умеет отдавать метрики в формате Prometheus напрямую. Для этого используется **[mktxp](https://github.com/akpw/mktxp)** — отдельный сервис, который:

1. Подключается к MikroTik API (порт 8728)
2. Запрашивает данные (интерфейсы, DHCP leases, ресурсы и т.д.)
3. Преобразует их в формат Prometheus
4. Отдаёт по HTTP на порту `49090`

Конфигурация роутера (IP, логин, пароль) хранится в SealedSecret `infrastructure/prometheus-stack/mikrotik-secret.yaml` — файл `mktxp.conf` зашифрован и безопасно хранится в git. В кластере Sealed Secrets контроллер расшифровывает его в обычный Secret, который монтируется в под через initContainer (копируется в `emptyDir`, чтобы mktxp мог обновлять файл при старте).

Prometheus обращается к mktxp по DNS-имени сервиса внутри кластера:

```yaml
- job_name: mikrotik
  static_configs:
    - targets:
        - mikrotik-exporter:49090   # Service DNS-имя внутри кластера
```

Kubernetes резолвит `mikrotik-exporter` в ClusterIP сервиса, описанного в `infrastructure/prometheus-stack/mikrotik-exporter.yaml`.

## Связанные заметки

- [[index|Миграция с Docker Compose на k3s и ArgoCD]]
