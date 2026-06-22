---
title: Сохранение legacy-конфигурации при миграции репозитория
draft: false
tags:
  - git
  - migration
  - homelab
  - repository
---

В первую очередь «очистил» [репозиторий](https://github.com/AlexandrShapkin/homelab-infra), сохранив старые наработки в ветку [legacy/docker-compose](https://github.com/AlexandrShapkin/homelab-infra/tree/legacy/docker-compose):

```bash
git checkout -b legacy/docker-compose
git push origin legacy/docker-compose
git checkout main
git rm -rf .
git commit --allow-empty -m "chore: init k3s(k8s)/argocd era"
git push origin main --force
```

В результате получилась чистая ветка [main](https://github.com/AlexandrShapkin/homelab-infra/tree/26de5e58c9aaeb36ce4cf564e155148a82b21fbf), с которой и началась работа.

## Связанные заметки

- [Миграция с Docker Compose на k3s и ArgoCD](index.md)
