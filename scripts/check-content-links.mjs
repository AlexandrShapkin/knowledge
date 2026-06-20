import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { unified } from "unified"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { visit } from "unist-util-visit"

const repositoryRoot = process.cwd()
const contentRoot = path.resolve(repositoryRoot, "content")
const reportArgumentIndex = process.argv.indexOf("--report")
const reportPath =
  reportArgumentIndex >= 0 && process.argv[reportArgumentIndex + 1]
    ? path.resolve(repositoryRoot, process.argv[reportArgumentIndex + 1])
    : null

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

function relativeToRepository(file) {
  return toPosix(path.relative(repositoryRoot, file))
}

function addIssue(issues, file, line, type, target, message) {
  issues.push({
    file: relativeToRepository(file),
    line: line ?? null,
    type,
    target: target ?? null,
    message,
  })
}

function isExternal(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)
}

function splitTarget(target) {
  const hashIndex = target.indexOf("#")
  const beforeHash = hashIndex >= 0 ? target.slice(0, hashIndex) : target
  const queryIndex = beforeHash.indexOf("?")
  return queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash
}

function decodeTarget(target) {
  try {
    return { value: decodeURIComponent(target), error: null }
  } catch (error) {
    return { value: target, error }
  }
}

function isInsideContent(targetPath) {
  const relative = path.relative(contentRoot, targetPath)
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

const markdownFiles = walk(contentRoot)
  .filter((file) => file.toLowerCase().endsWith(".md"))
  .sort((left, right) => left.localeCompare(right, "ru"))

const issues = []
let internalNoteLinks = 0
let internalAssetLinks = 0
let externalLinks = 0
let anchorLinks = 0

function validateTarget(file, node, kind) {
  const target = String(node.url ?? "").trim()
  const line = node.position?.start?.line ?? null

  if (!target) {
    addIssue(issues, file, line, "empty-target", target, "Ссылка не содержит адреса")
    return
  }

  if (isExternal(target)) {
    externalLinks += 1
    return
  }

  if (target.startsWith("#")) {
    anchorLinks += 1
    return
  }

  if (target.startsWith("/")) {
    addIssue(
      issues,
      file,
      line,
      "absolute-path",
      target,
      "Внутренняя ссылка должна быть относительной к текущей заметке",
    )
    return
  }

  if (target.includes("\\")) {
    addIssue(
      issues,
      file,
      line,
      "backslash",
      target,
      "В путях ссылок должен использоваться символ /",
    )
  }

  const unencodedCharacters = [" ", "(", ")"].filter((character) => target.includes(character))
  if (unencodedCharacters.length > 0) {
    addIssue(
      issues,
      file,
      line,
      "unencoded-character",
      target,
      `Пробелы и круглые скобки в пути должны быть URL-кодированы: ${unencodedCharacters.join(" ")}`,
    )
  }

  const pathPart = splitTarget(target)
  if (!pathPart) {
    anchorLinks += 1
    return
  }

  const decoded = decodeTarget(pathPart)
  if (decoded.error) {
    addIssue(
      issues,
      file,
      line,
      "invalid-url-encoding",
      target,
      "Путь содержит некорректную URL-кодировку",
    )
    return
  }

  const resolved = path.resolve(path.dirname(file), decoded.value)
  if (!isInsideContent(resolved)) {
    addIssue(
      issues,
      file,
      line,
      "outside-content",
      target,
      "Ссылка выходит за пределы каталога content",
    )
    return
  }

  if (kind === "note") {
    internalNoteLinks += 1
    if (path.extname(decoded.value).toLowerCase() !== ".md") {
      addIssue(
        issues,
        file,
        line,
        "missing-md-extension",
        target,
        "Внутренняя ссылка на заметку должна явно содержать расширение .md",
      )
      return
    }
  } else {
    internalAssetLinks += 1
  }

  if (!existsSync(resolved)) {
    addIssue(
      issues,
      file,
      line,
      "missing-target",
      target,
      `Целевой файл не существует: ${relativeToRepository(resolved)}`,
    )
    return
  }

  if (!statSync(resolved).isFile()) {
    addIssue(
      issues,
      file,
      line,
      "target-not-file",
      target,
      "Цель ссылки должна быть файлом",
    )
  }
}

const parser = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm)

for (const file of markdownFiles) {
  const source = readFileSync(file, "utf8")

  for (const match of source.matchAll(/!?\[\[[^\]]+\]\]/g)) {
    const line = source.slice(0, match.index).split("\n").length
    addIssue(
      issues,
      file,
      line,
      "wiki-link",
      match[0],
      "Obsidian wiki-ссылки запрещены; используйте относительную Markdown-ссылку",
    )
  }

  let tree
  try {
    tree = parser.parse(source)
  } catch (error) {
    addIssue(
      issues,
      file,
      null,
      "parse-error",
      null,
      error instanceof Error ? error.message : String(error),
    )
    continue
  }

  visit(tree, "link", (node) => validateTarget(file, node, "note"))
  visit(tree, "image", (node) => validateTarget(file, node, "asset"))
  visit(tree, "definition", (node) => validateTarget(file, node, "note"))
}

issues.sort(
  (left, right) =>
    left.file.localeCompare(right.file, "ru") ||
    (left.line ?? 0) - (right.line ?? 0) ||
    left.type.localeCompare(right.type),
)

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    markdownFiles: markdownFiles.length,
    internalNoteLinks,
    internalAssetLinks,
    externalLinks,
    anchorLinks,
    issues: issues.length,
  },
  issues,
}

if (reportPath) writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

console.log(
  [
    `Markdown-файлов: ${report.summary.markdownFiles}`,
    `Внутренних ссылок на заметки: ${report.summary.internalNoteLinks}`,
    `Внутренних ссылок на ресурсы: ${report.summary.internalAssetLinks}`,
    `Внешних ссылок: ${report.summary.externalLinks}`,
    `Ссылок на разделы: ${report.summary.anchorLinks}`,
    `Ошибок: ${report.summary.issues}`,
  ].join("\n"),
)

if (issues.length > 0) {
  for (const issue of issues) {
    const location = issue.line ? `${issue.file}:${issue.line}` : issue.file
    console.error(`${location} [${issue.type}] ${issue.message}${issue.target ? ` — ${issue.target}` : ""}`)
  }
  process.exitCode = 1
}
