---
title: Обнаружение node-exporter в Kubernetes
draft: false
tags:
  - prometheus
  - kubernetes
  - node-exporter
  - monitoring
---

## Как Prometheus знает, с кого собирать метрики

Prometheus работает по модели **pull** — сам ходит к экспортерам по расписанию (каждые 30 секунд согласно `scrape_interval` в конфиге) и забирает метрики.

Список целей описан в `infrastructure/prometheus-stack/prometheus-config.yaml` в секции `scrape_configs`. Это ConfigMap, который монтируется в под Prometheus как файл `/etc/prometheus/prometheus.yml`.

## node-exporter внутри кластера — автообнаружение нод

```yaml
- job_name: node-exporter
  kubernetes_sd_configs:
    - role: node          # обнаруживать все ноды кластера автоматически
  relabel_configs:
    - source_labels: [__address__]
      regex: '(.*):10250'
      replacement: '${1}:9100'
      target_label: __address__
```

`kubernetes_sd_configs` с `role: node` говорит Prometheus использовать **Kubernetes Service Discovery** — он обращается к Kubernetes API и получает список всех нод кластера. Изначально адрес ноды приходит с портом `10250` (kubelet), `relabel_configs` заменяет его на `9100` (node-exporter).

Для этого Prometheus нужны права на чтение информации о нодах — они описаны в `infrastructure/prometheus-stack/prometheus-rbac.yaml`: ServiceAccount → ClusterRole → ClusterRoleBinding.

## node-exporter как DaemonSet

Node-exporter описан в `infrastructure/prometheus-stack/node-exporter.yaml` как `DaemonSet` — это специальный тип workload в Kubernetes, который гарантирует, что **один экземпляр пода запущен на каждой ноде**. При добавлении новой ноды DaemonSet автоматически запускает там pod.

Важные параметры:

```yaml
hostPID: true
hostNetwork: true     # под использует сеть хоста, а не pod network
```

`hostNetwork: true` означает, что node-exporter слушает на порту `9100` **хост-машины**, а не внутри pod network. Именно поэтому Prometheus может достучаться до него по IP ноды.

```yaml
volumeMounts:
  - name: root
    mountPath: /host
    readOnly: true   # примонтирован весь корень хост-системы
```

Node-exporter читает метрики хост-машины через примонтированные `/proc`, `/sys` и корневую файловую систему хоста.

## Связанные заметки

- [[index|Миграция с Docker Compose на k3s и ArgoCD]]
