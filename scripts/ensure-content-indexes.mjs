import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const repositoryRoot = process.cwd()
const contentRoot = path.resolve(repositoryRoot, "content")
const checkOnly = process.argv.includes("--check")
const reportArgumentIndex = process.argv.indexOf("--report")
const reportPath =
  reportArgumentIndex >= 0 && process.argv[reportArgumentIndex + 1]
    ? path.resolve(repositoryRoot, process.argv[reportArgumentIndex + 1])
    : null

function toPosix(value) {
  return value.split(path.sep).join("/")
}

function relativeToRepository(value) {
  return toPosix(path.relative(repositoryRoot, value))
}

function listDirectories(root) {
  const result = [root]

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue
    result.push(...listDirectories(path.join(root, entry.name)))
  }

  return result
}

function encodePath(value) {
  return value
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment)
        .replace(/%2F/gi, "/")
        .replace(/'/g, "%27"),
    )
    .join("/")
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

function nearestInheritedTags(directory) {
  let current = path.dirname(directory)

  while (current.startsWith(contentRoot)) {
    const indexFile = path.join(current, "index.md")
    const tags = readTags(indexFile).filter((tag) => tag !== "index")
    if (tags.length > 0) return tags
    if (current === contentRoot) break
    current = path.dirname(current)
  }

  return []
}

function isGeneratedIndex(file) {
  if (!existsSync(file)) return false
  const generated = parseFrontmatter(readFileSync(file, "utf8")).fields.get("generated")?.scalar
  return generated?.trim().toLowerCase() === "true"
}

function buildIndex(directory) {
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1
      return left.name.localeCompare(right.name, "ru")
    })

  const childDirectories = entries.filter((entry) => entry.isDirectory())
  const childNotes = entries.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md") && entry.name !== "index.md",
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
      lines.push(`- [${childTitle}](${encodePath(`${entry.name}/index.md`)})`)
    }
    lines.push("")
  }

  if (childNotes.length > 0) {
    lines.push("## Заметки", "")
    for (const entry of childNotes) {
      const childFile = path.join(directory, entry.name)
      lines.push(`- [${readTitle(childFile)}](${encodePath(entry.name)})`)
    }
    lines.push("")
  }

  if (childDirectories.length === 0 && childNotes.length === 0) {
    lines.push("В этом разделе пока нет заметок.", "")
  }

  return { indexFile, content: `${lines.join("\n").replace(/\n+$/, "")}\n` }
}

const directories = listDirectories(contentRoot).sort((left, right) => {
  const depthDifference = right.split(path.sep).length - left.split(path.sep).length
  return depthDifference || left.localeCompare(right, "ru")
})

const report = {
  generatedAt: new Date().toISOString(),
  mode: checkOnly ? "check" : "write",
  directories: directories.length,
  existingManualIndexes: 0,
  createdIndexes: [],
  updatedGeneratedIndexes: [],
  missingIndexes: [],
  outdatedGeneratedIndexes: [],
}

for (const directory of directories) {
  const expected = buildIndex(directory)

  if (!existsSync(expected.indexFile)) {
    if (checkOnly) {
      report.missingIndexes.push(relativeToRepository(expected.indexFile))
    } else {
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

  if (checkOnly) {
    report.outdatedGeneratedIndexes.push(relativeToRepository(expected.indexFile))
  } else {
    writeFileSync(expected.indexFile, expected.content)
    report.updatedGeneratedIndexes.push(relativeToRepository(expected.indexFile))
  }
}

if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

console.log(`Каталогов: ${report.directories}`)
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
