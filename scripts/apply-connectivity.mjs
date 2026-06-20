import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const reportPath = path.join(root, "CONNECTIVITY_CHANGE_REPORT.json")

const replacements = new Map([
  [
    "content/index.md",
    `---
title: База знаний
tags:
  - knowledge-base
---

## Основные разделы

- [Linux](Linux/index.md)
- [Компьютерные сети](Сети/index.md)
- [Kubernetes](Kubernetes/index.md)
- [SSH](ssh/index.md)
- [Docker](Docker/index.md)
- [Go](Golang/index.md)
- [Git](Git/index.md)
- [Алгоритмы и структуры данных](Алгоритмы%20и%20структуры%20данных/index.md)
- [Машинное обучение](Машинное%20обучение/index.md)
- [Практические заметки](Заметки/index.md)
- [Формат заметок](Формат%20заметок.md)
`,
  ],
  [
    "content/Алгоритмы и структуры данных/Алгоритмы/index.md",
    `---
title: Алгоритмы
draft: false
tags:
  - algorithms
---

## Основные материалы

- [Проверка строки на палиндром](Проверка%20строки%20на%20палиндром.md)

## LeetCode

- [9. Palindrome Number](LeetCode/9.%20Palindrome%20Number.md)
- [13. Roman to Integer](LeetCode/13.%20Roman%20to%20Integer.md)
`,
  ],
])

const newFiles = new Map([
  [
    "content/Linux/index.md",
    `---
title: Linux
draft: false
tags:
  - linux
---

## Основные разделы

- [Процессы](Процессы/index.md)
- [Анализ ресурсов с top и htop](Анализ%20ресурсов/top/top.md)
- [systemd](systemd/index.md)
- [SELinux](RHEL/SELinux/index.md)
- [Файловые системы proc и sys](Файловая%20система/proc%20vs%20sys.md)
- [Диагностика по методике RED S.O.S](Траблшутинг/RED%20S.O.S/RED%20S.O.S.md)
`,
  ],
  [
    "content/Linux/Процессы/index.md",
    `---
title: Процессы Linux
draft: false
tags:
  - linux
  - процессы
---

- [Процесс](Процесс.md)
- [Модель процесса](Модель%20процесса.md)
- [Состояния процессов](Состояния%20процессов.md)
- [Приоритет планирования](Приоритет%20планирования.md)
`,
  ],
  [
    "content/Linux/systemd/index.md",
    `---
title: systemd
draft: false
tags:
  - linux
  - systemd
---

- [Зависимости юнитов](Зависимости.md)
- [Логи](Логи.md)
`,
  ],
  [
    "content/Сети/index.md",
    `---
title: Компьютерные сети
draft: false
tags:
  - computer-networks
---

## Основные разделы

- [Модель OSI](Модели/OSI.md)
- [Стек TCP/IP](TCP-IP/index.md)
- [Сетевые протоколы](Протоколы/index.md)
- [DNS](DNS/index.md)
- [Домены](Домен.md)
`,
  ],
  [
    "content/Сети/Протоколы/index.md",
    `---
title: Сетевые протоколы
draft: false
tags:
  - computer-networks
  - protocols
---

- [Ethernet](Ethernet.md)
- [ARP](ARP.md)
- [IP](IP.md)
- [TCP](TCP.md)
- [ICMP](ICMP.md)
- [IGMP](IGMP.md)
- [MLD](MLD.md)
- [DNS](DNS.md)
- [HTTP](HTTP.md)
- [WireGuard](Wireguard.md)
`,
  ],
  [
    "content/ssh/index.md",
    `---
title: SSH
draft: false
tags:
  - ssh
---

- [SSH-ключи](SSH%20ключи/index.md)
- [SSH Agent](SSH%20Agent.md)
- [SSH Config](SSH%20Config.md)
- [Диагностика SSH](Диагностика%20SSH.md)
- [Проверка версии OpenSSH](Проверка%20версии%20OpenSSH.md)
`,
  ],
  [
    "content/Docker/index.md",
    `---
title: Docker
draft: false
tags:
  - docker
---

## Рецепты

- [Multistage Dockerfile для Go](Рецепты/Go%20multistage%20Dockerfile%20template.md)
`,
  ],
  [
    "content/Golang/index.md",
    `---
title: Go
draft: false
tags:
  - go
---

## Рецепты

- [Web API](Рецепты/Web%20API.md)
`,
  ],
  [
    "content/Git/index.md",
    `---
title: Git
draft: false
tags:
  - git
---

- [Генерация и настройка SSH-ключей для GitHub и GitLab](Генерация%20и%20настройка%20SSH-ключей%20для%20GitHub%20и%20GitLab.md)
`,
  ],
  [
    "content/Заметки/index.md",
    `---
title: Практические заметки
draft: false
tags:
  - notes
---

- [Миграция с Docker Compose на k3s и ArgoCD](Миграция%20с%20Docker%20Compose%20на%20k3s%20%2B%20ArgoCD.md)
`,
  ],
  [
    "content/Kubernetes/Запуск приложений/Рецепты/index.md",
    `---
title: Рецепты запуска приложений Kubernetes
draft: false
tags:
  - kubernetes
  - recipes
---

- [Шаблоны манифестов](Шаблоны%20манифестов/index.md)
`,
  ],
  [
    "content/Kubernetes/Запуск приложений/Рецепты/Шаблоны манифестов/index.md",
    `---
title: Шаблоны манифестов Kubernetes
draft: false
tags:
  - kubernetes
  - manifest
  - templates
---

- [Deployment](deployment.md)
- [Ingress](ingress.md)
- [PersistentVolume](pv.md)
- [PersistentVolumeClaim](pvc.md)
- [Service ClusterIP](service-clusterip.md)
- [Service NodePort](service-nodeport.md)
`,
  ],
])

const sections = new Map([
  [
    "content/Сети/DNS/index.md",
    `## Связанные заметки

- [Виды DNS-записей](Виды%20DNS-записей.md)
- [Делегирование домена](Делегирование%20домена.md)
- [A-запись](A-запись.md)
- [AAAA-запись](AAAA-запись.md)
- [CNAME-запись](CNAME-запись.md)
- [MX-запись](MX-запись.md)
- [NS-запись](NS-запись.md)
- [PTR-запись](PTR-запись.md)
- [SOA-запись](SOA-запись.md)
- [SRV-запись](SRV-запись.md)
- [TXT-запись](TXT-запись.md)
- [WHOIS](WHOIS.md)
`,
  ],
  [
    "content/Сети/TCP-IP/index.md",
    `## Связанные протоколы

- [Ethernet](../Протоколы/Ethernet.md)
- [ARP](../Протоколы/ARP.md)
- [IP](../Протоколы/IP.md)
- [TCP](../Протоколы/TCP.md)
- [ICMP](../Протоколы/ICMP.md)
- [IGMP](../Протоколы/IGMP.md)
- [MLD](../Протоколы/MLD.md)
- [DNS](../Протоколы/DNS.md)
- [HTTP](../Протоколы/HTTP.md)
`,
  ],
  [
    "content/Kubernetes/index.md",
    `## Разделы

- [Запуск приложений](Запуск%20приложений/index.md)
- [K3s](k3s/index.md)
`,
  ],
  [
    "content/Kubernetes/Запуск приложений/index.md",
    `## Рабочие нагрузки

- [Pods](Pods/Pods.md)
- [ReplicaSets](ReplicaSets/ReplicaSets.md)
- [Deployments](Deployments/Deployments.md)
- [StatefulSets](StatefulSets/StatefulSets.md)
- [Jobs](Jobs/Jobs.md)

## Рецепты

- [Рецепты запуска приложений](Рецепты/index.md)
`,
  ],
  [
    "content/Kubernetes/k3s/index.md",
    `## Практика

- [Руководство по быстрому запуску](Руководство%20по%20быстрому%20запуску.md)
`,
  ],
  [
    "content/Linux/RHEL/SELinux/index.md",
    `## Связанные заметки

- [Преимущества использования SELinux](Преимущества%20использования%20SELinux.md)
`,
  ],
])

const report = {
  generatedAt: new Date().toISOString(),
  replaced: [],
  created: [],
  appended: [],
  skipped: [],
}

for (const [relative, content] of replacements) {
  const target = path.join(root, relative)
  writeFileSync(target, content)
  report.replaced.push(relative)
}

for (const [relative, content] of newFiles) {
  const target = path.join(root, relative)
  if (existsSync(target)) {
    report.skipped.push({ path: relative, reason: "already exists" })
    continue
  }
  writeFileSync(target, content)
  report.created.push(relative)
}

for (const [relative, section] of sections) {
  const target = path.join(root, relative)
  const current = readFileSync(target, "utf8").replace(/\s+$/, "")
  const heading = section.split("\n")[0]
  if (current.includes(heading)) {
    report.skipped.push({ path: relative, reason: `section ${heading} already exists` })
    continue
  }
  writeFileSync(target, `${current}\n\n${section}`)
  report.appended.push(relative)
}

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
