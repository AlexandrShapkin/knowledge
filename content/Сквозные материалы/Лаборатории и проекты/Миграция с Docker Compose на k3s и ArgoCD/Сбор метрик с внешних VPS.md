---
title: Сбор метрик с внешних VPS
draft: false
tags:
  - prometheus
  - node-exporter
  - monitoring
  - vps
---

Внешние машины (`fi.alexandrshapkin.ru`, `ru.alexandrshapkin.ru`) указаны как статические таргеты:

```yaml
- job_name: node-exporter-external
  static_configs:
    - targets:
        - 'fi.alexandrshapkin.ru:9100'
        - 'ru.alexandrshapkin.ru:9100'
  relabel_configs:
    - source_labels: [__address__]
      regex: '([^:]+):\d+'
      target_label: instance   # hostname без порта — читаемое имя в дашборде
```

Prometheus обращается к ним напрямую по DNS. На каждом VPS должен быть запущен `node_exporter`, а порт `9100` открыт для IP сервера кластера.

## Связанные заметки

- [Миграция с Docker Compose на k3s и ArgoCD](index.md)
