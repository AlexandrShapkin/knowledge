import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const contentRoot = path.join(root, "content")
const reportPath = path.join(root, "CONNECTIVITY_AUDIT.json")

function walk(directory) {
  const result = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...walk(fullPath))
    else result.push(fullPath)
  }
  return result
}

function toPosix(value) {
  return value.split(path.sep).join("/")
}

function relativeToContent(file) {
  return toPosix(path.relative(contentRoot, file))
}

function decodeTarget(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value.replace(/%20/gi, " ").replace(/%28/gi, "(").replace(/%29/gi, ")")
  }
}

const markdownFiles = walk(contentRoot)
  .filter((file) => file.toLowerCase().endsWith(".md"))
  .sort((a, b) => a.localeCompare(b, "ru"))

const byRelative = new Map(markdownFiles.map((file) => [relativeToContent(file), file]))
const inbound = new Map(markdownFiles.map((file) => [file, new Set()]))
const outbound = new Map(markdownFiles.map((file) => [file, new Set()]))

function resolveTarget(sourceFile, href) {
  if (/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(href) || href.startsWith("#")) return null
  const pathname = decodeTarget(href.split("#")[0].split("?")[0])
  if (!pathname.toLowerCase().endsWith(".md")) return null
  const sourceDirectory = path.posix.dirname(relativeToContent(sourceFile))
  const targetRelative = path.posix.normalize(path.posix.join(sourceDirectory, pathname))
  return byRelative.get(targetRelative) ?? null
}

for (const file of markdownFiles) {
  const source = readFileSync(file, "utf8")
  for (const match of source.matchAll(/(?<!!)\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = resolveTarget(file, match[1].trim().replace(/^<|>$/g, ""))
    if (!target || target === file) continue
    outbound.get(file).add(target)
    inbound.get(target).add(file)
  }
}

function nearestIndex(file) {
  let directory = path.posix.dirname(relativeToContent(file))
  while (directory && directory !== ".") {
    const candidate = byRelative.get(`${directory}/index.md`)
    if (candidate && candidate !== file) return candidate
    directory = path.posix.dirname(directory)
  }
  return byRelative.get("index.md") ?? null
}

function directChildren(indexFile) {
  const indexRelative = relativeToContent(indexFile)
  const directory = path.posix.dirname(indexRelative)
  const prefix = directory === "." ? "" : `${directory}/`
  const children = []

  for (const file of markdownFiles) {
    if (file === indexFile) continue
    const relative = relativeToContent(file)
    if (!relative.startsWith(prefix)) continue
    const rest = relative.slice(prefix.length)
    const segments = rest.split("/")

    if (segments.length === 1) children.push(file)
    else if (segments.length === 2 && segments[1] === "index.md") children.push(file)
  }

  return children.sort((a, b) => relativeToContent(a).localeCompare(relativeToContent(b), "ru"))
}

const isolated = []
for (const file of markdownFiles) {
  if (relativeToContent(file) === "index.md") continue
  if (inbound.get(file).size === 0 && outbound.get(file).size === 0) {
    const suggestedIndex = nearestIndex(file)
    isolated.push({
      path: relativeToContent(file),
      suggestedIndex: suggestedIndex ? relativeToContent(suggestedIndex) : null,
    })
  }
}

const indexes = markdownFiles
  .filter((file) => path.basename(file).toLowerCase() === "index.md")
  .map((indexFile) => {
    const children = directChildren(indexFile)
    const missing = children.filter((child) => !outbound.get(indexFile).has(child))
    return {
      path: relativeToContent(indexFile),
      incoming: inbound.get(indexFile).size,
      outgoing: outbound.get(indexFile).size,
      directChildren: children.map(relativeToContent),
      missingDirectLinks: missing.map(relativeToContent),
    }
  })

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    markdownFiles: markdownFiles.length,
    links: [...outbound.values()].reduce((sum, links) => sum + links.size, 0),
    isolatedNotes: isolated.length,
    indexes: indexes.length,
    indexesWithMissingDirectLinks: indexes.filter((index) => index.missingDirectLinks.length > 0).length,
  },
  isolated,
  indexes,
}

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report.totals, null, 2))
