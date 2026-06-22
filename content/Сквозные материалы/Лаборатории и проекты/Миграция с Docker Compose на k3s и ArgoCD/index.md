---
title: Миграция с Docker Compose на k3s и ArgoCD
draft: false
tags:
  - docker
  - kubernetes
  - k3s
  - argocd
  - gitops
  - index
---
![[!assets/Схема работы GitOps.png|Общая схема]]

Личные заметки о переходе домашней инфраструктуры от Docker Compose к Kubernetes на базе k3s и GitOps-подходу через ArgoCD.
## Материалы

- [[Ограничения Docker Compose в homelab]]
- [[Выбор k3s и ArgoCD для homelab]]
- [[Подготовка доменов и хостов для homelab]]
- [[Сохранение legacy-конфигурации при миграции репозитория]]
- [[Структура GitOps-репозитория App of Apps]]
- [[Поток синхронизации ArgoCD]]
- [[Обнаружение node-exporter в Kubernetes]]
- [[Сбор метрик с внешних VPS]]
- [[Сбор метрик MikroTik через mktxp]]
- [[Хранение метрик Prometheus в k3s]]
- [[Provisioning Grafana]]
- [[TLS через Traefik и cert-manager]]
- [[Sealed Secrets в GitOps]]
- [[Конфликт портов ArgoCD и Traefik]]
- [[Read-only filesystem в mktxp]]
- [[Datasource not found в Grafana]]

## Результат

Текущий стек мониторинга:

|Компонент|Назначение|
|---|---|
|Prometheus|Сбор и хранение метрик (30 дней)|
|Grafana|Визуализация|
|node-exporter (DaemonSet)|Метрики нод кластера|
|node-exporter (external)|Метрики внешних VPS (fi, ru)|
|mktxp|Метрики MikroTik-роутера|

Внешние машины опрашиваются напрямую по домену — порт 9100 открыт только для IP сервера кластера. Возможно, в будущем заменю это на туннелирование, но пока достаточно.

Все сервисы доступны по HTTPS через Traefik + cert-manager + Let's Encrypt. Валидация — HTTP-01 (белый IP, порты 80/443 проброшены с MikroTik). Сертификаты обновляются автоматически — cert-manager следит за сроком и перевыпускает заранее.
