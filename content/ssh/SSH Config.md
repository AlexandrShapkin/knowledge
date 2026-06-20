---
title: SSH Config
draft: false
tags:
  -
---
## Назначение

Файл `~/.ssh/config` используется для хранения клиентских настроек SSH.

Позволяет:

- не указывать длинные параметры в командной строке;
- создавать удобные псевдонимы серверов;
- использовать разные ключи для разных серверов;
- задавать пользователя и порт по умолчанию;
- настраивать прокси и туннели.

Без `config` подключение может выглядеть так:

```bash
ssh -i ~/.ssh/work_ed25519 -p 2222 admin@192.168.1.10
```

С `config`:

```bash
ssh work-server
```

---

## Расположение файла

```text
~/.ssh/config
```

Если файла нет, его можно создать вручную.

Рекомендуемые права:

```bash
chmod 600 ~/.ssh/config
```

---

## Базовая структура

```text
Host alias
    Параметр значение
    Параметр значение
```

Пример:

```text
Host web
    HostName 192.168.1.10
    User admin
```

Подключение:

```bash
ssh web
```

---

## Основные параметры

### Host

Имя псевдонима.

```text
Host web
```

Используется в команде:

```bash
ssh web
```

---

### HostName

Реальный адрес сервера.

```text
Host web
    HostName 192.168.1.10
```

Можно использовать:

```text
Host web
    HostName server.example.com
```

---

### User

Пользователь для подключения.

```text
Host web
    User admin
```

Эквивалентно:

```bash
ssh admin@server
```

---

### Port

SSH-порт сервера.

```text
Host web
    Port 2222
```

Эквивалентно:

```bash
ssh -p 2222 server
```

---

### IdentityFile

Указывает используемый приватный ключ.

```text
Host web
    IdentityFile ~/.ssh/id_ed25519
```

Можно использовать разные ключи для разных серверов.

```text
Host github
    IdentityFile ~/.ssh/github_ed25519

Host work
    IdentityFile ~/.ssh/work_ed25519
```

---

### IdentitiesOnly

Запрещает SSH перебирать другие ключи.

Рекомендуется при использовании нескольких ключей.

```text
Host work
    IdentityFile ~/.ssh/work_ed25519
    IdentitiesOnly yes
```

---

## Полный пример

```text
Host web
    HostName 192.168.1.10
    User admin
    Port 22
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
```

Подключение:

```bash
ssh web
```

---

## Использование нескольких серверов

```text
Host web-prod
    HostName 10.0.0.10
    User deploy
    IdentityFile ~/.ssh/prod_ed25519

Host web-stage
    HostName 10.0.0.20
    User deploy
    IdentityFile ~/.ssh/stage_ed25519
```

Подключение:

```bash
ssh web-prod
ssh web-stage
```

---

## Настройка для GitHub

```text
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_ed25519
    IdentitiesOnly yes
```

Проверка:

```bash
ssh -T git@github.com
```

---

## Настройка нескольких Git-аккаунтов

Например, личный и рабочий аккаунты.

```text
Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_personal_ed25519
    IdentitiesOnly yes

Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_work_ed25519
    IdentitiesOnly yes
```

Клонирование:

```bash
git clone git@github-work:company/project.git

git clone git@github-personal:user/project.git
```

---

## Глобальные настройки

Можно задать параметры для всех подключений.

```text
Host *
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Затем добавить отдельные записи серверов ниже.

```text
Host *
    ServerAliveInterval 60

Host web
    HostName 192.168.1.10
```

---

## Полезные параметры

### ServerAliveInterval

Отправляет keepalive-пакеты.

```text
ServerAliveInterval 60
```

Каждые 60 секунд.

---

### ServerAliveCountMax

Количество неудачных keepalive-попыток.

```text
ServerAliveCountMax 3
```

---

### ForwardAgent

Пробрасывает SSH Agent на удалённый сервер.

```text
ForwardAgent yes
```

Использовать только при необходимости.

---

### Compression

Включает сжатие трафика.

```text
Compression yes
```

Полезно на медленных каналах.

---

## Проверка итоговой конфигурации

Показать конфигурацию, которую SSH применит к хосту:

```bash
ssh -G web
```

Очень полезно при диагностике.

---

## Диагностика

Проверить параметры подключения:

```bash
ssh -v web
```

Более подробный вывод:

```bash
ssh -vvv web
```

Посмотреть какой ключ используется:

```bash
ssh -v web
```

В выводе будет строка вида:

```text
Offering public key: ~/.ssh/id_ed25519
```

---

## Практические рекомендации

- Использовать `~/.ssh/config` даже для одного сервера.
    
- Для каждого сервиса использовать отдельный ключ.
    
- Указывать `IdentitiesOnly yes`.
    
- Для GitHub/GitLab использовать отдельные записи.
    
- Хранить все параметры подключения в `config`, а не в истории команд.
    
- Проверять итоговую конфигурацию через `ssh -G`.
    
- Не использовать `ForwardAgent`, если он не нужен.
    

---

## Связанные заметки

- SSH
    
- [SSH Agent](SSH%20Agent.md)
    
- [Генерация ED25519 ключа](SSH%20ключи/Генерация%20ED25519%20ключа.md)
    
- [Добавление публичного ключа на сервер](SSH%20ключи/Добавление%20публичного%20ключа%20на%20сервер.md)
    
- SSH для Git
    
- [Диагностика SSH](Диагностика%20SSH.md)
    
- SSH Host Keys и known_hosts
    

Я бы ещё добавил отдельную заметку про `ProxyJump` (bastion/jump host), потому что в DevOps и администрировании это встречается регулярно и быстро разрастается в отдельную тему.