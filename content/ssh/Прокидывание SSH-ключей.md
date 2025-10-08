---
title: Прокидывание SSH-ключей
draft: false
tags:
  - ssh
---
## Генерация ключа
**Linux / macOS / Windows (через WSL или Git Bash):**
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Рекомендуется использовать `ed25519` — он современнее и безопаснее, чем RSA.  
Ключи по умолчанию сохраняются в `~/.ssh/id_ed25519` и `~/.ssh/id_ed25519.pub`.

Если нужно задать кастомное имя файла:
```bash
ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/my_key
```

---
## Копирование публичного ключа на сервер
### Linux / macOS / WSL:
```bash
ssh-copy-id user@host
```

Если команды `ssh-copy-id` нет (например, в минимальных системах), можно вручную:
```bash
cat ~/.ssh/id_ed25519.pub | ssh user@host "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

---
## Проверка подключения
```bash
ssh user@host
```

Если всё корректно, подключение произойдёт без запроса пароля.

---
## Настройка `~/.ssh/config` (удобство)
Для упрощения доступа:
```bash
Host myserver
    HostName host.example.com
    User user
    IdentityFile ~/.ssh/id_ed25519
```

Теперь можно подключаться просто:
```bash
ssh myserver
```

---
## Windows (варианты)

### Использовать **Windows Terminal / PowerShell с OpenSSH**
Современные Windows 10/11 уже включают OpenSSH-клиент.
**Проверить:**
```powershell
Get-Command ssh
```

**Создать ключ:**
```powershell
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Файлы сохранятся в:
```
C:\Users\<USERNAME>\.ssh\
```

**Копировать ключ вручную:**
```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh user@host "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

---
### Использовать **PuTTY / Pageant**
1. Установить [PuTTY](https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html).
2. Сгенерировать ключ через **PuTTYgen** (тип: _ED25519_).
3. Сохранить приватный ключ в `.ppk`, а публичный скопировать на сервер в `~/.ssh/authorized_keys`.
4. Добавить ключ в **Pageant** (агент), чтобы не вводить пароль при каждом подключении.
5. В **PuTTY** указать путь к ключу в разделе:
```
Connection → SSH → Auth → Private key file for authentication
```

---
## SSH-агент (автоматическая подгрузка ключей)
**Linux / macOS / WSL:**
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

**Windows (PowerShell):**
```powershell
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519
```

Проверить добавленные ключи:
```bash
ssh-add -l
```

---
## Полезные мелочи
- Проверить fingerprint сервера:
```bash
ssh-keyscan host
```
- Проверить, что ключ используется при подключении:
```bash
ssh -v user@host
```
- Для Git можно указать SSH-ключ напрямую:
```bash
git config --global core.sshCommand "ssh -i ~/.ssh/id_ed25519"
```
