---
title: Конфликт портов ArgoCD и Traefik
draft: false
tags:
  - argocd
  - traefik
  - kubernetes
  - troubleshooting
---

k3s по умолчанию разворачивает Traefik как LoadBalancer на портах 80 и 443. ArgoCD тоже запрашивает LoadBalancer на тех же портах — klipper (svclb) не может назначить IP, pod висит в `Pending`.

**Решение:** поменять тип сервиса argocd-server на ClusterIP и пустить его через Traefik как Ingress, как и все остальные сервисы:

```bash
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "ClusterIP"}}'
```

Плюс отключить внутренний TLS у ArgoCD, чтобы избежать конфликтов с Traefik:

```yaml
data:
  server.insecure: "true"
```

## Связанные заметки

- [[index|Миграция с Docker Compose на k3s и ArgoCD]]
