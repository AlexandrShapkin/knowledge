---
title: Поток синхронизации ArgoCD
draft: false
tags:
  - argocd
  - gitops
  - reconciliation
  - kubernetes
---

## Как ArgoCD узнаёт, что деплоить

ArgoCD работает по принципу **reconciliation loop** — бесконечный цикл сравнения «что есть в git» с «что есть в кластере». Расхождение — применить изменения.

![[!assets/Схема работы GitOps.png|Схема работы потока GitOps]]

Точка входа — файл `clusters/homelab/root-app.yaml`. Он применяется **один раз вручную**:

```bash
kubectl apply -f clusters/homelab/root-app.yaml
```

После этого в кластере появляется объект `Application` с именем `root-app`. ArgoCD видит его и начинает следить за директорией `apps/` в репозитории.

## Паттерн App of Apps — как работает цепочка

`root-app` следит за директорией `apps/`. Там лежат файлы вида:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: prometheus-stack
spec:
  source:
    path: infrastructure/prometheus-stack   # директория с манифестами
  destination:
    namespace: monitoring
  syncPolicy:
    automated:
      prune: true      # удалять ресурсы, которых нет в git
      selfHeal: true   # восстанавливать, если кто-то изменил вручную
```

ArgoCD применяет эти файлы — то есть создаёт **новые объекты Application** в кластере. Каждый из них в свою очередь начинает следить за своей директорией.

Итог: достаточно добавить файл в `apps/` — ArgoCD сам создаст Application и задеплоит всё, что находится в указанном `path`.

## syncOptions: ServerSideApply и CreateNamespace

В `apps/prometheus-stack.yaml` есть:

```yaml
syncOptions:
  - CreateNamespace=true    # создать namespace, если не существует
  - ServerSideApply=true    # применять через server-side apply (нужно для больших CRD)
```

`CreateNamespace=true` — ArgoCD сам создаёт namespace `monitoring` перед применением манифестов. Без этого деплой падал бы с ошибкой «namespace not found».

`ServerSideApply=true` — некоторые ресурсы (особенно CRD) слишком большие для обычного `kubectl apply`. Server-side apply решает эту проблему.

## Связанные заметки

- [[index|Миграция с Docker Compose на k3s и ArgoCD]]
