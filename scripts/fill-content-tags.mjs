import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const contentRoot = path.join(root, "content")
const reportPath = path.join(root, "TAG_MIGRATION_REPORT.json")

const exactTags = new Map([
  ["Алгоритмы и структуры данных/Алгоритмы/index.md", ["algorithms"]],
  ["Алгоритмы и структуры данных/index.md", ["algorithms", "data-structures"]],
  ["Машинное обучение/Лабораторная работа 1/Темы лабораторной работы 1.md", ["machine-learning", "numpy", "laboratory-work"]],
  ["Машинное обучение/index.md", ["machine-learning"]],
  ["Сети/Модели/OSI.md", ["computer-networks", "osi"]],
  ["Сети/Протоколы/Wireguard.md", ["computer-networks", "wireguard", "vpn"]],
  ["Сети/DNS/WHOIS.md", ["computer-networks", "dns", "whois"]],
  ["Формат заметок.md", ["meta", "markdown"]],
  ["Docker/Рецепты/Go multistage Dockerfile template.md", ["docker", "go", "dockerfile"]],
  ["Golang/Рецепты/Web API.md", ["go", "web", "api"]],
  ["index.md", ["knowledge-base"]],
  ["Kubernetes/Запуск приложений/Рецепты/Шаблоны манифестов/deployment.md", ["kubernetes", "manifest", "deployment"]],
  ["Kubernetes/Запуск приложений/Рецепты/Шаблоны манифестов/ingress.md", ["kubernetes", "manifest", "ingress"]],
  ["Kubernetes/Запуск приложений/Рецепты/Шаблоны манифестов/pv.md", ["kubernetes", "manifest", "persistent-volume"]],
  ["Kubernetes/Запуск приложений/Рецепты/Шаблоны манифестов/pvc.md", ["kubernetes", "manifest", "persistent-volume-claim"]],
  ["Kubernetes/Запуск приложений/Рецепты/Шаблоны манифестов/service-clusterip.md", ["kubernetes", "manifest", "service", "clusterip"]],
  ["Kubernetes/Запуск приложений/Рецепты/Шаблоны манифестов/service-nodeport.md", ["kubernetes", "manifest", "service", "nodeport"]],
  ["Kubernetes/Запуск приложений/index.md", ["kubernetes", "workloads"]],
  ["Kubernetes/index.md", ["kubernetes"]],
  ["Kubernetes/k3s/Руководство по быстрому запуску.md", ["kubernetes", "k3s", "installation"]],
  ["Kubernetes/k3s/index.md", ["kubernetes", "k3s"]],
  ["Linux/Процессы/Приоритет планирования.md", ["linux", "процессы", "планирование"]],
  ["ssh/Диагностика SSH.md", ["ssh", "troubleshooting"]],
  ["ssh/SSH ключи/Генерация ED25519 ключа.md", ["ssh", "security", "authentication", "ed25519"]],
  ["ssh/SSH ключи/Добавление публичного ключа на сервер.md", ["ssh", "security", "authentication"]],
  ["ssh/SSH Agent.md", ["ssh", "authentication", "ssh-agent"]],
  ["ssh/SSH Config.md", ["ssh", "configuration"]],
])

const fallbackByRoot = new Map([
  ["Linux", ["linux"]],
  ["Сети", ["computer-networks"]],
  ["Kubernetes", ["kubernetes"]],
  ["ssh", ["ssh"]],
  ["Docker", ["docker"]],
  ["Golang", ["go"]],
  ["Git", ["git"]],
  ["Машинное обучение", ["machine-learning"]],
  ["Алгоритмы и структуры данных", ["algorithms"]],
  ["Заметки", ["notes"]],
])

function walk(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walk(fullPath))
    else files.push(fullPath)
  }
  return files
}

function toPosix(value) {
  return value.split(path.sep).join("/")
}

function relativeToContent(file) {
  return toPosix(path.relative(contentRoot, file))
}

function splitFrontmatter(source) {
  const normalized = source.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) throw new Error("Missing frontmatter")
  const end = normalized.indexOf("\n---\n", 4)
  if (end === -1) throw new Error("Unclosed frontmatter")
  return {
    raw: normalized.slice(4, end),
    body: normalized.slice(end + 5),
  }
}

function locateField(lines, field) {
  const start = lines.findIndex((line) => line.startsWith(`${field}:`))
  if (start === -1) return null
  let end = start + 1
  while (end < lines.length && !/^[A-Za-z0-9_-]+:/.test(lines[end])) end += 1
  return { start, end }
}

function readTags(raw) {
  const lines = raw.split("\n")
  const location = locateField(lines, "tags")
  if (!location) return []
  const first = lines[location.start].slice("tags:".length).trim()
  const list = lines
    .slice(location.start + 1, location.end)
    .map((line) => line.match(/^\s*-\s*(.*?)\s*$/)?.[1] ?? null)
    .filter((value) => value !== null && value.length > 0)
  if (list.length > 0) return list
  if (!first) return []
  if (first.startsWith("[") && first.endsWith("]")) {
    return first
      .slice(1, -1)
      .split(",")
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean)
  }
  return [first.replace(/^['"]|['"]$/g, "")].filter(Boolean)
}

function writeTags(raw, tags) {
  const lines = raw.split("\n")
  const replacement = ["tags:", ...tags.map((tag) => `  - ${tag}`)]
  const location = locateField(lines, "tags")
  if (location) lines.splice(location.start, location.end - location.start, ...replacement)
  else lines.push(...replacement)
  return lines.join("\n").replace(/\n+$/, "")
}

function inferTags(relative) {
  const exact = exactTags.get(relative)
  if (exact) return exact
  const rootDirectory = relative.includes("/") ? relative.split("/")[0] : ""
  return fallbackByRoot.get(rootDirectory) ?? ["knowledge-base"]
}

const report = {
  generatedAt: new Date().toISOString(),
  filesScanned: 0,
  filesChanged: 0,
  changes: [],
  remainingWithoutTags: [],
}

const markdownFiles = walk(contentRoot)
  .filter((file) => file.toLowerCase().endsWith(".md"))
  .sort((a, b) => a.localeCompare(b, "ru"))

for (const file of markdownFiles) {
  report.filesScanned += 1
  const relative = relativeToContent(file)
  const source = readFileSync(file, "utf8")
  const frontmatter = splitFrontmatter(source)
  const currentTags = readTags(frontmatter.raw)

  if (currentTags.length > 0) continue

  const tags = [...new Set(inferTags(relative).map((tag) => tag.toLowerCase()))]
  const updatedFrontmatter = writeTags(frontmatter.raw, tags)
  writeFileSync(file, `---\n${updatedFrontmatter}\n---\n${frontmatter.body}`)
  report.filesChanged += 1
  report.changes.push({ path: relative, tags })
}

for (const file of markdownFiles) {
  const relative = relativeToContent(file)
  const frontmatter = splitFrontmatter(readFileSync(file, "utf8"))
  if (readTags(frontmatter.raw).length === 0) report.remainingWithoutTags.push(relative)
}

if (report.remainingWithoutTags.length > 0) {
  throw new Error(`Notes without tags remain:\n${report.remainingWithoutTags.join("\n")}`)
}

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
