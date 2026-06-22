import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import { unified } from "unified"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { visit } from "unist-util-visit"
import {
  isAssetPath,
  isServicePath,
  listContentFiles,
  loadContentPolicy,
} from "./content-policy.mjs"

const root = process.cwd()
const policy = loadContentPolicy(root)
const content = policy.contentRoot
const reportAt = process.argv.indexOf("--report")
const reportFile = reportAt >= 0 ? path.resolve(root, process.argv[reportAt + 1]) : null
const parser = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]).use(remarkGfm)
const issues = []
const links = new Map()
const pageExtensions = new Set([".md", ".mdx", ".canvas", ".base"])

const posix = (value) => value.split(path.sep).join("/")
const relative = (value) => posix(path.relative(root, value))
const external = (value) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)
const add = (file, line, type, target, message) =>
  issues.push({ file: relative(file), line: line ?? null, type, target: target ?? null, message })

function inside(parent, child) {
  const rel = path.relative(parent, child)
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel))
}

function decode(value) {
  try {
    return { value: decodeURIComponent(value), error: false }
  } catch {
    return { value, error: true }
  }
}

function meaningful(file) {
  const name = path.basename(file, path.extname(file)).trim()
  return (
    name.length >= 3 &&
    !/^(?:pasted[ _-]*image|image|img|screenshot|screen[ _-]*shot|скриншот|изображение|asset|file|untitled|без[ _-]*названия)(?:[ _-]*\d.*)?$/i.test(
      name,
    )
  )
}

function validateMetadata(file, source) {
  let parsed
  try {
    parsed = matter(source)
  } catch (error) {
    add(file, null, "invalid-frontmatter", null, error instanceof Error ? error.message : String(error))
    return
  }

  if (!source.startsWith("---\n") && !source.startsWith("---\r\n")) {
    add(file, 1, "missing-frontmatter", null, "Заметка должна начинаться с YAML frontmatter")
  }
  if (typeof parsed.data.title !== "string" || !parsed.data.title.trim()) {
    add(file, 1, "missing-title", null, "Frontmatter должен содержать непустой title")
  }
  if (!Array.isArray(parsed.data.tags) || parsed.data.tags.length === 0) {
    add(file, 1, "missing-tags", null, "Frontmatter должен содержать непустой список tags")
  } else {
    const seen = new Set()
    for (const tag of parsed.data.tags) {
      if (typeof tag !== "string" || !tag.trim()) add(file, 1, "empty-tag", null, "Теги должны быть непустыми")
      else {
        if (tag !== tag.toLowerCase()) add(file, 1, "uppercase-tag", tag, "Теги должны быть в lowercase")
        if (seen.has(tag)) add(file, 1, "duplicate-tag", tag, "Тег указан повторно")
        seen.add(tag)
      }
    }
  }
  if (path.basename(file).toLowerCase() !== "index.md" && !parsed.content.trim()) {
    add(file, null, "empty-note", null, "Содержательная заметка не должна быть пустой")
  }
}

function validateWikiLinks(file, tree) {
  visit(tree, "text", (node) => {
    const value = String(node.value ?? "")
    for (const match of value.matchAll(/!?\[\[[^\]]+\]\]/g)) {
      const precedingLines = value.slice(0, match.index).split("\n").length - 1
      const line = (node.position?.start?.line ?? 1) + precedingLines
      add(file, line, "wiki-link", match[0], "Используйте относительную Markdown-ссылку по правилам репозитория")
    }
  })
}

const publishedFiles = listContentFiles(policy).map((file) => path.resolve(file))
const publishedSet = new Set(publishedFiles)
const markdown = listContentFiles(policy, { markdownOnly: true })
  .map((file) => path.resolve(file))
  .filter((file) => !isServicePath(policy, file))
  .sort((a, b) => a.localeCompare(b, "ru"))
const markdownSet = new Set(markdown)

function validateLink(file, node, image = false) {
  const target = String(node.url ?? "").trim()
  const line = node.position?.start?.line ?? null
  if (!target) return add(file, line, "empty-target", target, "Ссылка не содержит адреса")
  if (external(target) || target.startsWith("#")) return
  if (target.startsWith("/")) return add(file, line, "absolute-path", target, "Внутренняя ссылка должна быть относительной")
  if (target.includes("\\")) add(file, line, "backslash", target, "В пути должен использоваться /")
  if ([" ", "(", ")"].some((character) => target.includes(character))) {
    add(file, line, "unencoded-character", target, "Пробелы и скобки в пути должны быть URL-кодированы")
  }

  const raw = target.split("#")[0].split("?")[0]
  const decoded = decode(raw)
  if (decoded.error) return add(file, line, "invalid-url-encoding", target, "Некорректная URL-кодировка")

  const extension = path.extname(decoded.value).toLowerCase()
  const kind = image || (extension && !pageExtensions.has(extension)) ? "asset" : "page"
  if (kind === "page" && !pageExtensions.has(extension)) {
    return add(file, line, "missing-page-extension", target, "Ссылка на страницу должна содержать .md, .mdx, .canvas или .base")
  }

  const resolved = path.resolve(path.dirname(file), decoded.value)
  if (!inside(content, resolved)) return add(file, line, "outside-content", target, "Ссылка выходит за пределы content")
  if (!existsSync(resolved)) return add(file, line, "missing-target", target, `Файл не существует: ${relative(resolved)}`)
  if (!statSync(resolved).isFile()) return add(file, line, "target-not-file", target, "Цель должна быть файлом")
  if (!publishedSet.has(resolved)) {
    return add(file, line, "ignored-target", target, "Цель исключена из публикации через Quartz ignorePatterns")
  }

  if (kind === "page") {
    if (isServicePath(policy, resolved)) {
      return add(file, line, "service-page-target", target, "Служебный каталог не должен содержать публикуемые страницы")
    }
    if (markdownSet.has(resolved) && resolved !== file) links.get(file)?.add(resolved)
    return
  }

  if (!inside(path.join(path.dirname(file), "!assets"), resolved)) {
    add(file, line, "asset-location", target, "Вложение должно находиться в !assets рядом с заметкой")
  }
  if (!meaningful(resolved)) add(file, line, "generic-asset-name", target, "Вложение должно иметь понятное имя")
}

for (const file of markdown) links.set(file, new Set())

for (const file of markdown) {
  const source = readFileSync(file, "utf8")
  validateMetadata(file, source)

  let tree
  try {
    tree = parser.parse(source)
  } catch (error) {
    add(file, null, "markdown-parse-error", null, error instanceof Error ? error.message : String(error))
    continue
  }

  validateWikiLinks(file, tree)
  visit(tree, "link", (node) => validateLink(file, node))
  visit(tree, "image", (node) => validateLink(file, node, true))
  visit(tree, "definition", (node) => validateLink(file, node))
}

const incoming = new Map(markdown.map((file) => [file, new Set()]))
for (const [source, targets] of links) for (const target of targets) incoming.get(target)?.add(source)
for (const file of markdown) {
  if (links.get(file).size === 0 && incoming.get(file).size === 0) {
    add(file, null, "isolated-note", null, "Заметка должна быть связана с графом заметок")
  }
}

const validatedFiles = publishedFiles.filter((file) => !isServicePath(policy, file) || isAssetPath(policy, file))
for (const file of validatedFiles) {
  const extension = path.extname(file).toLowerCase()
  if (pageExtensions.has(extension) || !statSync(file).isFile()) continue
  if (!isAssetPath(policy, file)) add(file, null, "asset-outside-assets", null, "Вложение должно храниться в !assets")
  if (!meaningful(file)) add(file, null, "generic-asset-name", null, "Вложение должно иметь понятное имя")
}

issues.sort((a, b) => a.file.localeCompare(b.file, "ru") || (a.line ?? 0) - (b.line ?? 0))
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    markdownFiles: markdown.length,
    pageFiles: publishedFiles.filter((file) => pageExtensions.has(path.extname(file).toLowerCase())).length,
    assetFiles: validatedFiles.filter((file) => !pageExtensions.has(path.extname(file).toLowerCase())).length,
    issues: issues.length,
  },
  issues,
}
if (reportFile) writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report.summary, null, 2))
for (const issue of issues) {
  const place = issue.line ? `${issue.file}:${issue.line}` : issue.file
  console.error(`${place} [${issue.type}] ${issue.message}${issue.target ? ` — ${issue.target}` : ""}`)
}
if (issues.length > 0) process.exitCode = 1
