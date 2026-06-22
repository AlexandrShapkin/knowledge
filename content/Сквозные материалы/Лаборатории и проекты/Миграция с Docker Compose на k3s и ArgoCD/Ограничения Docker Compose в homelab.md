---
title: Ограничения Docker Compose в homelab
draft: false
tags:
  - docker
  - docker-compose
  - homelab
  - migration
---

До миграции инфраструктура строилась на **[Ansible](https://www.redhat.com/en/ansible-collaborative) + [Docker Compose](https://docs.docker.com/compose/)** на [AlmaLinux](https://almalinux.org/ru/). Все сервисы описывались через `docker-compose.yml` файлы и разворачивались вручную или через [Ansible плейбуки](https://github.com/AlexandrShapkin/homelab-infra/tree/legacy/docker-compose/playbooks). Это работало, но имело ряд ограничений:

- Нет единой точки управления состоянием
- Изменения применялись вручную по SSH
- Нет автоматического восстановления при падении
- Сложно отслеживать, что именно задеплоено
- Нет чёткой привязки к внешнему источнику истины (в данном случае — GitHub-репозиторий)

Старые наработки сохранены в ветке [`legacy/docker-compose`](https://github.com/AlexandrShapkin/homelab-infra/tree/legacy/docker-compose).

## Связанные заметки

- [Миграция с Docker Compose на k3s и ArgoCD](index.md)
