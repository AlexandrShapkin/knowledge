---
title: Provisioning Grafana
draft: false
tags:
  - grafana
  - provisioning
  - prometheus
  - monitoring
---

## Автоматическое добавление datasource

Grafana поддерживает **provisioning** — механизм автоматической настройки при старте через файлы конфигурации.

Datasource описан в ConfigMap внутри `infrastructure/prometheus-stack/grafana.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
data:
  prometheus.yaml: |
    apiVersion: 1
    datasources:
      - name: Prometheus
        type: prometheus
        url: http://prometheus:9090   # Service DNS-имя
        isDefault: true
        editable: false
```

Этот ConfigMap монтируется в директорию `/etc/grafana/provisioning/datasources/` внутри контейнера. При старте Grafana читает все `.yaml` файлы из этой директории и автоматически добавляет datasource.

`url: http://prometheus:9090` — Kubernetes DNS резолвит `prometheus` в ClusterIP сервиса Prometheus. Grafana и Prometheus находятся в одном namespace `monitoring`, поэтому достаточно короткого имени.

## Автоматическая загрузка дашбордов

Аналогично datasource — через provisioning. Нужны два ConfigMap.

**Провайдер** — говорит Grafana, где искать дашборды:

```yaml
data:
  dashboards.yaml: |
    apiVersion: 1
    providers:
      - name: default
        type: file
        options:
          path: /var/lib/grafana/dashboards   # ← смотреть здесь
```

**Сами дашборды** — JSON-файлы, скачанные с grafana.com:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dashboard-node-exporter
data:
  node-exporter.json: |
    { ... JSON дашборда ... }
```

Оба ConfigMap монтируются в соответствующие директории контейнера. При старте Grafana читает все `.json` файлы из `path` и загружает их.

**Важный нюанс:** дашборды с grafana.com содержат `${DS_PROMETHEUS}` вместо реального имени datasource. Перед созданием ConfigMap нужно заменить:

```bash
sed -i 's/\${DS_PROMETHEUS}/Prometheus/g' dashboard.json
```

Иначе Grafana не может сопоставить дашборд с datasource.

## Связанные заметки

- [Миграция с Docker Compose на k3s и ArgoCD](index.md)
