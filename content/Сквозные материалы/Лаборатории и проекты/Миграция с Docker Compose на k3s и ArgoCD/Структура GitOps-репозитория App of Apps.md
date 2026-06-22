---
title: Структура GitOps-репозитория App of Apps
draft: false
tags:
  - argocd
  - gitops
  - app-of-apps
  - kubernetes
---

Выбран паттерн **[App of Apps](https://argo-cd.readthedocs.io/en/latest/operator-manual/cluster-bootstrapping/#app-of-apps-pattern-alternative)** — один корневой ArgoCD Application следит за директорией `apps/`, в которой лежат Application-манифесты для каждого сервиса.

```
homelab-infra/
├── apps/                        # ArgoCD Applications (что деплоить)
│   ├── root-app.yaml            # Корневой app - следит за этой директорией
│   ├── sealed-secrets.yaml      # Контроллер для шифрования секретов
│   ├── cert-manager-config.yaml # TLS-сертификаты
│   ├── argocd-config.yaml       # Настройки самого ArgoCD
│   └── prometheus-stack.yaml    # Мониторинг
├── clusters/
│   └── homelab/
│       └── root-app.yaml        # Bootstrap - применяется вручную один раз
└── infrastructure/              # Сами манифесты сервисов
    ├── argocd/
    ├── cert-manager/
    └── prometheus-stack/
```

**Bootstrap** — единственное действие, которое нужно выполнить на готовом кластере:

```bash
kubectl apply -f clusters/homelab/root-app.yaml
```

После этого ArgoCD управляет всем остальным сам. В дальнейшем, возможно, автоматизирую и сам процесс развёртывания кластера вместе с применением bootstrap.

## Связанные заметки

- [[index|Миграция с Docker Compose на k3s и ArgoCD]]
