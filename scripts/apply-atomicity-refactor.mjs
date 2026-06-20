import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const contentRoot = path.join(root, "content")

function read(relativePath) {
  return readFileSync(path.join(contentRoot, relativePath), "utf8").replace(/\r\n/g, "\n")
}

function write(relativePath, content) {
  const target = path.join(contentRoot, relativePath)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, `${content.trim()}\n`, "utf8")
  console.log(`Записан: content/${relativePath}`)
}

function remove(relativePath) {
  rmSync(path.join(contentRoot, relativePath), { force: true })
  console.log(`Удалён: content/${relativePath}`)
}

function bodyWithoutFrontmatter(source) {
  if (!source.startsWith("---\n")) return source
  const end = source.indexOf("\n---\n", 4)
  return end === -1 ? source : source.slice(end + 5)
}

function extractRange(body, startHeading, endHeading = null) {
  const start = body.indexOf(startHeading)
  if (start === -1) throw new Error(`Не найден заголовок: ${startHeading}`)
  const end = endHeading ? body.indexOf(endHeading, start + startHeading.length) : body.length
  if (endHeading && end === -1) throw new Error(`Не найден конечный заголовок: ${endHeading}`)
  return body.slice(start, end).trim()
}

function normalizeSection(section, startLevel, adjustImages = false) {
  const lines = section.trim().split("\n")
  if (lines[0]?.startsWith(`${"#".repeat(startLevel)} `)) lines.shift()

  while (lines.length > 0 && (!lines[0].trim() || lines[0].trim() === "---")) lines.shift()
  while (lines.length > 0 && (!lines.at(-1).trim() || lines.at(-1).trim() === "---")) lines.pop()

  return lines
    .map((line) => {
      const heading = line.match(/^(#{2,6})\s+(.+)$/)
      if (heading) {
        const newLevel = Math.max(2, heading[1].length - startLevel + 1)
        line = `${"#".repeat(newLevel)} ${heading[2]}`
      }
      if (adjustImages) line = line.replaceAll("](Pasted%20", "](../Pasted%20")
      return line
    })
    .join("\n")
    .trim()
}

function note(title, tags, body, parent = null) {
  const tagLines = tags.map((tag) => `  - ${tag}`).join("\n")
  const navigation = parent
    ? `\n\n## Связанные заметки\n\n- [${parent.label}](${parent.href})`
    : ""

  return `---\ntitle: ${title}\ndraft: false\ntags:\n${tagLines}\n---\n\n${body.trim()}${navigation}`
}

function encodePath(value) {
  return value
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment)
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29")
        .replace(/'/g, "%27"),
    )
    .join("/")
}

// Лабораторная работа 1: один тематический блок — одна заметка.
const mlSourcePath = "Машинное обучение/Лабораторная работа 1/Темы лабораторной работы 1.md"
const mlBody = bodyWithoutFrontmatter(read(mlSourcePath))
const mlMatches = [...mlBody.matchAll(/^##\s+(.+)$/gm)]
const mlSections = mlMatches.map((match, index) => ({
  heading: match[1],
  content: mlBody.slice(match.index, mlMatches[index + 1]?.index ?? mlBody.length).trim(),
}))

const mlDefinitions = [
  ["NumPy как основа.md", "NumPy как основа", ["machine-learning", "numpy", "ndarray", "vectorization", "broadcasting"]],
  ["Создание массивов и матриц NumPy.md", "Создание массивов и матриц NumPy", ["machine-learning", "numpy", "arrays", "matrices"]],
  ["Индексация и оси NumPy.md", "Индексация и оси NumPy", ["machine-learning", "numpy", "indexing", "axes"]],
  ["Векторизация и булевы маски NumPy.md", "Векторизация и булевы маски NumPy", ["machine-learning", "numpy", "vectorization", "boolean-masks"]],
  ["Случайные величины в NumPy.md", "Случайные величины в NumPy", ["machine-learning", "numpy", "probability", "distributions"]],
  ["Гистограммы.md", "Гистограммы", ["machine-learning", "statistics", "histogram", "matplotlib"]],
  ["Матрица Вигнера.md", "Матрица Вигнера", ["machine-learning", "numpy", "random-matrix", "wigner-matrix"]],
  ["Экстремальные статистики.md", "Экстремальные статистики", ["machine-learning", "statistics", "extreme-values", "numpy"]],
  ["Частотные представления данных.md", "Частотные представления данных", ["machine-learning", "numpy", "frequency-distribution", "bincount"]],
  ["Масштабирование признаков.md", "Масштабирование признаков", ["machine-learning", "feature-scaling", "standardization", "numpy"]],
  ["Wine dataset.md", "Wine dataset", ["machine-learning", "datasets", "scikit-learn", "wine"]],
  ["Линейная регрессия.md", "Линейная регрессия", ["machine-learning", "linear-regression", "statistics"]],
  ["Diabetes dataset.md", "Diabetes dataset", ["machine-learning", "datasets", "scikit-learn", "regression"]],
]

if (mlSections.length !== mlDefinitions.length) {
  throw new Error(`Ожидалось ${mlDefinitions.length} разделов лабораторной работы, найдено ${mlSections.length}`)
}

for (let index = 0; index < mlDefinitions.length; index += 1) {
  const [filename, title, tags] = mlDefinitions[index]
  let section = normalizeSection(mlSections[index].content, 2)
  section = section.replace(/^##\s+\d+\.\d+\s+/gm, "## ")
  write(
    `Машинное обучение/Лабораторная работа 1/${filename}`,
    note(title, tags, section, { label: "Лабораторная работа 1", href: "index.md" }),
  )
}

const mlLinks = mlDefinitions
  .map(([filename, title], index) => `${index + 1}. [${title}](${encodePath(filename)})`)
  .join("\n")

write(
  "Машинное обучение/Лабораторная работа 1/index.md",
  `---
title: Лабораторная работа 1
draft: false
tags:
  - machine-learning
  - numpy
  - laboratory-work
  - index
---

Лабораторная работа охватывает базовые операции NumPy, статистические эксперименты, визуализацию и простые модели машинного обучения.

## Темы

${mlLinks}`,
)

write(
  "Машинное обучение/index.md",
  `---
title: Машинное обучение (лабораторные работы)
draft: false
tags:
  - machine-learning
---

1. [Лабораторная работа 1](Лабораторная%20работа%201/index.md)`,
)
remove(mlSourcePath)

// Git и SSH: генерация ключа вынесена в существующую SSH-заметку.
write(
  "Git/Добавление SSH-ключа в GitHub и GitLab.md",
  note(
    "Добавление SSH-ключа в GitHub и GitLab",
    ["ssh", "git", "github", "gitlab", "authentication"],
    `Для работы с GitHub и GitLab по SSH сначала создайте ключ по инструкции [Генерация ED25519-ключа](../ssh/SSH%20ключи/Генерация%20ED25519%20ключа.md).

## Копирование публичного ключа

\`\`\`bash
cat ~/.ssh/id_ed25519.pub
\`\`\`

Скопируйте строку целиком. Если используется отдельный ключ, укажите путь к соответствующему файлу \`.pub\`.

## Добавление ключа в GitHub

Откройте **Settings → SSH and GPG keys → New SSH key**, укажите понятное имя и вставьте публичный ключ.

## Добавление ключа в GitLab

Откройте **Preferences → SSH Keys → Add new key**, вставьте публичный ключ и сохраните его.

## Проверка подключения

GitHub:

\`\`\`bash
ssh -T git@github.com
\`\`\`

GitLab:

\`\`\`bash
ssh -T git@gitlab.com
\`\`\`

Успешная проверка завершается сообщением об аутентификации. Если для сервисов используются разные ключи, настройте их в [SSH Config](../ssh/SSH%20Config.md).`,
  ),
)
write(
  "Git/index.md",
  `---
title: Git
draft: false
tags:
  - git
---

- [Добавление SSH-ключа в GitHub и GitLab](Добавление%20SSH-ключа%20в%20GitHub%20и%20GitLab.md)`,
)
remove("Git/Генерация и настройка SSH-ключей для GitHub и GitLab.md")

// Каталог метрик top/htop переносится в индексную заметку.
const topOverviewPath = "Linux/Анализ ресурсов/top/Основные параметры и метрики.md"
const topOverviewBody = bodyWithoutFrontmatter(read(topOverviewPath)).trim()
write(
  "Linux/Анализ ресурсов/top/index.md",
  `---
title: top и htop
draft: false
tags:
  - linux
  - анализ_ресурсов
  - top
  - index
---

Инструменты [top](top.md) и [htop](htop.md) показывают агрегированное состояние системы и параметры отдельных процессов.

${topOverviewBody}`,
)
remove(topOverviewPath)

// Монолитная заметка о миграции разбивается на независимые решения и процедуры.
const migrationSourcePath = "Заметки/Миграция с Docker Compose на k3s + ArgoCD.md"
const migrationBody = bodyWithoutFrontmatter(read(migrationSourcePath))
const migrationDirectory = "Заметки/Миграция с Docker Compose на k3s и ArgoCD"
const migrationParent = { label: "Миграция с Docker Compose на k3s и ArgoCD", href: "index.md" }
const migrationNotes = []

function addMigrationNote(filename, title, tags, section) {
  const relativePath = `${migrationDirectory}/${filename}`
  const adjustedSection = section.replaceAll("](Pasted%20", "](../Pasted%20")
  write(relativePath, note(title, tags, adjustedSection, migrationParent))
  migrationNotes.push([filename, title])
}

addMigrationNote(
  "Ограничения Docker Compose в homelab.md",
  "Ограничения Docker Compose в homelab",
  ["docker", "docker-compose", "homelab", "migration"],
  normalizeSection(extractRange(migrationBody, "## Контекст", "## Что выбрал и почему"), 2),
)
addMigrationNote(
  "Выбор k3s и ArgoCD для homelab.md",
  "Выбор k3s и ArgoCD для homelab",
  ["kubernetes", "k3s", "argocd", "gitops", "homelab"],
  normalizeSection(extractRange(migrationBody, "## Что выбрал и почему", "## Подготовка к миграции"), 2),
)
addMigrationNote(
  "Подготовка доменов и хостов для homelab.md",
  "Подготовка доменов и хостов для homelab",
  ["homelab", "dns", "infrastructure", "migration"],
  normalizeSection(extractRange(migrationBody, "## Подготовка к миграции", "## Миграция старого репозитория"), 2),
)
addMigrationNote(
  "Сохранение legacy-конфигурации при миграции репозитория.md",
  "Сохранение legacy-конфигурации при миграции репозитория",
  ["git", "migration", "homelab", "repository"],
  normalizeSection(extractRange(migrationBody, "## Миграция старого репозитория", "## Структура репозитория"), 2),
)
addMigrationNote(
  "Структура GitOps-репозитория App of Apps.md",
  "Структура GitOps-репозитория App of Apps",
  ["argocd", "gitops", "app-of-apps", "kubernetes"],
  normalizeSection(extractRange(migrationBody, "## Структура репозитория", "## Что сделано и как работает"), 2),
)
addMigrationNote(
  "Поток синхронизации ArgoCD.md",
  "Поток синхронизации ArgoCD",
  ["argocd", "gitops", "reconciliation", "kubernetes"],
  normalizeSection(extractRange(migrationBody, "### Поток ArgoCD → Kubernetes", "### Prometheus собирает метрики"), 3),
)
addMigrationNote(
  "Обнаружение node-exporter в Kubernetes.md",
  "Обнаружение node-exporter в Kubernetes",
  ["prometheus", "kubernetes", "node-exporter", "monitoring"],
  normalizeSection(extractRange(migrationBody, "### Prometheus собирает метрики", "#### node-exporter на внешних VPS"), 3),
)
addMigrationNote(
  "Сбор метрик с внешних VPS.md",
  "Сбор метрик с внешних VPS",
  ["prometheus", "node-exporter", "monitoring", "vps"],
  normalizeSection(extractRange(migrationBody, "#### node-exporter на внешних VPS", "#### mikrotik-exporter"), 4),
)
addMigrationNote(
  "Сбор метрик MikroTik через mktxp.md",
  "Сбор метрик MikroTik через mktxp",
  ["prometheus", "mikrotik", "mktxp", "monitoring"],
  normalizeSection(extractRange(migrationBody, "#### mikrotik-exporter", "### Хранение данных"), 4),
)
addMigrationNote(
  "Хранение метрик Prometheus в k3s.md",
  "Хранение метрик Prometheus в k3s",
  ["prometheus", "storage", "k3s", "monitoring"],
  normalizeSection(extractRange(migrationBody, "### Хранение данных", "### Grafana подключается к Prometheus"), 3),
)
addMigrationNote(
  "Provisioning Grafana.md",
  "Provisioning Grafana",
  ["grafana", "provisioning", "prometheus", "monitoring"],
  normalizeSection(extractRange(migrationBody, "### Grafana подключается к Prometheus", "### TLS и доступ снаружи"), 3),
)
addMigrationNote(
  "TLS через Traefik и cert-manager.md",
  "TLS через Traefik и cert-manager",
  ["traefik", "cert-manager", "tls", "kubernetes"],
  normalizeSection(extractRange(migrationBody, "### TLS и доступ снаружи", "### Sealed Secrets"), 3, true),
)

const sealedSecretsBody = `${normalizeSection(extractRange(migrationBody, "### Sealed Secrets", "## Грабли и решения"), 3, true)}\n\n## Практическое создание SealedSecret\n\n${normalizeSection(extractRange(migrationBody, "### 2. Секреты в открытом виде в git", "### 3. mktxp не стартует — Read-only filesystem"), 3)}`
addMigrationNote(
  "Sealed Secrets в GitOps.md",
  "Sealed Secrets в GitOps",
  ["sealed-secrets", "kubernetes", "gitops", "security"],
  sealedSecretsBody,
)
addMigrationNote(
  "Конфликт портов ArgoCD и Traefik.md",
  "Конфликт портов ArgoCD и Traefik",
  ["argocd", "traefik", "kubernetes", "troubleshooting"],
  normalizeSection(extractRange(migrationBody, "### 1. Порты 80/443 заняты Traefik — argocd-server завис в Pending", "### 2. Секреты в открытом виде в git"), 3),
)
addMigrationNote(
  "Read-only filesystem в mktxp.md",
  "Read-only filesystem в mktxp",
  ["mktxp", "kubernetes", "troubleshooting", "configmap"],
  normalizeSection(extractRange(migrationBody, "### 3. mktxp не стартует — Read-only filesystem", "### 4. Дашборды Grafana — Datasource not found"), 3),
)
addMigrationNote(
  "Datasource not found в Grafana.md",
  "Datasource not found в Grafana",
  ["grafana", "prometheus", "troubleshooting", "datasource"],
  normalizeSection(extractRange(migrationBody, "### 4. Дашборды Grafana — Datasource not found", "## Итог"), 3),
)

const migrationLinks = migrationNotes
  .map(([filename, title]) => `- [${title}](${encodePath(filename)})`)
  .join("\n")
const migrationSummary = normalizeSection(extractRange(migrationBody, "## Итог"), 2)

write(
  `${migrationDirectory}/index.md`,
  `---
title: Миграция с Docker Compose на k3s и ArgoCD
draft: false
tags:
  - docker
  - kubernetes
  - k3s
  - argocd
  - gitops
  - index
---

Личные заметки о переходе домашней инфраструктуры от Docker Compose к Kubernetes на базе k3s и GitOps-подходу через ArgoCD.

![Общая схема](../Pasted%20image%2020260529014518.png)

## Материалы

${migrationLinks}

## Результат

${migrationSummary}`,
)
write(
  "Заметки/index.md",
  `---
title: Практические заметки
draft: false
tags:
  - notes
---

- [Миграция с Docker Compose на k3s и ArgoCD](Миграция%20с%20Docker%20Compose%20на%20k3s%20и%20ArgoCD/index.md)`,
)
remove(migrationSourcePath)

console.log(`Создано тематических заметок лабораторной работы: ${mlDefinitions.length}`)
console.log(`Создано атомарных заметок миграции: ${migrationNotes.length}`)
