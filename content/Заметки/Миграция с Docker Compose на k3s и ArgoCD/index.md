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
![Общая схема](Схема%20работы%20GitOps.png)

Личные заметки о переходе домашней инфраструктуры от Docker Compose к Kubernetes на базе k3s и GitOps-подходу через ArgoCD.
## Материалы

- [Ограничения Docker Compose в homelab](%D0%9E%D0%B3%D1%80%D0%B0%D0%BD%D0%B8%D1%87%D0%B5%D0%BD%D0%B8%D1%8F%20Docker%20Compose%20%D0%B2%20homelab.md)
- [Выбор k3s и ArgoCD для homelab](%D0%92%D1%8B%D0%B1%D0%BE%D1%80%20k3s%20%D0%B8%20ArgoCD%20%D0%B4%D0%BB%D1%8F%20homelab.md)
- [Подготовка доменов и хостов для homelab](%D0%9F%D0%BE%D0%B4%D0%B3%D0%BE%D1%82%D0%BE%D0%B2%D0%BA%D0%B0%20%D0%B4%D0%BE%D0%BC%D0%B5%D0%BD%D0%BE%D0%B2%20%D0%B8%20%D1%85%D0%BE%D1%81%D1%82%D0%BE%D0%B2%20%D0%B4%D0%BB%D1%8F%20homelab.md)
- [Сохранение legacy-конфигурации при миграции репозитория](%D0%A1%D0%BE%D1%85%D1%80%D0%B0%D0%BD%D0%B5%D0%BD%D0%B8%D0%B5%20legacy-%D0%BA%D0%BE%D0%BD%D1%84%D0%B8%D0%B3%D1%83%D1%80%D0%B0%D1%86%D0%B8%D0%B8%20%D0%BF%D1%80%D0%B8%20%D0%BC%D0%B8%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D0%B8%20%D1%80%D0%B5%D0%BF%D0%BE%D0%B7%D0%B8%D1%82%D0%BE%D1%80%D0%B8%D1%8F.md)
- [Структура GitOps-репозитория App of Apps](%D0%A1%D1%82%D1%80%D1%83%D0%BA%D1%82%D1%83%D1%80%D0%B0%20GitOps-%D1%80%D0%B5%D0%BF%D0%BE%D0%B7%D0%B8%D1%82%D0%BE%D1%80%D0%B8%D1%8F%20App%20of%20Apps.md)
- [Поток синхронизации ArgoCD](%D0%9F%D0%BE%D1%82%D0%BE%D0%BA%20%D1%81%D0%B8%D0%BD%D1%85%D1%80%D0%BE%D0%BD%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B8%20ArgoCD.md)
- [Обнаружение node-exporter в Kubernetes](%D0%9E%D0%B1%D0%BD%D0%B0%D1%80%D1%83%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5%20node-exporter%20%D0%B2%20Kubernetes.md)
- [Сбор метрик с внешних VPS](%D0%A1%D0%B1%D0%BE%D1%80%20%D0%BC%D0%B5%D1%82%D1%80%D0%B8%D0%BA%20%D1%81%20%D0%B2%D0%BD%D0%B5%D1%88%D0%BD%D0%B8%D1%85%20VPS.md)
- [Сбор метрик MikroTik через mktxp](%D0%A1%D0%B1%D0%BE%D1%80%20%D0%BC%D0%B5%D1%82%D1%80%D0%B8%D0%BA%20MikroTik%20%D1%87%D0%B5%D1%80%D0%B5%D0%B7%20mktxp.md)
- [Хранение метрик Prometheus в k3s](%D0%A5%D1%80%D0%B0%D0%BD%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%BC%D0%B5%D1%82%D1%80%D0%B8%D0%BA%20Prometheus%20%D0%B2%20k3s.md)
- [Provisioning Grafana](Provisioning%20Grafana.md)
- [TLS через Traefik и cert-manager](TLS%20%D1%87%D0%B5%D1%80%D0%B5%D0%B7%20Traefik%20%D0%B8%20cert-manager.md)
- [Sealed Secrets в GitOps](Sealed%20Secrets%20%D0%B2%20GitOps.md)
- [Конфликт портов ArgoCD и Traefik](%D0%9A%D0%BE%D0%BD%D1%84%D0%BB%D0%B8%D0%BA%D1%82%20%D0%BF%D0%BE%D1%80%D1%82%D0%BE%D0%B2%20ArgoCD%20%D0%B8%20Traefik.md)
- [Read-only filesystem в mktxp](Read-only%20filesystem%20%D0%B2%20mktxp.md)
- [Datasource not found в Grafana](Datasource%20not%20found%20%D0%B2%20Grafana.md)

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
