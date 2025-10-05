---
title: Прокидывание SSH-ключей
draft: false
tags:
  -
---
 Сгенерировать ключ (если ещё нет):
 ```bash
 ssh-keygen -t ed25519 -C "your_email@example.com"
 ```
Скопировать публичный ключ на сервер:
```bash
ssh-copy-id user@host
```
Проверить подключение:
```bash
ssh user@host
```