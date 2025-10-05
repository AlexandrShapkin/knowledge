---
title: Генерация и настройка SSH-ключей для GitHub/GitLab
draft: false
tags:
  - ssh
  - git
  - gitlab
  - github
---
 
## 1. Генерация нового ключа
Рекомендуется использовать алгоритм `ed25519` (современнее и безопаснее RSA).
```
ssh-keygen -t ed25519 -C "your_email@example.com"
```
- `-t ed25519` — алгоритм.
- `-C` — комментарий, обычно почта от аккаунта GitHub/GitLab.
- По умолчанию ключи сохранятся в `~/.ssh/id_ed25519` и `~/.ssh/id_ed25519.pub`.  
    Если нужно несколько ключей — укажите имя вручную, например `~/.ssh/id_gitlab`.

## 2. Копирование публичного ключа
```bash
cat ~/.ssh/id_ed25519.pub
```
Скопируйте вывод в буфер.

## 3. Добавление ключа в GitHub/GitLab
- **GitHub**:  
    Settings → SSH and GPG keys → New SSH key → вставить ключ.
- **GitLab**:  
    Preferences → SSH Keys → Add SSH Key → вставить ключ.

## 4. Проверка подключения
Для GitHub:
```
ssh -T git@github.com
```

Для GitLab:
```
ssh -T git@gitlab.com
```

Ожидаемый результат: сообщение о успешной аутентификации.