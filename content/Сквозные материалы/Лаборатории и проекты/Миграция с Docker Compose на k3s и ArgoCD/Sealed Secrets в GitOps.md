---
title: Sealed Secrets в GitOps
draft: false
tags:
  - sealed-secrets
  - kubernetes
  - gitops
  - security
---

## Почему нельзя просто закодировать в base64

В Kubernetes Secret данные хранятся в base64 — это **не шифрование**, а просто кодирование. Любой, кто имеет доступ к кластеру или к git, может декодировать их за секунду.

## Как работает Sealed Secrets

![](!assets/Схема%20работы%20SealedSecret.png)

Приватный ключ никогда не покидает кластер — поэтому зашифрованный SealedSecret бесполезен без доступа к нему.

**Единственная уязвимость:** если кластер пересоздаётся без резервной копии мастер-ключа, все SealedSecrets не расшифровать. Поэтому бэкап обязателен:

```bash
kubectl get secret -n kube-system \
  -l sealedsecrets.bitnami.com/sealed-secrets-key \
  -o yaml > sealed-secrets-master-key-backup.yaml
```

## Практическое создание SealedSecret

Plain-text пароли в манифестах — очевидно плохая идея.

**Решение:** [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets). Утилита `kubeseal` шифрует Secret публичным ключом контроллера — расшифровать может только контроллер внутри кластера. Зашифрованный `SealedSecret` безопасно коммитить в git.

```bash
kubectl create secret generic my-secret \
  --from-literal=password=реальный_пароль \
  --dry-run=client -o yaml | \
kubeseal \
  --controller-name sealed-secrets \
  --controller-namespace kube-system \
  --format yaml > my-sealed-secret.yaml
```

**Важно:** сделать бэкап мастер-ключа и хранить его отдельно. Если пересоздать кластер без бэкапа — старые SealedSecrets не расшифровать:

```bash
kubectl get secret -n kube-system \
  -l sealedsecrets.bitnami.com/sealed-secrets-key \
  -o yaml > sealed-secrets-master-key-backup.yaml
```

## Связанные заметки

- [Миграция с Docker Compose на k3s и ArgoCD](index.md)
