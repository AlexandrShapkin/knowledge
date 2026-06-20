---
title: Добавление SSH-ключа в GitHub и GitLab
draft: false
tags:
  - ssh
  - git
  - github
  - gitlab
  - authentication
---

Для работы с GitHub и GitLab по SSH сначала создайте ключ по инструкции [Генерация ED25519-ключа](../ssh/SSH%20ключи/Генерация%20ED25519%20ключа.md).

## Копирование публичного ключа

```bash
cat ~/.ssh/id_ed25519.pub
```

Скопируйте строку целиком. Если используется отдельный ключ, укажите путь к соответствующему файлу `.pub`.

## Добавление ключа в GitHub

Откройте **Settings → SSH and GPG keys → New SSH key**, укажите понятное имя и вставьте публичный ключ.

## Добавление ключа в GitLab

Откройте **Preferences → SSH Keys → Add new key**, вставьте публичный ключ и сохраните его.

## Проверка подключения

GitHub:

```bash
ssh -T git@github.com
```

GitLab:

```bash
ssh -T git@gitlab.com
```

Успешная проверка завершается сообщением об аутентификации. Если для сервисов используются разные ключи, настройте их в [SSH Config](../ssh/SSH%20Config.md).
