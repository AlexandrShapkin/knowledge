---
title: Read-only filesystem в mktxp
draft: false
tags:
  - mktxp
  - kubernetes
  - troubleshooting
  - configmap
---

mktxp при запуске пытается обновить конфиг-файлы, добавив новые ключи из свежей версии. Но файлы примонтированы из ConfigMap/Secret — они read-only.

**Решение:** initContainer копирует конфиги в `emptyDir` (rw) перед стартом основного контейнера. mktxp работает уже с копиями и может их изменять.

```yaml
initContainers:
  - name: copy-config
    image: busybox:1.36
    command:
      - sh
      - -c
      - |
        cp /config-global/_mktxp.conf /mktxp-config/_mktxp.conf
        cp /config-router/mktxp.conf /mktxp-config/mktxp.conf
        chown 1000:1000 /mktxp-config/*
        chmod 644 /mktxp-config/*
```

Также выяснилось, что нужно явно прописать все новые ключи в `_mktxp.conf` (включая `compact_default_conf_values`) — иначе mktxp падает с `KeyError`.

## Связанные заметки

- [Миграция с Docker Compose на k3s и ArgoCD](index.md)
