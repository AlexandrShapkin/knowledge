---
title: Хранение метрик Prometheus в k3s
draft: false
tags:
  - prometheus
  - storage
  - k3s
  - monitoring
---

Prometheus хранит данные в PersistentVolumeClaim `prometheus-data`. k3s автоматически создаёт физический том через `local-path` provisioner — данные хранятся на диске ноды в `/var/lib/rancher/k3s/storage/`.

Retention настроен на 30 дней: `--storage.tsdb.retention.time=30d`.

## Связанные заметки

- [Миграция с Docker Compose на k3s и ArgoCD](index.md)
