---
title: Диагностика SSH
draft: false
tags:
  - ssh
  - troubleshooting
  - network
---
## Назначение

Данная заметка содержит набор команд и методик для поиска и устранения проблем при работе с SSH.

Типовые симптомы:

- невозможно подключиться к серверу;
- запрашивается пароль вместо ключа;
- появляется ошибка `Permission denied (publickey)`;
- соединение разрывается сразу после подключения;
- возникает ошибка проверки host key;
- не работает SSH Agent;
- используется не тот SSH-ключ.

---

## Базовый алгоритм диагностики

При возникновении проблем рекомендуется проверять систему в следующем порядке:

1. Проверить доступность сервера
2. Проверить сетевое соединение
3. Проверить SSH-службу
4. Проверить пользователя
5. Проверить [SSH-ключ](content/ssh/SSH%20ключи/index.md)
6. Проверить права файлов
7. Изучить вывод ssh -vvv
8. Проверить журналы сервера

---

## Получение подробного вывода клиента

Первое действие при любой проблеме.

Базовая диагностика:

```bash
ssh -v user@host
```

Расширенная диагностика:

```bash
ssh -vv user@host
```

Максимально подробный вывод:

```bash
ssh -vvv user@host
```

Практически все проблемы с аутентификацией можно определить по выводу `-vvv`.

---

## Проверка доступности сервера

Проверить DNS-разрешение:

```bash
host host.example.com
```

или:

```bash
nslookup host.example.com
```

Проверить доступность узла:

```bash
ping host.example.com
```

Следует учитывать, что многие серверы блокируют ICMP, поэтому отсутствие ответа на ping не всегда означает проблему.

---

## Проверка доступности SSH-порта

Стандартный порт:

```text
22
```

Проверка через nc:

```bash
nc -vz host.example.com 22
```

Проверка через telnet:

```bash
telnet host.example.com 22
```

Проверка через nmap:

```bash
nmap -p 22 host.example.com
```

Открытый порт обычно отображается как:

```text
22/tcp open ssh
```

---

## Проверка используемого ключа

Узнать, какие ключи предлагает клиент:

```bash
ssh -vvv user@host
```

Искать строки:

```text
Offering public key:
```

Например:

```text
Offering public key: ~/.ssh/id_ed25519
```

или:

```text
Offering public key: ~/.ssh/github
```

Это позволяет убедиться, что клиент отправляет ожидаемый ключ.

---

## Проверка содержимого публичного ключа

На клиенте:

```bash
cat ~/.ssh/id_ed25519.pub
```

На сервере:

```bash
cat ~/.ssh/authorized_keys
```

Ключ должен присутствовать в файле полностью и без изменений.

---

## Проверка SSH Agent

Просмотреть загруженные ключи:

```bash
ssh-add -l
```

Если список пуст:

```text
The agent has no identities.
```

Добавить ключ:

```bash
ssh-add ~/.ssh/id_ed25519
```

Проверить повторно:

```bash
ssh-add -l
```

---

## Проверка конфигурации SSH

Посмотреть итоговую конфигурацию:

```bash
ssh -G host
```

Полезно для проверки:

- пользователя;
- порта;
- ключа;
- ProxyJump;
- ProxyCommand.

Например:

```bash
ssh -G prod | grep identityfile
```

---

## Проверка host key сервера

Получить host key:

```bash
ssh-keyscan host.example.com
```

Сравнить с содержимым:

```text
~/.ssh/known_hosts
```

---

## Проверка известных хостов

Просмотр файла:

```bash
cat ~/.ssh/known_hosts
```

Поиск записи:

```bash
ssh-keygen -F host.example.com
```

Удаление записи:

```bash
ssh-keygen -R host.example.com
```

После удаления при следующем подключении ключ будет добавлен заново.

---

# Типовые ошибки

## Permission denied (publickey)

Пример:

```text
Permission denied (publickey).
```

Означает, что сервер отклонил все предложенные клиентом ключи.

Проверить:

1. Правильность пользователя.
2. Наличие ключа в `authorized_keys`.
3. Права файлов.
4. Используемый ключ.
5. Наличие ключа в SSH Agent.

Диагностика:

```bash
ssh -vvv user@host
```

Особенно полезны строки:

```text
Offering public key
Server accepts key
Authentication failed
```

---

## Bad owner or permissions

Пример:

```text
Bad owner or permissions on ~/.ssh
```

SSH отклоняет файлы с небезопасными правами.

Исправление:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
```

---

## Host key verification failed

Пример:

```text
Host key verification failed.
```

Обычно возникает после:

- переустановки сервера;
- смены SSH host key;
- замены виртуальной машины;
- изменения IP-адреса.

Удалить старую запись:

```bash
ssh-keygen -R host.example.com
```

После чего подключиться повторно.

Перед удалением желательно убедиться, что смена ключа легитимна.

---

## WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED

Пример:

```text
WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!
```

SSH обнаружил несовпадение host key.

Возможные причины:

- сервер был переустановлен;
- изменён host key;
- атака Man-In-The-Middle.

Не следует автоматически удалять запись из `known_hosts`, пока не подтверждена причина изменения.

---

## Connection refused

Пример:

```text
ssh: connect to host host port 22: Connection refused
```

Причины:

- SSH-служба не запущена;
- неправильный порт;
- межсетевой экран блокирует соединение.

Проверить на сервере:

```bash
systemctl status ssh
```

или:

```bash
systemctl status sshd
```

Проверить порт:

```bash
ss -tlnp | grep ssh
```

---

## Connection timed out

Пример:

```text
Connection timed out
```

Причины:

- сервер недоступен;
- проблема маршрутизации;
- блокировка трафика;
- неверный IP-адрес.

Проверить:

```bash
ping host
```

```bash
traceroute host
```

или:

```bash
tracepath host
```

---

## No route to host

Пример:

```text
No route to host
```

Проблема находится на сетевом уровне.

Следует проверить:

- IP-адрес;
- маршрутизацию;
- VPN;
- правила firewall.

---

## Agent admitted failure to sign

Пример:

```text
Agent admitted failure to sign using the key
```

Часто возникает при:

- повреждении SSH Agent;
- работе через Pageant;
- использовании аппаратных токенов;
- пересылке агента через несколько узлов.

Попробовать:

```bash
ssh-add -D
ssh-add ~/.ssh/id_ed25519
```

---

## Too many authentication failures

Пример:

```text
Received disconnect:
Too many authentication failures
```

Клиент отправляет слишком много ключей.

Проверить:

```bash
ssh-add -l
```

Использовать конкретный ключ:

```bash
ssh -i ~/.ssh/id_ed25519 user@host
```

Либо:

```sshconfig
Host server
    IdentitiesOnly yes
```

---

# Диагностика на сервере

## Проверка службы SSH

Debian/Ubuntu:

```bash
systemctl status ssh
```

RHEL/CentOS/AlmaLinux:

```bash
systemctl status sshd
```

---

## Проверка журналов

Последние сообщения:

```bash
journalctl -u ssh -n 100
```

или:

```bash
journalctl -u sshd -n 100
```

Следить в реальном времени:

```bash
journalctl -fu ssh
```

или:

```bash
journalctl -fu sshd
```

---

## Проверка конфигурации sshd

Проверить итоговую конфигурацию:

```bash
sshd -T
```

Полезно для проверки параметров:

```text
PasswordAuthentication
PubkeyAuthentication
PermitRootLogin
AuthorizedKeysFile
AllowUsers
AllowGroups
```

---

## Проверка пользователя

Убедиться, что пользователь существует:

```bash
id username
```

Проверить домашний каталог:

```bash
getent passwd username
```

Убедиться, что каталог существует и доступен.

---

## Проверка прав файлов

На сервере:

```bash
ls -ld ~
ls -ld ~/.ssh
ls -l ~/.ssh
```

Типичный результат:

```text
drwx------ .ssh
-rw------- authorized_keys
```

---

# Полезные команды

Проверить конфигурацию клиента:

```bash
ssh -G host
```

Показать fingerprint ключа:

```bash
ssh-keygen -lf ~/.ssh/id_ed25519.pub
```

Получить host key сервера:

```bash
ssh-keyscan host
```

Показать ключи агента:

```bash
ssh-add -l
```

Удалить все ключи из агента:

```bash
ssh-add -D
```
