import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import {
  isServicePath,
  listContentDirectories,
  listContentFiles,
  loadContentPolicy,
} from "./content-policy.mjs"

const repositoryRoot = process.cwd()
const policy = loadContentPolicy(repositoryRoot)
const contentRoot = policy.contentRoot
const checkOnly = process.argv.includes("--check")
const reportArgumentIndex = process.argv.indexOf("--report")
const reportPath =
  reportArgumentIndex >= 0 && process.argv[reportArgumentIndex + 1]
    ? path.resolve(repositoryRoot, process.argv[reportArgumentIndex + 1])
    : null

const publishedDirectories = new Set(
  listContentDirectories(policy)
    .map((entry) => path.resolve(entry))
    .filter((entry) => !isServicePath(policy, entry)),
)
const publishedFiles = new Set(
  listContentFiles(policy)
    .map((entry) => path.resolve(entry))
    .filter((entry) => !isServicePath(policy, entry)),
)

function toPosix(value) {
  return value.split(path.sep).join("/")
}

function relativeToRepository(value) {
  return toPosix(path.relative(repositoryRoot, value))
}

function ordinaryEntries(directory) {
  return readdirSync(directory, { withFileTypes: true }).filter((entry) => {
    if (entry.name.startsWith(".") || entry.name.startsWith("!")) return false
    const target = path.resolve(directory, entry.name)
    return entry.isDirectory() ? publishedDirectories.has(target) : publishedFiles.has(target)
  })
}

const contentDirectoryCache = new Map()

function hasNoteContent(directory) {
  if (contentDirectoryCache.has(directory)) return contentDirectoryCache.get(directory)

  const entries = ordinaryEntries(directory)
  const hasMarkdown = entries.some(
    (entry) => entry.isFile() && [".md", ".mdx"].includes(path.extname(entry.name).toLowerCase()),
  )
  const hasNonEmptyChild = entries.some(
    (entry) => entry.isDirectory() && hasNoteContent(path.join(directory, entry.name)),
  )
  const result = hasMarkdown || hasNonEmptyChild

  contentDirectoryCache.set(directory, result)
  return result
}

function parseFrontmatter(source) {
  const normalized = source.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) return { fields: new Map(), body: normalized }

  const end = normalized.indexOf("\n---\n", 4)
  if (end === -1) return { fields: new Map(), body: normalized }

  const raw = normalized.slice(4, end)
  const fields = new Map()
  const lines = raw.split("\n")
  let currentKey = null

  for (const line of lines) {
    const field = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/)
    if (field) {
      currentKey = field[1]
      fields.set(currentKey, { scalar: field[2] ?? "", lines: [] })
      continue
    }

    if (currentKey) fields.get(currentKey).lines.push(line)
  }

  return { fields, body: normalized.slice(end + 5) }
}

function readTitle(file) {
  if (!existsSync(file)) return path.basename(path.dirname(file))

  const source = readFileSync(file, "utf8")
  const frontmatter = parseFrontmatter(source)
  const title = frontmatter.fields.get("title")?.scalar?.trim().replace(/^['"]|['"]$/g, "")
  if (title) return title

  const heading = frontmatter.body.match(/^#\s+(.+)$/m)?.[1]?.trim()
  return heading || path.basename(file, path.extname(file))
}

function readTags(file) {
  if (!existsSync(file)) return []

  const tags = parseFrontmatter(readFileSync(file, "utf8")).fields.get("tags")
  if (!tags) return []

  const list = tags.lines
    .map((line) => line.match(/^\s*-\s*(.*?)\s*$/)?.[1] ?? null)
    .filter((value) => value)

  if (list.length > 0) return list

  const scalar = tags.scalar.trim()
  if (!scalar) return []
  if (scalar.startsWith("[") && scalar.endsWith("]")) {
    return scalar
      .slice(1, -1)
      .split(",")
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean)
  }

  return [scalar.replace(/^['"]|['"]$/g, "")]
}

function directoryTag(name) {
  const normalized = name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "index"
}

function isGeneratedIndex(file) {
  if (!existsSync(file)) return false
  const generated = parseFrontmatter(readFileSync(file, "utf8")).fields.get("generated")?.scalar
  return generated?.trim().toLowerCase() === "true"
}

function nearestInheritedTags(directory) {
  let current = path.dirname(directory)

  while (current.startsWith(contentRoot)) {
    const indexFile = path.join(current, "index.md")
    if (existsSync(indexFile) && !isGeneratedIndex(indexFile)) {
      const tags = readTags(indexFile).filter((tag) => tag !== "index")
      if (tags.length > 0) return tags
    }
    if (current === contentRoot) break
    current = path.dirname(current)
  }

  return []
}

function escapeAlias(value) {
  return value.replace(/\|/g, "\\|")
}

function markdownPageTarget(filename) {
  return filename.replace(/\.(?:md|mdx)$/i, "")
}

function buildIndex(directory) {
  const entries = ordinaryEntries(directory).sort((left, right) => {
    if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1
    return left.name.localeCompare(right.name, "ru")
  })

  const childDirectories = entries.filter(
    (entry) => entry.isDirectory() && hasNoteContent(path.join(directory, entry.name)),
  )
  const childNotes = entries.filter(
    (entry) =>
      entry.isFile() &&
      [".md", ".mdx"].includes(path.extname(entry.name).toLowerCase()) &&
      !["index.md", "index.mdx"].includes(entry.name.toLowerCase()),
  )

  const indexFile = path.join(directory, "index.md")
  const title = directory === contentRoot ? "База знаний" : path.basename(directory)
  const inheritedTags = nearestInheritedTags(directory)
  const tags = [...new Set([...inheritedTags.slice(0, 2), directoryTag(title), "index"])]

  const lines = [
    "---",
    `title: ${title}`,
    "draft: false",
    "generated: true",
    "tags:",
    ...tags.map((tag) => `  - ${tag}`),
    "---",
    "",
  ]

  if (childDirectories.length > 0) {
    lines.push("## Разделы", "")
    for (const entry of childDirectories) {
      const childIndex = path.join(directory, entry.name, "index.md")
      const childTitle = readTitle(childIndex) || entry.name
      lines.push(`- [[${entry.name}/index|${escapeAlias(childTitle)}]]`)
    }
    lines.push("")
  }

  if (childNotes.length > 0) {
    lines.push("## Заметки", "")
    for (const entry of childNotes) {
      const childFile = path.join(directory, entry.name)
      lines.push(`- [[${markdownPageTarget(entry.name)}|${escapeAlias(readTitle(childFile))}]]`)
    }
    lines.push("")
  }

  if (childDirectories.length === 0 && childNotes.length === 0) {
    lines.push("В этом разделе пока нет заметок.", "")
  }

  return { indexFile, content: `${lines.join("\n").replace(/\n+$/, "")}\n` }
}

const allDirectories = [...publishedDirectories]
  .filter((directory) => directory === contentRoot || !isServicePath(policy, directory))
  .sort((left, right) => left.localeCompare(right, "ru"))
const directories = allDirectories
  .filter((directory) => directory === contentRoot || hasNoteContent(directory))
  .sort((left, right) => {
    const depthDifference = right.split(path.sep).length - left.split(path.sep).length
    return depthDifference || left.localeCompare(right, "ru")
  })
const ignoredEmptyDirectories = allDirectories.filter(
  (directory) => directory !== contentRoot && !hasNoteContent(directory),
)

const report = {
  generatedAt: new Date().toISOString(),
  mode: checkOnly ? "check" : "write",
  directories: directories.length,
  ignoredEmptyDirectories: ignoredEmptyDirectories.map(relativeToRepository),
  existingManualIndexes: 0,
  createdIndexes: [],
  updatedGeneratedIndexes: [],
  missingIndexes: [],
  outdatedGeneratedIndexes: [],
}

for (const directory of directories) {
  const expected = buildIndex(directory)

  if (!existsSync(expected.indexFile)) {
    if (checkOnly) report.missingIndexes.push(relativeToRepository(expected.indexFile))
    else {
      writeFileSync(expected.indexFile, expected.content)
      report.createdIndexes.push(relativeToRepository(expected.indexFile))
    }
    continue
  }

  if (!isGeneratedIndex(expected.indexFile)) {
    report.existingManualIndexes += 1
    continue
  }

  const current = readFileSync(expected.indexFile, "utf8").replace(/\r\n/g, "\n")
  if (current === expected.content) continue

  if (checkOnly) report.outdatedGeneratedIndexes.push(relativeToRepository(expected.indexFile))
  else {
    writeFileSync(expected.indexFile, expected.content)
    report.updatedGeneratedIndexes.push(relativeToRepository(expected.indexFile))
  }
}

if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

console.log(`Каталогов-разделов: ${report.directories}`)
console.log(`Пропущено пустых каталогов: ${report.ignoredEmptyDirectories.length}`)
console.log(`Ручных index.md: ${report.existingManualIndexes}`)
console.log(`Создано index.md: ${report.createdIndexes.length}`)
console.log(`Обновлено генерируемых index.md: ${report.updatedGeneratedIndexes.length}`)
console.log(`Отсутствует index.md: ${report.missingIndexes.length}`)
console.log(`Устарело генерируемых index.md: ${report.outdatedGeneratedIndexes.length}`)

if (checkOnly && (report.missingIndexes.length > 0 || report.outdatedGeneratedIndexes.length > 0)) {
  for (const file of report.missingIndexes) console.error(`Отсутствует: ${file}`)
  for (const file of report.outdatedGeneratedIndexes) console.error(`Требует обновления: ${file}`)
  process.exitCode = 1
}
