---
title: Подготовка доменов и хостов для homelab
draft: false
tags:
  - homelab
  - dns
  - infrastructure
  - migration
---

Для начала зарегистрировал несколько доменов в зоне `.ru`. В качестве регистратора использую [SpaceWeb](https://sweb.ru/):

- `alexandrshapkin.ru` — A-запись, базовая; используется как основа для остальных
- `argocd.alexandrshapkin.ru` — CNAME-запись — адрес для ArgoCD
- `grafana.alexandrshapkin.ru` — CNAME-запись — адрес для Grafana
- `ru.alexandrshapkin.ru` — A-запись — один из арендованных VPS; нужен для сбора метрик через [Node Exporter](https://github.com/prometheus/node_exporter)
- `fi.alexandrshapkin.ru` — A-запись — аналогично `ru.alexandrshapkin.ru`

Пул доменов будет расширяться по мере необходимости. Фактически у меня три хоста: хостовая машина с k3s/ArgoCD и два VPS. VPS довольно слабые, поэтому использовать их как дополнительные ноды кластера пока не стал — хотя поэкспериментировать с этим было бы интересно.

Хостовая машина — десктоп на базе i5-9400F с 32 ГБ DDR4, ОС — [Ubuntu 26.04 LTS](https://documentation.ubuntu.com/release-notes/26.04/).

## Связанные заметки

- [Миграция с Docker Compose на k3s и ArgoCD](index.md)
